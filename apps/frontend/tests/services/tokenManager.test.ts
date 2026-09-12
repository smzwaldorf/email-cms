import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  refreshSmzUser: vi.fn(),
  signinSilent: vi.fn(),
  removeUser: vi.fn(),
  setAccessToken: vi.fn(),
}))

vi.mock('@/services/smzAuth', () => ({
  smzDirectoryResource: () => 'http://localhost:3000/api/directory/v1',
  refreshSmzUser: mocks.refreshSmzUser,
  smzAuth: {
    signinSilent: mocks.signinSilent,
    removeUser: mocks.removeUser,
  },
}))

vi.mock('@/services/backendClient', () => ({
  setAccessToken: mocks.setAccessToken,
}))

import { TokenManager } from '@/services/tokenManager'

describe('TokenManager with SMZ Identity', () => {
  let manager: TokenManager

  beforeEach(() => {
    vi.clearAllMocks()
    manager = new TokenManager()
  })

  afterEach(() => {
    manager.stopAutoRefreshCheck()
  })

  it('restores a central access token', async () => {
    mocks.refreshSmzUser.mockResolvedValue({ access_token: 'token-1', expires_in: 900 })
    await manager.initializeFromSession()
    expect(manager.getTokenInfo()?.accessToken).toBe('token-1')
    expect(mocks.setAccessToken).toHaveBeenCalledWith('token-1')
  })

  it('refreshes through the OIDC refresh token flow', async () => {
    manager.setAccessToken('old-token', 0)
    mocks.signinSilent.mockResolvedValue({ access_token: 'new-token', expires_in: 1200 })
    await expect(manager.forceRefresh()).resolves.toBe(true)
    expect(manager.getTokenInfo()?.accessToken).toBe('new-token')
  })

  it('clears both memory and backend storage on logout', () => {
    manager.setAccessToken('token-1', 900)
    manager.onLogout()
    expect(manager.getTokenInfo()).toBeNull()
    expect(mocks.setAccessToken).toHaveBeenLastCalledWith(null)
  })
  it('does not resurrect a bearer token when an in-flight refresh finishes after logout', async () => {
    let resolve!: (value: unknown) => void
    manager.setAccessToken('old-token', 0)
    mocks.signinSilent.mockImplementationOnce(() => new Promise(value => { resolve = value }))
    const pending = manager.forceRefresh()
    manager.onLogout()
    resolve({ access_token: 'late-token', expires_in: 1200 })
    await expect(pending).resolves.toBe(false)
    expect(manager.getTokenInfo()).toBeNull()
    expect(mocks.setAccessToken).toHaveBeenLastCalledWith(null)
    expect(mocks.signinSilent).toHaveBeenCalledWith({ resource: 'http://localhost:3000/api/directory/v1', extraTokenParams: { resource: 'http://localhost:3000/api/directory/v1' } })
  })

})
