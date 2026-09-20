import type { IncomingMessage, ServerResponse } from 'node:http'
import { runtimeEnvironment } from '#/runtime/environment'
import { deliveryContactsForToken, directoryForToken, HttpError, viewerAndDirectoryForToken, viewerForToken, type AuthenticatedViewer, type SmzDirectoryGraph } from '#/auth'
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
interface CookieIdentity { viewer: AuthenticatedViewer; directory: SmzDirectoryGraph }
const requestIdentities = new WeakMap<IncomingMessage, Promise<CookieIdentity>>()
function cookieIdentity(request: IncomingMessage): Promise<CookieIdentity> {
  let pending = requestIdentities.get(request)
  if (!pending) { pending = resolveCookieIdentity(request); requestIdentities.set(request, pending) }
  return pending
}
export async function cookieViewer(request: IncomingMessage): Promise<AuthenticatedViewer> {
  return (await cookieIdentity(request)).viewer
}
export async function directoryForCookie(request: IncomingMessage): Promise<SmzDirectoryGraph> {
  // The catalogue comes from the same verified admission as the viewer, so a
  // request never pays for a second Identity round trip. It contains no token.
  return (await cookieIdentity(request)).directory
}

export async function directoryFamiliesForCookie(request: IncomingMessage) {
  return (await directoryForCookie(request)).families
}
async function verified(session: BrowserSession): Promise<CookieIdentity> {
  let credentials = await sessionCredentials(session)
  try { return await viewerAndDirectoryForToken(credentials.access_token, 'email-cms-server', session.subject) } catch (error) {
    if (!(error instanceof HttpError) || error.status !== 401 || error.code === 'session_expired') throw error
    credentials = await sessionCredentials(session, true)
    return viewerAndDirectoryForToken(credentials.access_token, 'email-cms-server', session.subject)
  }
}
async function resolveCookieIdentity(request: IncomingMessage): Promise<CookieIdentity> {
  checkSessionCsrf(request)
  const id = sessionId(request)
  const session = id ? await readSession(id) : null
  if (!session || session.issuer !== issuer()) throw new HttpError(401, 'Sign in to continue', 'session_missing')
  try {
    const identity = await verified(session)
    await rememberViewer(session, identity.viewer)
    return identity
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
    const result = await redeem(url, flow)
    const id = await createSession(result.subject, result.credentials)
    // Rotate the browser session only after the new OIDC exchange succeeds.
    const previous = sessionId(request)
    if (previous) await revokeSession(previous)
    const created = await readSession(id)
    try {
      const viewer = await viewerForToken(result.credentials.access_token, 'email-cms-server', result.subject)
      if (created) await rememberViewer(created, viewer)
    } catch (error) {
      console.warn('CMS callback identity resolution failed', {
        status: error instanceof HttpError ? error.status : 0,
        code: error instanceof HttpError ? error.code ?? null : null,
        message: error instanceof Error ? error.message : 'unknown',
      })
    }
    const secure = new URL(appOrigin()).protocol === 'https:' ? '; Secure' : ''
    const location = `/auth/callback?server=1&next=${encodeURIComponent(flow.redirectTo)}`
    // 200+refresh keeps Set-Cookie on the Pages service-binding hop; 303s can drop it.
    response.writeHead(200, {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'private, no-store',
      'Set-Cookie': [
        `${cookieName()}-flow=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`,
        `${cookieName()}=${id}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${400 * 86400}${secure}`,
      ],
    })
    response.end(`<!doctype html><meta http-equiv="refresh" content="0;url=${location}"><p>Signing in…</p>`)
    return true
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
        json(response, 200, {
          user: session.identity_snapshot,
          authorizationStatus: error instanceof HttpError && error.status === 401 ? 'reauthentication_required' : 'reconnecting',
          reason: error instanceof HttpError ? error.code ?? error.message : 'identity_unavailable',
        })
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
