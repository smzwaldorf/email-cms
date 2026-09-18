import { beforeEach, describe, expect, it, vi } from 'vitest'

// These tests exercise the browser OIDC adapter. The production selector uses
// the server-session adapter when VITE_CMS_SERVER_SESSION=true; keep this
// suite explicit so local .env.local values do not silently swap its subject.
vi.mock('@/services/serverSessionMode', () => ({ serverSessionMode: false }))

const mocks = vi.hoisted(() => ({
  signinRedirect: vi.fn(),
  signinRedirectCallback: vi.fn(),
  getUser: vi.fn().mockResolvedValue(null),
  signoutRedirect: vi.fn(),
  globalSignOut: vi.fn(),
  removeUser: vi.fn().mockResolvedValue(undefined),
  addUserLoaded: vi.fn(() => vi.fn()),
  addUserUnloaded: vi.fn(() => vi.fn()),
  requestBackend: vi.fn(),
  setStoredAuthUser: vi.fn(),
  setToken: vi.fn(),
  forceRefresh: vi.fn().mockResolvedValue(false),
}))

vi.mock('@/services/smzAuth', () => ({
  redirectToGlobalSignOut: mocks.globalSignOut,
  smzDirectoryResource: () => 'http://localhost:3000/api/directory/v1',
  smzAuth: {
    signinRedirect: mocks.signinRedirect,
    signinRedirectCallback: mocks.signinRedirectCallback,
    signoutRedirect: mocks.signoutRedirect,
    getUser: mocks.getUser,
    removeUser: mocks.removeUser,
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
    forceRefresh: mocks.forceRefresh,
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
    window.localStorage.clear()
    window.sessionStorage.clear()
    mocks.getUser.mockResolvedValue(null)
    mocks.removeUser.mockResolvedValue(undefined)
    authService = (await import('@/services/authService')).authService
    mocks.getUser.mockResolvedValue(null)
    await authService.ensureInitialized()
  })


  it('preserves the current page session when renewal fails at expiry', async () => {
    const user = { access_token: 'current', expires_in: 900, expired: false }
    mocks.signinRedirectCallback.mockResolvedValue(user)
    mocks.requestBackend.mockResolvedValue({ user: { id: 'admin', email: 'admin@example.test', role: 'admin', roles: ['admin'], teacherClassIds: [], parentClassIds: [] } })
    await authService.completeSignIn()
    mocks.getUser.mockResolvedValue({ ...user, expired: true, expires_in: -1 })
    mocks.forceRefresh.mockResolvedValue(false)
    const required = vi.fn()
    window.addEventListener('cms-auth-renewal-required', required)
    const stop = authService.startSessionMonitoring()
    mocks.removeUser.mockClear()
    window.dispatchEvent(new Event('focus'))
    await vi.waitFor(() => expect(required).toHaveBeenCalled())
    expect(authService.getCurrentUser()?.id).toBe('admin')
    expect(mocks.removeUser).not.toHaveBeenCalled()
    stop()
    window.removeEventListener('cms-auth-renewal-required', required)
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

  async function establishAdmin() {
    const user = { access_token: 'admin-token', expires_in: 900, expired: false }
    mocks.signinRedirectCallback.mockResolvedValue(user)
    mocks.getUser.mockResolvedValue(user)
    mocks.requestBackend.mockResolvedValue({ user: { id: 'admin', email: 'dev.admin@smz.example.test', role: 'admin', roles: ['admin'], teacherClassIds: [], parentClassIds: [], display_name: null } })
    await authService.completeSignIn()
  }

  it('clears CMS and OIDC state before fixed global signout and publishes a durable marker', async () => {
    await establishAdmin()
    window.sessionStorage.setItem('oidc.pending-state', 'old-pkce-state')
    await authService.signOut()
    expect(window.sessionStorage.getItem('oidc.pending-state')).toBeNull()
    expect(authService.getCurrentUser()).toBeNull()
    expect(mocks.setStoredAuthUser).toHaveBeenLastCalledWith(null)
    expect(mocks.removeUser).toHaveBeenCalled()
    expect(window.localStorage.getItem('email-cms-global-logout')).toBeTruthy()
    expect(mocks.globalSignOut).toHaveBeenCalledOnce()
    expect(mocks.signoutRedirect).not.toHaveBeenCalled()
  })

  it('still reaches central global logout when local OIDC cleanup rejects', async () => {
    mocks.removeUser.mockRejectedValueOnce(new Error('storage unavailable'))
    await expect(authService.signOut()).rejects.toThrow('storage unavailable')
    expect(mocks.globalSignOut).toHaveBeenCalledOnce()
    expect(authService.getCurrentUser()).toBeNull()
  })

  it('clears a live admin tab on another CMS tab logout marker', async () => {
    await establishAdmin()
    const stop = authService.startSessionMonitoring()
    window.localStorage.setItem('email-cms-global-logout', 'another-tab-logout')
    window.dispatchEvent(new StorageEvent('storage', { key: 'email-cms-global-logout', newValue: 'another-tab-logout' }))
    await vi.waitFor(() => expect(authService.getCurrentUser()).toBeNull())
    stop()
  })

  it('clears a resumed tab when it missed the logout event', async () => {
    await establishAdmin()
    const stop = authService.startSessionMonitoring()
    window.localStorage.setItem('email-cms-global-logout', 'missed-logout')
    window.dispatchEvent(new Event('pageshow'))
    await vi.waitFor(() => expect(authService.getCurrentUser()).toBeNull())
    stop()
  })

  it('cannot restore admin roles from a session request that completes after logout', async () => {
    let resolve!: (value: unknown) => void
    mocks.signinRedirectCallback.mockResolvedValue({ access_token: 'old', expires_in: 900, expired: false })
    mocks.requestBackend.mockImplementationOnce(() => new Promise(value => { resolve = value }))
    const pending = authService.completeSignIn()
    await vi.waitFor(() => expect(resolve).toBeTypeOf('function'))
    await authService.signOut()
    resolve({ user: { id: 'admin', email: 'admin@example.test', role: 'admin', roles: ['admin'] } })
    await expect(pending).rejects.toThrow('cancelled by logout')
    expect(authService.getCurrentUser()).toBeNull()
  })

  it('refreshes roles on focus and clears confirmed central revocation', async () => {
    await establishAdmin()
    const stop = authService.startSessionMonitoring()
    mocks.requestBackend.mockResolvedValueOnce({ user: { id: 'admin', email: 'dev.admin@smz.example.test', role: 'parent', roles: ['parent'] } })
    window.dispatchEvent(new Event('focus'))
    await vi.waitFor(() => expect(authService.getCurrentUser()?.role).toBe('parent'))
    window.dispatchEvent(new Event('cms-auth-invalid'))
    await vi.waitFor(() => expect(authService.getCurrentUser()).toBeNull())
    stop()
  })

  it('discards late OIDC user-loaded events after global logout', async () => {
    await establishAdmin()
    await authService.signOut()
    mocks.requestBackend.mockClear(); mocks.removeUser.mockClear()
    const loaded = mocks.addUserLoaded.mock.calls.at(-1)?.[0] as unknown as (user: unknown) => void
    loaded({ access_token: 'late-refresh', expires_in: 900, expired: false })
    expect(authService.getCurrentUser()).toBeNull()
    expect(mocks.requestBackend).not.toHaveBeenCalled()
    expect(mocks.removeUser).toHaveBeenCalledOnce()
  })

  it('allows a new explicit callback after an older global logout marker', async () => {
    window.localStorage.setItem('email-cms-global-logout', 'previous-logout')
    const stop = authService.startSessionMonitoring()
    let resolve!: (value: unknown) => void
    mocks.signinRedirectCallback.mockResolvedValue({ access_token: 'fresh', expires_in: 900, expired: false })
    mocks.requestBackend.mockImplementationOnce(() => new Promise(value => { resolve = value }))
    const pending = authService.completeSignIn()
    await vi.waitFor(() => expect(resolve).toBeTypeOf('function'))
    window.dispatchEvent(new Event('focus'))
    resolve({ user: { id: 'parent', email: 'parent@example.test', role: 'parent', roles: ['parent'] } })
    await expect(pending).resolves.toMatchObject({ user: { role: 'parent' } })
    stop()
  })

})
