import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { IncomingMessage } from 'node:http'
const { query } = vi.hoisted(() => ({ query: vi.fn() }))
vi.mock('#/lib/db', () => ({ query, withClient: (fn: (client: { query: typeof query }) => unknown) => fn({ query }) }))
import { directoryFamiliesForToken, directoryForToken, requireAdmin, requireViewer, verifySmzAccessToken } from '#/auth'
const context = { sub: 'person-1', clientId: 'email-cms', access: 'active', roles: ['parent'], classScopes: { parent: ['G4'], teacher: [], effective: ['G4'] } }
const userInfo = { sub: 'person-1', email: 'Parent@Example.com', email_verified: true }
function mockIdentity(directory: unknown = context, status = 200, user: unknown = userInfo, families: unknown = [{ id: 'identity-family', code: 'F1', displayName: 'Identity family' }]) {
  vi.stubGlobal('fetch', vi.fn((url: string) => Promise.resolve(new Response(JSON.stringify(
    url.includes('access-context') ? directory : url.includes('/me/directory') ? (families === null ? { directory: {} } : { directory: {
      people: [], families, classes: [], familyMemberships: [], classMemberships: [],
    } }) : user,
  ), { status: url.includes('access-context') ? status : 200 }))))
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
  it('uses the exact scoped directory URL and returns only family catalogue fields', async () => {
    const families = await directoryFamiliesForToken('token')
    expect(families).toEqual([{ id: 'identity-family', code: 'F1', displayName: 'Identity family' }])
    expect(vi.mocked(fetch).mock.calls.map(([url]) => String(url))).toContain('http://localhost:3000/api/directory/v1/me/directory')
  })
  it('validates and returns the internal scoped directory graph', async () => {
    mockIdentity(context, 200, userInfo, [{ id: 'identity-family', code: 'F1', displayName: 'Identity family' }])
    await expect(directoryForToken('token')).resolves.toMatchObject({
      families: [{ id: 'identity-family', code: 'F1' }],
      people: [],
      classes: [],
      familyMemberships: [],
      classMemberships: [],
    })
  })
  it('allows a valid empty family directory', async () => {
    mockIdentity(context, 200, userInfo, [])
    await expect(directoryFamiliesForToken('token')).resolves.toEqual([])
  })
  it.each([
    ['missing family collection', null],
    ['non-array family collection', {}],
    ['malformed family entry', [{ id: 'f1', code: 'F1' }]],
  ])('rejects a %s rather than treating it as an empty directory', async (_label, families) => {
    mockIdentity(context, 200, userInfo, families)
    await expect(directoryFamiliesForToken('token')).rejects.toMatchObject({
      status: 502,
      code: 'identity_invalid_directory_response',
    })
  })
  it.each([401, 403, 503])('does not return directory families when central access is %i', async status => {
    mockIdentity({}, status)
    await expect(directoryFamiliesForToken('token')).rejects.toMatchObject({ status })
  })
  it('keeps historical actor references but never local profile authority', async () => {
    query.mockImplementation((sql:string) => Promise.resolve({rows:sql.includes('INSERT INTO user_auth_identities') ? [{user_id:'legacy-actor'}] : []}))
    await expect(requireAdmin(request)).rejects.toMatchObject({status:403})
    expect(await requireViewer(request)).toMatchObject({id:'legacy-actor',email:'parent@example.com',role:'parent',roles:['parent']})
    expect(query.mock.calls.every(([sql]) => !/user_roles|FROM classes|lower\(email\)/.test(sql))).toBe(true)
  })
  it('uses verified subject for new actor association without email merging', async () => {
    query.mockImplementation((sql:string) => Promise.resolve({rows:sql.includes('INSERT INTO user_auth_identities') ? [{user_id:'person-1'}] : []}))
    expect(await requireViewer(request)).toMatchObject({id:'person-1',roles:['parent']})
    expect(query).toHaveBeenCalledWith(expect.stringContaining('ON CONFLICT (issuer,subject)'), ['http://localhost:3000/api/auth','person-1','person-1'])
    expect(query.mock.calls.every(([sql]) => !/user_roles|lower\(email\)/.test(sql))).toBe(true)
  })
  it('fails closed when association cannot be established', async () => {
    query.mockResolvedValue({rows:[]})
    await expect(requireViewer(request)).rejects.toMatchObject({status:403})
  })
})
