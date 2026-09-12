import { beforeEach, describe, expect, it, vi } from 'vitest'
vi.mock('@/services/backendClient', () => ({ setStoredAuthUser: vi.fn() }))
const user = { id: 'person-1', email: 'person@example.test', role: 'admin', roles: ['admin'], teacherClassIds: [], parentClassIds: [], displayName: 'Person' }
let service: typeof import('@/services/serverAuthService')['serverAuthService']
let request: ReturnType<typeof vi.fn>
beforeEach(async () => {
  vi.resetModules(); localStorage.clear(); sessionStorage.clear()
  request = vi.fn(); vi.stubGlobal('fetch', request)
  service = (await import('@/services/serverAuthService')).serverAuthService
})
describe('persistent browser identity', () => {
  it('restores remembered identity after reload while the server is unavailable', async () => {
    localStorage.setItem('email-cms-remembered-identity-v1', JSON.stringify(user))
    request.mockRejectedValue(new TypeError('offline'))
    await service.initialize()
    expect(service.getCurrentUser()?.id).toBe(user.id)
    expect(service.getAuthorizationStatus()).toBe('reconnecting')
    expect(sessionStorage.getItem('email-cms-access-token')).toBeNull()
  })
  it('recovers after startup failure without a permanently rejected initialization promise', async () => {
    request.mockRejectedValueOnce(new TypeError('offline')).mockResolvedValue(new Response(JSON.stringify({ user, authorizationStatus: 'active' })))
    await service.initialize(); await service.ensureInitialized()
    expect(service.getCurrentUser()?.id).toBe(user.id)
    expect(service.getAuthorizationStatus()).toBe('active')
    expect(request.mock.calls[1][1]).toMatchObject({ credentials: 'same-origin' })
  })
  it('retains identity after grant expiry and clears it only on confirmed revocation', async () => {
    request.mockResolvedValueOnce(new Response(JSON.stringify({ user, authorizationStatus: 'reauthentication_required' })))
    await service.initialize()
    expect(service.getCurrentUser()?.id).toBe(user.id)
    request.mockResolvedValueOnce(new Response(JSON.stringify({ user: null, authorizationStatus: 'revoked' })))
    await service.ensureInitialized()
    expect(service.getCurrentUser()).toBeNull()
  })
  it('does not restore identity when an earlier request resolves after explicit logout', async () => {
    let finish!: (value: Response) => void
    request.mockImplementationOnce(() => new Promise(resolve => { finish = resolve })).mockResolvedValue(new Response('{}'))
    const pending = service.initialize()
    await service.clearSessionForGlobalLogout()
    finish(new Response(JSON.stringify({ user, authorizationStatus: 'active' })))
    await pending
    expect(service.getCurrentUser()).toBeNull()
    expect(localStorage.getItem('email-cms-remembered-identity-v1')).toBeNull()
  })
  it('retries an offline logout before attempting session restoration on reload', async () => {
    localStorage.setItem('email-cms-pending-server-logout', '1')
    localStorage.setItem('email-cms-remembered-identity-v1', JSON.stringify(user))
    request.mockRejectedValue(new TypeError('offline'))
    await service.initialize()
    expect(service.getCurrentUser()).toBeNull()
    expect(request.mock.calls[0][0]).toBe('/api/session/logout')
    expect(localStorage.getItem('email-cms-pending-server-logout')).toBe('1')
  })
})
