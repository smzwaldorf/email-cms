import { describe, expect, it } from 'vitest'

import { buildLoginRedirectPath, isSafeAppRedirectPath } from '@/utils/urlUtils'

describe('urlUtils redirect helpers', () => {
  it('builds login redirect URL with encoded destination', () => {
    const loginPath = buildLoginRedirectPath('/newsletter/abc123/a001', '?jc=journey-1')
    expect(loginPath).toBe('/login?redirect_to=%2Fnewsletter%2Fabc123%2Fa001%3Fjc%3Djourney-1')
  })

  it('only accepts safe in-app redirect targets', () => {
    expect(isSafeAppRedirectPath('/week/2025-W43/a001')).toBe(true)
    expect(isSafeAppRedirectPath('/newsletter/abc123/a001?jc=journey-1')).toBe(true)
    expect(isSafeAppRedirectPath('/article/article-1')).toBe(true)
    expect(isSafeAppRedirectPath('https://evil.example/path')).toBe(false)
    expect(isSafeAppRedirectPath('//evil.example/path')).toBe(false)
    expect(isSafeAppRedirectPath('/admin')).toBe(false)
  })
})
