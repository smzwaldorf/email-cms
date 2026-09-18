import type { IncomingMessage, ServerResponse } from 'node:http'
import { runtimeEnvironment } from '#/runtime/environment'
import { deliveryContactsForToken, directoryForToken, HttpError, viewerForToken, type AuthenticatedViewer, type SmzDirectoryGraph } from '#/auth'
import { randomSessionId } from './crypto'
import { appOrigin, authorization, redeem, issuer } from './oidc'
import { consumeFlow, createFlow, createSession, readSessionByHash, readSession, rememberViewer, revokeSession, sessionCredentials, type BrowserSession } from './store'

export const serverSessionsEnabled = () => runtimeEnvironment().CMS_SESSION_ENABLED === 'true'
function cookieName(): string { return new URL(appOrigin()).protocol === 'https:' ? '__Host-cms-session' : 'cms-session' }
function cookies(request: IncomingMessage): Record<string, string> {
  return Object.fromEntries((request.headers.cookie ?? '').split(';').map(part => part.trim().split('=')).filter(pair => pair.length === 2))
}
export function sessionId(request: IncomingMessage): string | undefined { return cookies(request)[cookieName()] }
function setCookie(response: ServerResponse, name: string, value: string, maxAge: number): void {
  const prior = response.getHeader('Set-Cookie')
  const cookie = `${name}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${new URL(appOrigin()).protocol === 'https:' ? '; Secure' : ''}`
  response.setHeader('Set-Cookie', [...(Array.isArray(prior) ? prior : prior ? [String(prior)] : []), cookie])
}
export function checkSessionCsrf(request: IncomingMessage): void {
  if (['GET', 'HEAD', 'OPTIONS'].includes(request.method ?? 'GET')) return
  if (request.headers.origin !== appOrigin() || request.headers['x-cms-request'] !== '1') {
    throw new HttpError(403, 'Request origin could not be verified', 'csrf_rejected')
  }
}
const requestViewers = new WeakMap<IncomingMessage, Promise<AuthenticatedViewer>>()
export async function cookieViewer(request: IncomingMessage): Promise<AuthenticatedViewer> {
  let pending = requestViewers.get(request)
  if (!pending) { pending = resolveCookieViewer(request); requestViewers.set(request, pending) }
  return pending
}
export async function directoryForCookie(request: IncomingMessage): Promise<SmzDirectoryGraph> {
  // Verify the central session and current CMS admission before using its
  // sealed directory credential. The returned catalogue contains no token.
  await cookieViewer(request)
  const id = sessionId(request)
  const session = id ? await readSession(id) : null
  if (!session || session.issuer !== issuer()) throw new HttpError(401, 'Sign in to continue', 'session_missing')
  const credentials = await sessionCredentials(session)
  return directoryForToken(credentials.access_token, 'email-cms-server', session.subject)
}

export async function directoryFamiliesForCookie(request: IncomingMessage) {
  return (await directoryForCookie(request)).families
}
async function verified(session: BrowserSession): Promise<AuthenticatedViewer> {
  let credentials = await sessionCredentials(session)
  try { return await viewerForToken(credentials.access_token, 'email-cms-server', session.subject) } catch (error) {
    if (!(error instanceof HttpError) || error.status !== 401 || error.code === 'session_expired') throw error
    credentials = await sessionCredentials(session, true)
    return viewerForToken(credentials.access_token, 'email-cms-server', session.subject)
  }
}
async function resolveCookieViewer(request: IncomingMessage): Promise<AuthenticatedViewer> {
  checkSessionCsrf(request)
  const id = sessionId(request)
  const session = id ? await readSession(id) : null
  if (!session || session.issuer !== issuer()) throw new HttpError(401, 'Sign in to continue', 'session_missing')
  try {
    const viewer = await verified(session)
    await rememberViewer(session, viewer)
    return viewer
  } catch (error) {
    if (error instanceof HttpError && error.code === 'access_revoked') await revokeSession(id!)
    throw error
  }
}
function safePath(value: string | null): string {
  return value && value.startsWith('/') && !value.startsWith('//') && !value.includes('\\') && !/[\r\n]/.test(value) ? value : ''
}
function json(response: ServerResponse, status: number, value: unknown): void {
  response.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'private, no-store' })
  response.end(JSON.stringify(value))
}
export async function handleSessionRequest(request: IncomingMessage, response: ServerResponse): Promise<boolean> {
  if (!serverSessionsEnabled()) return false
  const url = new URL(request.url ?? '/', appOrigin())
  if (!url.pathname.startsWith('/api/session/')) return false
  response.setHeader('Cache-Control', 'private, no-store')
  checkSessionCsrf(request)
  if (url.pathname === '/api/session/login' && request.method === 'POST') {
    const browser = randomSessionId()
    const flow = { state: randomSessionId(), verifier: randomSessionId(), nonce: randomSessionId(), redirectTo: safePath(url.searchParams.get('next')) }
    const location = await authorization(flow)
    await createFlow(flow, browser)
    setCookie(response, `${cookieName()}-flow`, browser, 600)
    json(response, 200, { url: location }); return true
  }
  if (url.pathname === '/api/session/callback' && request.method === 'GET') {
    const flow = await consumeFlow(url.searchParams.get('state') ?? '', cookies(request)[`${cookieName()}-flow`] ?? '')
    setCookie(response, `${cookieName()}-flow`, '', 0)
    const result = await redeem(url, flow)
    const id = await createSession(result.subject, result.credentials)
    // Rotate the browser session only after the new OIDC exchange succeeds.
    const previous = sessionId(request)
    if (previous) await revokeSession(previous)
    setCookie(response, cookieName(), id, 400 * 86400)
    response.writeHead(303, { Location: `/auth/callback?server=1&next=${encodeURIComponent(flow.redirectTo)}` })
    response.end(); return true
  }
  if (url.pathname === '/api/session/logout' && request.method === 'POST') {
    const id = sessionId(request)
    // Commit server revocation before claiming logout succeeded or clearing the cookie.
    if (id) await revokeSession(id)
    setCookie(response, cookieName(), '', 0)
    json(response, 200, { ok: true }); return true
  }
  if (url.pathname === '/api/session/current' && request.method === 'GET') {
    const id = sessionId(request)
    const session = id ? await readSession(id) : null
    if (!session || session.issuer !== issuer() || session.state === 'revoked') {
      json(response, 200, { user: null, authorizationStatus: session?.state === 'revoked' ? 'revoked' : 'signed_out' }); return true
    }
    try {
      const viewer = await cookieViewer(request)
      setCookie(response, cookieName(), id!, 400 * 86400)
      json(response, 200, { user: viewer, authorizationStatus: 'active' })
    } catch (error) {
      if (error instanceof HttpError && error.code === 'access_revoked') {
        json(response, 200, { user: null, authorizationStatus: 'revoked' })
      } else {
        json(response, 200, { user: session.identity_snapshot, authorizationStatus: error instanceof HttpError && error.status === 401 ? 'reauthentication_required' : 'reconnecting' })
      }
    }
    return true
  }
  throw new HttpError(404, 'Unknown session endpoint')
}

export async function deliveryIdentityForSessionHash(hash:string) {
 const session=await readSessionByHash(hash)
 if(!session || session.issuer!==issuer()) throw new HttpError(401,'Delivery authorization expired; sign in again')
 await verified(session)
 const credentials=await sessionCredentials(session)
 return {directory:()=>directoryForToken(credentials.access_token,'email-cms-server',session.subject), contacts:()=>deliveryContactsForToken(credentials.access_token,session.subject),sessionId:hash}
}
