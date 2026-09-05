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
  smzDirectoryResource: () => 'http://localhost:3000/api/directory/v1',
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

let authService: typeof import('@/services/authService')['authService']

describe('SMZ AuthService', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    vi.resetModules()
    authService = (await import('@/services/authService')).authService
    mocks.getUser.mockResolvedValue(null)
    await authService.ensureInitialized()
  })

  it('preserves a safe application destination in OIDC state', async () => {
    await authService.signInWithGoogle('/article/article-123?jc=journey-1')

    expect(mocks.signinRedirect).toHaveBeenCalledWith(expect.objectContaining({
      state: { redirectTo: '/article/article-123?jc=journey-1' },
      resource: 'http://localhost:3000/api/directory/v1',
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
  it('retries a directory outage without consuming OIDC callback again or losing the article destination', async () => {
    mocks.signinRedirectCallback.mockResolvedValue({ access_token: 'fixture', expires_in: 900, expired: false, state: { redirectTo: '/week/2026-W36/article-one?jc=fixture' } })
    mocks.requestBackend.mockRejectedValueOnce(new Error('SMZ Identity is unavailable')).mockResolvedValueOnce({ user: { id: 'local', email: 'parent@example.test', role: 'parent', roles: ['parent'], teacherClassIds: [], parentClassIds: ['C4'], display_name: null } })
    await expect(authService.completeSignIn()).rejects.toThrow('unavailable')
    const recovered = await authService.completeSignIn()
    expect(recovered.redirectTo).toBe('/week/2026-W36/article-one?jc=fixture')
    expect(mocks.signinRedirectCallback).toHaveBeenCalledOnce()
    expect(mocks.requestBackend).toHaveBeenCalledTimes(2)
  })

})
