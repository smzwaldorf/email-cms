import { afterEach, describe, expect, it, vi } from 'vitest'

import { HttpError, verifySmzAccessToken } from '#/auth'

const originalIssuer = process.env.SMZ_AUTH_ISSUER

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

afterEach(() => {
  vi.unstubAllGlobals()
  if (originalIssuer === undefined) delete process.env.SMZ_AUTH_ISSUER
  else process.env.SMZ_AUTH_ISSUER = originalIssuer
})

describe('verifySmzAccessToken', () => {
  it('accepts matching Email CMS context and verified OIDC identity', async () => {
    process.env.SMZ_AUTH_ISSUER = 'http://identity.test/api/auth'
    vi.stubGlobal('fetch', vi.fn((input: string | URL | Request) => {
      const url = String(input)
      if (url.endsWith('/api/directory/v1/me/access-context')) {
        return Promise.resolve(jsonResponse({
          sub: 'person-1',
          clientId: 'email-cms',
          access: 'active',
          roles: ['parent'],
        }))
      }
      return Promise.resolve(jsonResponse({
        sub: 'person-1',
        email: ' Parent@Example.com ',
        email_verified: true,
      }))
    }))

    await expect(verifySmzAccessToken('token')).resolves.toEqual({
      issuer: 'http://identity.test/api/auth',
      subject: 'person-1',
      verifiedEmail: 'parent@example.com',
    })
  })

  it('rejects a valid identity token issued for another application', async () => {
    vi.stubGlobal('fetch', vi.fn((input: string | URL | Request) => {
      const url = String(input)
      return Promise.resolve(url.includes('access-context')
        ? jsonResponse({ sub: 'person-1', clientId: 'vite-app', access: 'active', roles: ['parent'] })
        : jsonResponse({ sub: 'person-1', email: 'parent@example.com', email_verified: true }))
    }))

    await expect(verifySmzAccessToken('token')).rejects.toMatchObject({
      name: 'HttpError',
      status: 401,
    } satisfies Partial<HttpError>)
  })

  it('preserves an application-access denial from SMZ Identity', async () => {
    vi.stubGlobal('fetch', vi.fn((input: string | URL | Request) => {
      const url = String(input)
      return Promise.resolve(url.includes('access-context')
        ? jsonResponse({ error: 'access_revoked' }, 403)
        : jsonResponse({ sub: 'person-1', email: 'parent@example.com', email_verified: true }))
    }))

    await expect(verifySmzAccessToken('token')).rejects.toMatchObject({
      name: 'HttpError',
      status: 403,
    } satisfies Partial<HttpError>)
  })
})
