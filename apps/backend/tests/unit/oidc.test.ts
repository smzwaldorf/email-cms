import { describe, expect, it, vi } from 'vitest'
import { withRuntimeEnvironment } from '#/runtime/environment'
import { authorization } from '#/session/oidc'

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
})
