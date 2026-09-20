import { describe, expect, it, vi } from 'vitest'
import { exportJWK, generateKeyPair, SignJWT } from 'jose'
import { withRuntimeEnvironment } from '#/runtime/environment'
import { authorization, redeem, renew } from '#/session/oidc'

const environment = {
  APP_URL: 'https://cms.school.test',
  CMS_OIDC_CLIENT_SECRET: 's'.repeat(32),
  NODE_ENV: 'production',
  SMZ_AUTH_ISSUER: 'https://auth.school.test/api/auth',
}

describe('OIDC configuration', () => {
  it('builds the login URL without performing discovery on the request path', async () => {
    const fetch = vi.fn(async () => {
      throw new Error('OIDC discovery must not run while starting login')
    })

    const location = await withRuntimeEnvironment(environment, () => authorization({
      verifier: 'v'.repeat(43),
      nonce: 'nonce',
      state: 'state',
      redirectTo: '/admin',
    }), { fetch })

    const url = new URL(location)
    expect(url.origin).toBe('https://auth.school.test')
    expect(url.pathname).toBe('/api/auth/oauth2/authorize')
    expect(url.searchParams.get('client_id')).toBe('email-cms-server')
    expect(fetch).not.toHaveBeenCalled()
  })

  it('uses the public HTTPS issuer for token exchange instead of nesting Auth service bindings', async () => {
    const serviceFetch = vi.fn(async () => {
      throw new Error('OIDC exchange must not add another Worker service hop')
    })
    const publicFetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      access_token: 'new-access',
      refresh_token: 'new-refresh',
      expires_in: 900,
      token_type: 'Bearer',
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }))

    try {
      await expect(withRuntimeEnvironment(environment, () => renew({
        access_token: 'old-access',
        refresh_token: 'old-refresh',
        expires_in: 10,
      }), { fetch: serviceFetch })).resolves.toMatchObject({ access_token: 'new-access' })
      expect(publicFetch).toHaveBeenCalledOnce()
      expect(String(publicFetch.mock.calls[0][0])).toBe('https://auth.school.test/api/auth/oauth2/token')
      expect(serviceFetch).not.toHaveBeenCalled()
    } finally {
      publicFetch.mockRestore()
    }
  })

  it('accepts the EdDSA ID tokens advertised by SMZ Identity', async () => {
    const { privateKey, publicKey } = await generateKeyPair('EdDSA')
    const jwk = { ...await exportJWK(publicKey), kid: 'identity-key', use: 'sig' }
    const idToken = await new SignJWT({ nonce: 'nonce' })
      .setProtectedHeader({ alg: 'EdDSA', kid: jwk.kid })
      .setIssuer(environment.SMZ_AUTH_ISSUER)
      .setAudience('email-cms-server')
      .setSubject('person-1')
      .setIssuedAt()
      .setExpirationTime('5m')
      .sign(privateKey)
    const publicFetch = vi.spyOn(globalThis, 'fetch').mockImplementation(async input => {
      const url = String(input)
      if (url.endsWith('/oauth2/token')) return new Response(JSON.stringify({
        access_token: 'access', refresh_token: 'refresh', expires_in: 900, token_type: 'Bearer', id_token: idToken,
      }), { status: 200, headers: { 'Content-Type': 'application/json' } })
      if (url.endsWith('/jwks')) return new Response(JSON.stringify({ keys: [jwk] }), {
        status: 200, headers: { 'Content-Type': 'application/json' },
      })
      throw new Error(`Unexpected Identity request: ${url}`)
    })

    try {
      await expect(withRuntimeEnvironment(environment, () => redeem(new URL(
        'https://cms.school.test/api/session/callback?code=code&state=state',
      ), { verifier: 'v'.repeat(43), nonce: 'nonce', state: 'state', redirectTo: '/admin' }))).resolves.toMatchObject({
        subject: 'person-1',
        credentials: { access_token: 'access', refresh_token: 'refresh' },
      })
    } finally {
      publicFetch.mockRestore()
    }
  })
})
