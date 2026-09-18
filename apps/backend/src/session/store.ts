import { randomUUID } from 'node:crypto'
import { query } from '#/lib/db'
import { HttpError, type AuthenticatedViewer } from '#/auth'
import { hashSessionId, randomSessionId, seal, unseal } from './crypto'
import { issuer, renew, terminalRefreshError, RenewalUnavailable, type Credentials, type LoginFlow } from './oidc'

export interface BrowserSession {
  id_hash: string; issuer: string; subject: string; credentials: string | null;
  access_expires_at: Date; identity_snapshot: AuthenticatedViewer | null;
  state: 'active' | 'reauthentication_required' | 'revoked'; generation: number;
  refresh_owner: string | null; refresh_until: Date | null;
}
export async function createFlow(flow: LoginFlow, browser: string): Promise<void> {
  await query('INSERT INTO cms_login_flows(state_hash,browser_hash,encrypted_flow) VALUES($1,$2,$3)',
    [hashSessionId(flow.state), hashSessionId(browser), seal(flow, 'login-flow')])
}
export async function consumeFlow(state: string, browser: string): Promise<LoginFlow> {
  const result = await query<{ encrypted_flow: string }>('DELETE FROM cms_login_flows WHERE state_hash=$1 AND browser_hash=$2 AND expires_at>now() RETURNING encrypted_flow', [hashSessionId(state), hashSessionId(browser)])
  if (!result.rows[0]) throw new HttpError(400, 'Login has expired or was already completed', 'invalid_login_flow')
  return unseal<LoginFlow>(result.rows[0].encrypted_flow, 'login-flow')
}
export async function createSession(subject: string, credentials: Credentials): Promise<string> {
  const id = randomSessionId(); const hashed = hashSessionId(id)
  await query('INSERT INTO cms_browser_sessions(id_hash,issuer,subject,credentials,access_expires_at) VALUES($1,$2,$3,$4,$5)',
    [hashed, issuer(), subject, seal(credentials, hashed), new Date(Date.now() + credentials.expires_in * 1000)])
  return id
}
export async function readSession(id: string): Promise<BrowserSession | null> {
  if (!/^[A-Za-z0-9_-]{43}$/.test(id)) return null
  const result = await query<BrowserSession>('SELECT * FROM cms_browser_sessions WHERE id_hash=$1 AND remembered_until>now()', [hashSessionId(id)])
  return result.rows[0] ?? null
}
export async function revokeSession(id: string): Promise<void> {
  await query("UPDATE cms_browser_sessions SET state='revoked', credentials=NULL, identity_snapshot=NULL, generation=generation+1, refresh_owner=NULL, refresh_until=NULL, updated_at=now() WHERE id_hash=$1", [hashSessionId(id)])
}
export async function rememberViewer(session: BrowserSession, viewer: AuthenticatedViewer): Promise<void> {
  const updated = await query("UPDATE cms_browser_sessions SET identity_snapshot=$2, updated_at=now(), remembered_until=now()+interval '400 days' WHERE id_hash=$1 AND state='active' AND generation=$3 RETURNING id_hash", [session.id_hash, JSON.stringify(viewer), session.generation])
  if (!updated.rowCount) throw new HttpError(401, 'Session changed during verification', 'session_changed')
}
function sessionError(session: BrowserSession): void {
  if (session.state === 'revoked') throw new HttpError(403, 'Access has ended', 'access_revoked')
  if (session.state === 'reauthentication_required' || !session.credentials) throw new HttpError(401, 'Please verify your identity to resume', 'reauthentication_required')
}
export async function sessionCredentials(session: BrowserSession, force = false): Promise<Credentials> {
  sessionError(session)
  const old = unseal<Credentials>(session.credentials!, session.id_hash)
  if (!force && session.access_expires_at.getTime() > Date.now() + 60_000) return old
  const owner = randomUUID()
  // A database lease serializes rotating refresh tokens across all Worker instances.
  // Never keep a transaction/connection checked out while contacting Identity.
  const acquired = await query<BrowserSession>(`UPDATE cms_browser_sessions SET refresh_owner=$2, refresh_until=now()+interval '60 seconds'
    WHERE id_hash=$1 AND state='active' AND generation=$3 AND refresh_owner IS NULL
    AND (refresh_until IS NULL OR refresh_until<=now()) RETURNING *`, [session.id_hash, owner, session.generation])
  if (!acquired.rowCount) {
    for (let attempt = 0; attempt < 60; attempt++) {
      await new Promise(resolve => setTimeout(resolve, 200))
      const { rows } = await query<BrowserSession>('SELECT * FROM cms_browser_sessions WHERE id_hash=$1', [session.id_hash])
      const current = rows[0]
      if (!current) throw new HttpError(401, 'Session unavailable', 'reauthentication_required')
      sessionError(current)
      if (current.generation !== session.generation) {
        Object.assign(session, current)
        return unseal<Credentials>(current.credentials!, current.id_hash)
      }
      if (current.refresh_owner && current.refresh_until && current.refresh_until.getTime() <= Date.now()) {
        // A crashed owner may have consumed the rotating token. Do not replay it and revoke the whole family.
        await query("UPDATE cms_browser_sessions SET state='reauthentication_required', credentials=NULL, generation=generation+1, refresh_owner=NULL WHERE id_hash=$1 AND refresh_owner=$2 AND refresh_until<=now()", [session.id_hash, current.refresh_owner])
        throw new HttpError(401, 'Please verify your identity to resume', 'reauthentication_required')
      }
      if (!current.refresh_owner) break
    }
    if (!force && session.access_expires_at.getTime() > Date.now()) return old
    throw new HttpError(503, 'Reconnecting to Identity', 'identity_unavailable')
  }
  try {
    const credentials = await renew(old)
    const result = await query<BrowserSession>(`UPDATE cms_browser_sessions SET credentials=$3,access_expires_at=$4,generation=generation+1,
      refresh_owner=NULL,refresh_until=NULL,updated_at=now() WHERE id_hash=$1 AND refresh_owner=$2 AND state='active' AND generation=$5 RETURNING *`,
      [session.id_hash, owner, seal(credentials, session.id_hash), new Date(Date.now() + credentials.expires_in * 1000), session.generation])
    if (!result.rows[0]) throw new HttpError(403, 'Session ended during renewal', 'access_revoked')
    Object.assign(session, result.rows[0])
    return credentials
  } catch (error) {
    if (terminalRefreshError(error)) {
      await query("UPDATE cms_browser_sessions SET state='reauthentication_required', credentials=NULL,generation=generation+1,refresh_owner=NULL,refresh_until=NULL WHERE id_hash=$1 AND refresh_owner=$2 AND state='active'", [session.id_hash, owner])
      throw new HttpError(401, 'Please verify your identity to resume', 'reauthentication_required')
    }
    if (error instanceof RenewalUnavailable && !error.exchangeStarted) {
      await query("UPDATE cms_browser_sessions SET refresh_owner=NULL,refresh_until=now()+interval '5 seconds' WHERE id_hash=$1 AND refresh_owner=$2 AND state='active'", [session.id_hash, owner])
    }
    // An ambiguous refresh transport failure can mean rotation succeeded remotely. Keep the
    // lease as a quarantine; the next request never blindly reuses a possibly consumed token.
    if (error instanceof HttpError) throw error
    if (!force && session.access_expires_at.getTime() > Date.now()) return old
    throw new HttpError(503, 'Reconnecting to Identity', 'identity_unavailable')
  }
}

export async function readSessionByHash(hash:string):Promise<BrowserSession|null> {
 const {rows}=await query<BrowserSession>('SELECT * FROM cms_browser_sessions WHERE id_hash=$1 AND remembered_until>now()',[hash])
 return rows[0]??null
}
