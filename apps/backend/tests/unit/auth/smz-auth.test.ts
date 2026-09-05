import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { IncomingMessage } from 'node:http'
const { query } = vi.hoisted(() => ({ query: vi.fn() }))
vi.mock('#/lib/db', () => ({ withClient: (fn: (client: { query: typeof query }) => unknown) => fn({ query }) }))
import { requireAdmin, requireViewer, verifySmzAccessToken } from '#/auth'
const context = { sub: 'person-1', clientId: 'email-cms', access: 'active', roles: ['parent'], classScopes: { parent: ['G4'], teacher: [], effective: ['G4'] } }
const userInfo = { sub: 'person-1', email: 'Parent@Example.com', email_verified: true }
function mockIdentity(directory: unknown = context, status = 200, user: unknown = userInfo) {
  vi.stubGlobal('fetch', vi.fn((url: string) => Promise.resolve(new Response(JSON.stringify(url.includes('access-context') ? directory : user), { status: url.includes('access-context') ? status : 200 }))))
}
const request = { headers: { authorization: 'Bearer token' } } as IncomingMessage
beforeEach(() => { query.mockReset(); mockIdentity() })
afterEach(() => vi.unstubAllGlobals())
describe('central authentication authority', () => {
  it('retains live roles and scopes and binds issuer/subject', async () => {
    expect(await verifySmzAccessToken('token')).toMatchObject({ subject: 'person-1', verifiedEmail: 'parent@example.com', roles: ['parent'], classScopes: context.classScopes })
  })
  it.each([401, 403, 503])('preserves central %i without local fallback', async status => {
    mockIdentity({}, status)
    await expect(requireViewer(request)).rejects.toMatchObject({ status })
    expect(query).not.toHaveBeenCalled()
  })
  it.each([
    { ...context, clientId: 'vite-app' }, { ...context, sub: 'other' },
    { ...context, classScopes: undefined }, { ...context, roles: 'admin' },
  ])('rejects mismatched or malformed context', async malformed => {
    mockIdentity(malformed)
    await expect(verifySmzAccessToken('token')).rejects.toMatchObject({ status: 401 })
  })
  it('maps network failure to availability', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))
    await expect(verifySmzAccessToken('token')).rejects.toMatchObject({ status: 503 })
  })
  it('never restores local admin privileges after central role downgrade', async () => {
    query.mockImplementation((sql: string) => Promise.resolve({ rows: sql.includes('FROM user_auth_identities')
      ? [{ id: 'local', email: 'old@example.com', role: 'admin', display_name: null }]
      : sql.includes('FROM classes') ? [{ id: 'A1', class_code: 'G4' }] : [] }))
    await expect(requireAdmin(request)).rejects.toMatchObject({ status: 403 })
    const viewer = await requireViewer(request)
    expect(viewer).toMatchObject({ id: 'local', role: 'parent', roles: ['parent'], parentClassIds: ['A1'], teacherClassIds: [] })
  })
  it('provisions an admitted new identity without a local admission gate', async () => {
    let linked = false
    query.mockImplementation((sql: string) => {
      if (sql.includes('INSERT INTO user_auth_identities')) linked = true
      return Promise.resolve({ rows: sql.includes('INSERT INTO user_roles') || (linked && sql.includes('FROM user_auth_identities'))
        ? [{ id: 'new-local', email: 'parent@example.com', role: 'student', display_name: null }] : [] })
    })
    expect(await requireViewer(request)).toMatchObject({ id: 'new-local', roles: ['parent'] })
    expect(query.mock.calls.some(([sql]) => sql.includes('COMMIT'))).toBe(true)
  })
  it('rejects conflicting links without replacing them', async () => {
    query.mockImplementation((sql: string) => Promise.resolve({ rows: sql.includes('WHERE lower(email)')
      ? [{ id: 'existing', email: 'parent@example.com', role: 'admin' }] : [] }))
    await expect(requireViewer(request)).rejects.toMatchObject({ status: 403 })
    expect(query.mock.calls.some(([sql]) => sql === 'ROLLBACK')).toBe(true)
  })
})
