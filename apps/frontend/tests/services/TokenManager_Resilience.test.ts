import { describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  signinSilent: vi.fn(),
  removeUser: vi.fn(),
  setAccessToken: vi.fn(),
}))

vi.mock('@/services/smzAuth', () => ({
  smzDirectoryResource: () => 'http://localhost:3000/api/directory/v1',
  refreshSmzUser: vi.fn(),
  smzAuth: {
    signinSilent: mocks.signinSilent,
    removeUser: mocks.removeUser,
  },
}))

vi.mock('@/services/backendClient', () => ({ setAccessToken: mocks.setAccessToken }))

import { TokenManager } from '@/services/tokenManager'

describe('TokenManager refresh failure', () => {
  it('fails closed when the central refresh token is rejected', async () => {
    const manager = new TokenManager()
    manager.setAccessToken('expired-token', 0)
    mocks.signinSilent.mockRejectedValue(new Error('invalid_grant'))

    await expect(manager.forceRefresh()).resolves.toBe(false)
    expect(manager.getTokenInfo()).toBeNull()
    expect(mocks.removeUser).toHaveBeenCalled()
  })
})
