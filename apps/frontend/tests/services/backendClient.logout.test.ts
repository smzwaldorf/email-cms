import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getAccessTokenOrNull, requestBackend, setAccessToken } from '@/services/backendClient'
beforeEach(() => { window.localStorage.clear(); window.sessionStorage.clear() })
afterEach(() => vi.unstubAllGlobals())
describe('tab-scoped bearer invalidation', () => {
  it('keeps bearer identity per tab and removes the legacy shared bearer', () => {
    window.localStorage.setItem('email-cms-access-token', 'other-tab')
    expect(getAccessTokenOrNull()).toBeNull()
    setAccessToken('this-tab')
    expect(getAccessTokenOrNull()).toBe('this-tab')
    expect(window.localStorage.getItem('email-cms-access-token')).toBeNull()
  })
  it('does not clear a newer login when an older in-flight request returns 401', async () => {
    let resolve!: (value: Response) => void
    vi.stubGlobal('fetch', vi.fn(() => new Promise(value => { resolve = value })))
    setAccessToken('old')
    const pending = requestBackend('/api/auth/session')
    setAccessToken('new')
    resolve(new Response(JSON.stringify({ error: 'expired' }), { status: 401 }))
    await expect(pending).rejects.toMatchObject({ status: 401 })
    expect(getAccessTokenOrNull()).toBe('new')
  })
  it('clears current bearer on confirmed central session revocation', async () => {
    setAccessToken('current')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: 'revoked', code: 'access_revoked' }), { status: 403 })))
    await expect(requestBackend('/api/auth/session')).rejects.toMatchObject({ status: 403 })
    expect(getAccessTokenOrNull()).toBeNull()
  })
})
