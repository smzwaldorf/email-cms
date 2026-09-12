import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
beforeEach(() => { vi.resetModules(); vi.stubEnv('VITE_CMS_SERVER_SESSION', 'true'); sessionStorage.clear() })
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals() })
describe('same-origin cookie API', () => {
  it('never forwards legacy bearer tokens and sets the CSRF header on mutations', async () => {
    sessionStorage.setItem('email-cms-access-token', 'legacy-token')
    const fetcher=vi.fn().mockResolvedValue(new Response('{}'));vi.stubGlobal('fetch',fetcher)
    const { requestBackend }=await import('@/services/backendClient')
    await requestBackend('/api/admin/rpc',{method:'POST',body:'{}'})
    const [url,init]=fetcher.mock.calls[0]
    expect(url).toBe('/api/admin/rpc');expect(init.credentials).toBe('same-origin')
    expect(init.headers['X-CMS-Request']).toBe('1');expect(init.headers.Authorization).toBeUndefined()
  })
  it('signals reconnection without clearing identity or replaying ambiguous writes', async () => {
    const fetcher=vi.fn().mockRejectedValue(new TypeError('connection lost'));vi.stubGlobal('fetch',fetcher)
    const unavailable=vi.fn();window.addEventListener('cms-auth-unavailable',unavailable)
    const { requestBackend, setStoredAuthUser, getStoredAuthUser }=await import('@/services/backendClient')
    setStoredAuthUser({id:'person',email:'person@example.test'})
    await expect(requestBackend('/api/admin/rpc',{method:'POST',body:'{}'})).rejects.toThrow()
    expect(fetcher).toHaveBeenCalledTimes(1);expect(unavailable).toHaveBeenCalledOnce();expect(getStoredAuthUser()?.id).toBe('person')
    window.removeEventListener('cms-auth-unavailable',unavailable)
  })
})
