import * as oauth from 'openid-client'
import { identityFetch, runtimeEnvironment } from '#/runtime/environment'

export const SERVER_CLIENT_ID = 'email-cms-server'
export interface Credentials { access_token: string; refresh_token?: string; expires_in: number }
export interface LoginFlow { verifier: string; nonce: string; state: string; redirectTo: string }
export function appOrigin(): string { return runtimeEnvironment().APP_URL ?? 'http://localhost:5174' }
export function issuer(): string { return runtimeEnvironment().SMZ_AUTH_ISSUER ?? 'http://localhost:3000/api/auth' }
export function directoryResource(): string { return new URL('/api/directory/v1', issuer()).toString() }

async function configuration(): Promise<oauth.Configuration> {
  const secret = runtimeEnvironment().CMS_OIDC_CLIENT_SECRET
  if (!secret || secret.length < 32) throw new Error('Missing CMS confidential client secret')
  // Keep discovery/transport request scoped: bindings must not leak between Workers invocations.
  return oauth.discovery(new URL(issuer()), SERVER_CLIENT_ID, secret, oauth.ClientSecretPost(secret), {
    [oauth.customFetch]: (url, options) => {
      const target = new URL(String(url))
      if (target.origin !== new URL(issuer()).origin) throw new Error('Unexpected Identity endpoint origin')
      return identityFetch(target.toString(), { ...options, body: options.body as BodyInit | null | undefined, signal: AbortSignal.timeout(12_000) })
    },
    ...(new URL(issuer()).protocol === 'http:' && runtimeEnvironment().NODE_ENV !== 'production' ? { execute: [oauth.allowInsecureRequests] } : {}),
  })
}
export async function authorization(flow: LoginFlow): Promise<string> {
  return oauth.buildAuthorizationUrl(await configuration(), {
    redirect_uri: `${appOrigin()}/api/session/callback`, response_type: 'code',
    scope: 'openid profile email directory:access offline_access', resource: directoryResource(),
    state: flow.state, nonce: flow.nonce, code_challenge: await oauth.calculatePKCECodeChallenge(flow.verifier), code_challenge_method: 'S256',
  }).toString()
}
export async function redeem(url: URL, flow: LoginFlow): Promise<{ credentials: Credentials; subject: string }> {
  const result = await oauth.authorizationCodeGrant(await configuration(), url, {
    pkceCodeVerifier: flow.verifier, expectedState: flow.state, expectedNonce: flow.nonce, idTokenExpected: true,
  }, { resource: directoryResource() })
  const subject = result.claims()?.sub
  if (!subject || !result.refresh_token || !result.access_token || !result.expires_in) throw new Error('Identity did not issue a renewable session')
  return { subject, credentials: { access_token: result.access_token, refresh_token: result.refresh_token, expires_in: result.expires_in } }
}
export class RenewalUnavailable extends Error {
  constructor(public readonly exchangeStarted: boolean) { super('Identity renewal unavailable') }
}
export async function renew(credentials: Credentials): Promise<Credentials> {
  if (!credentials.refresh_token) throw new Error('Refresh credential unavailable')
  let config: oauth.Configuration
  try { config = await configuration() } catch { throw new RenewalUnavailable(false) }
  // Identity enables a bounded rotation replay window. Retry exactly the same request
  // within that window when its response is lost; never mint parallel refresh requests.
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const result = await oauth.refreshTokenGrant(config, credentials.refresh_token, { resource: directoryResource() })
      return { access_token: result.access_token, refresh_token: result.refresh_token ?? credentials.refresh_token, expires_in: result.expires_in ?? 900 }
    } catch (error) {
      if (terminalRefreshError(error)) throw error
      if (attempt === 1) throw new RenewalUnavailable(true)
    }
  }
  throw new RenewalUnavailable(true)
}
export function terminalRefreshError(error: unknown): boolean {
  return error instanceof oauth.ResponseBodyError && ['invalid_grant', 'access_denied'].includes(error.error ?? '')
}
