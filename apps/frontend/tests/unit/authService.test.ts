import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  signinRedirect: vi.fn(),
  signinRedirectCallback: vi.fn(),
  getUser: vi.fn().mockResolvedValue(null),
  signoutRedirect: vi.fn(),
  addUserLoaded: vi.fn(() => vi.fn()),
  addUserUnloaded: vi.fn(() => vi.fn()),
  requestBackend: vi.fn(),
  setStoredAuthUser: vi.fn(),
  setToken: vi.fn(),
}))

vi.mock('@/services/smzAuth', () => ({
  smzAuth: {
    signinRedirect: mocks.signinRedirect,
    signinRedirectCallback: mocks.signinRedirectCallback,
    signoutRedirect: mocks.signoutRedirect,
    getUser: mocks.getUser,
    events: { addUserLoaded: mocks.addUserLoaded, addUserUnloaded: mocks.addUserUnloaded },
  },
  redirectFromSmzUser: (user: { state?: { redirectTo?: string } }) => user.state?.redirectTo,
}))

vi.mock('@/services/backendClient', () => ({
  requestBackend: mocks.requestBackend,
  setStoredAuthUser: mocks.setStoredAuthUser,
}))

vi.mock('@/services/tokenManager', () => ({
  tokenManager: {
    setAccessToken: mocks.setToken,
    onLogout: vi.fn(),
  },
}))

vi.mock('@/services/auditLogger', () => ({
  auditLogger: { logAuthEvent: vi.fn().mockResolvedValue(undefined) },
}))

import { authService } from '@/services/authService'

describe('SMZ AuthService', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    mocks.getUser.mockResolvedValue(null)
    await authService.ensureInitialized()
  })

  it('preserves a safe application destination in OIDC state', async () => {
    await authService.signInWithGoogle('/article/article-123?jc=journey-1')

    expect(mocks.signinRedirect).toHaveBeenCalledWith(expect.objectContaining({
      state: { redirectTo: '/article/article-123?jc=journey-1' },
      resource: 'smz-directory',
    }))
  })

  it('drops an external destination before starting OIDC', async () => {
    await authService.signInWithGoogle('https://evil.example/path')

    expect(mocks.signinRedirect).toHaveBeenCalledWith(expect.objectContaining({ state: undefined }))
  })

  it('exchanges the callback for a backend-validated local session', async () => {
    mocks.signinRedirectCallback.mockResolvedValue({
      access_token: 'central-access-token',
      expires_in: 900,
      expired: false,
      state: { redirectTo: '/week/2025-W47' },
    })
    mocks.requestBackend.mockResolvedValue({
      user: {
        id: 'local-user-id',
        email: 'parent@example.com',
        role: 'parent',
        display_name: 'Parent',
      },
    })

    const [first, second] = await Promise.all([
      authService.completeSignIn(),
      authService.completeSignIn(),
    ])
    expect(first).toMatchObject({
      user: { id: 'local-user-id', role: 'parent' },
      redirectTo: '/week/2025-W47',
    })
    expect(second).toEqual(first)
    expect(mocks.signinRedirectCallback).toHaveBeenCalledOnce()
    expect(mocks.setToken).toHaveBeenCalledWith('central-access-token', 900)
    expect(mocks.requestBackend).toHaveBeenCalledWith('/api/auth/session')
  })
})
