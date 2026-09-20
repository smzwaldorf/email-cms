import { describe, expect, it, vi } from 'vitest'
import { withRuntimeEnvironment } from '#/runtime/environment'
import { authorization, renew } from '#/session/oidc'

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
})
