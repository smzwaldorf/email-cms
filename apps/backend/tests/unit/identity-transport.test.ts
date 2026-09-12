import { describe, expect, it, vi } from 'vitest'
import { identityFetch, runtimeEnvironment, withRuntimeEnvironment } from '#/runtime/environment'

describe('invocation-scoped Auth service transport', () => {
  it('keeps concurrent identity requests on their own binding and preserves authorization', async () => {
    const calls: string[] = []
    const invoke = (id: string) => withRuntimeEnvironment({ REQUEST_ID: id }, async () => {
      await Promise.resolve()
      const response = await identityFetch('https://auth.school.test/api/auth/oauth2/userinfo', { headers: { Authorization: `Bearer test-${id}` } })
      expect(runtimeEnvironment().REQUEST_ID).toBe(id)
      return response.text()
    }, { fetch: async (url, init) => {
      calls.push(`${id}:${new Headers(init?.headers).get('Authorization')}`)
      expect(url).toBe('https://auth.school.test/api/auth/oauth2/userinfo')
      return new Response(id)
    } })
    expect(await Promise.all([invoke('a'), invoke('b')])).toEqual(['a', 'b'])
    expect(calls).toEqual(['a:Bearer test-a', 'b:Bearer test-b'])
  })

  it('retains ordinary fetch for the Node runtime', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('node'))
    try {
      await withRuntimeEnvironment({}, () => identityFetch('https://auth.school.test/api/auth/oauth2/userinfo'))
      expect(fetchMock).toHaveBeenCalledOnce()
    } finally { fetchMock.mockRestore() }
  })
})
