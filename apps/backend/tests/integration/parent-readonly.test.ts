/** Real CMS auth/policy/routes with only the central HTTP and PostgreSQL boundaries stubbed. */
import { Readable } from 'node:stream'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
const state = vi.hoisted(() => ({
  roles: ['parent'], linked: false,
  article: { id: 'article-1', title: 'Published article', content: '<p>Read only</p>', status: 'published', visibility_type: 'public', restricted_to_classes: null as string[] | null },
  query: vi.fn(),
}))
vi.mock('#/lib/db', () => ({
  query: state.query,
  withClient: (fn: (client: { query: typeof state.query }) => unknown) => fn({ query: state.query }),
  withTransaction: (fn: (client: { query: typeof state.query }) => unknown) => fn({ query: state.query }),
}))
import { handleApiRequest } from '#/routes'
import { getSupabaseClient } from '#/lib/supabase'
async function call(path: string, method = 'GET', body: unknown = {}) {
  const req = Readable.from([JSON.stringify(body)]) as IncomingMessage
  Object.assign(req, { url: path, method, headers: { authorization: 'Bearer central-test-token' } })
  let status = 0; let payload = ''
  const res = { writeHead: (code: number) => { status = code }, end: (value: string) => { payload = value } } as unknown as ServerResponse
  await handleApiRequest(req, res, { supabase: getSupabaseClient(), corsOrigin: 'http://localhost:5174' })
  return { status, body: JSON.parse(payload) }
}
beforeEach(() => {
  state.roles = ['parent']; state.linked = true
  Object.assign(state.article, { title: 'Published article', status: 'published', visibility_type: 'public', restricted_to_classes: null })
  state.query.mockReset().mockImplementation(async (sql: string, values: unknown[] = []) => {
    const local = { id: 'local-person', email: 'synthetic-parent@example.test', role: 'admin', display_name: 'Stale local role' }
    if (sql.includes('FROM user_auth_identities')) return { rows: state.linked ? [local] : [] }
    if (sql.includes('WHERE lower(email)')) return { rows: [] }
    if (sql.includes('INSERT INTO user_roles')) return { rows: [{ ...local, id: values[0], role: 'student' }] }
    if (sql.includes('INSERT INTO user_auth_identities')) { state.linked = true; return { rows: [{ user_id: values[2] }], rowCount: 1 } }
    if (sql.includes('SELECT * FROM articles')) return { rows: [{ ...state.article }] }
    if (sql.startsWith('UPDATE articles')) return { rows: [{ ...state.article, title: values[1] }] }
    return { rows: [], rowCount: 0 }
  })
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    if (url.includes('/access-context')) return new Response(JSON.stringify({ sub: 'synthetic-parent', clientId: 'email-cms', access: 'active', roles: state.roles, classScopes: { parent: [], teacher: [], effective: [] } }), { status: 200 })
    if (url.includes('/me/directory')) return new Response(JSON.stringify({ directory: { people: [{ id: 'synthetic-parent', displayName: 'Synthetic Parent', kind: 'adult' }], families: [], classes: [], familyMemberships: [], classMemberships: [] } }), { status: 200 })
    return new Response(JSON.stringify({ sub: 'synthetic-parent', email: 'synthetic-parent@example.test', email_verified: true }), { status: 200 })
  }))
})
afterEach(() => vi.unstubAllGlobals())
describe('synthetic identities use ordinary CMS authorization', () => {
  it('anchors a new verified identity and ignores the local compatibility role', async () => {
    state.linked = false
    const session = await call('/api/auth/session')
    expect(session.status).toBe(200)
    expect(session.body.user).toMatchObject({ role: 'parent', roles: ['parent'] })
    expect(state.query.mock.calls.some(([sql]) => sql.includes('INSERT INTO user_auth_identities'))).toBe(true)
  })
  it('allows a parent to read published public content but hides drafts and other-class content', async () => {
    expect((await call('/api/cms/articles/article-1')).status).toBe(200)
    state.article.status = 'draft'
    expect((await call('/api/cms/articles/article-1')).status).toBe(404)
    Object.assign(state.article, { status: 'published', visibility_type: 'class_restricted', restricted_to_classes: ['OTHER'] })
    expect((await call('/api/cms/articles/article-1')).status).toBe(404)
  })
  it.each([
    ['/api/admin/rpc', 'POST', { service: 'admin', method: 'fetchNewsletters', args: [] }],
    ['/api/admin/newsletters/n1/publish-and-deliver', 'POST', {}],
    ['/api/data/query', 'POST', { table: 'articles', mutation: { type: 'update', payload: { title: 'denied' } } }],
    ['/api/data/query', 'POST', { table: 'media_files', mutation: { type: 'insert', payload: { name: 'denied' } } }],
    ['/api/cms/articles/article-1', 'PATCH', { title: 'denied' }],
    ['/api/cms/articles/article-1/publish', 'POST', {}],
  ])('denies parent operation %s without business writes', async (path, method, body) => {
    expect((await call(path as string, method as string, body)).status).toBe(403)
    expect(state.query.mock.calls.filter(([sql]) => /^\s*(UPDATE|INSERT|DELETE)\b/.test(sql) && !/^\s*INSERT INTO user_auth_identities\b/.test(sql))).toHaveLength(0)
  })
  it('uses live central roles when switching admin to parent, retaining no dev privilege', async () => {
    state.roles = ['admin']
    expect((await call('/api/cms/articles/article-1', 'PATCH', { title: 'allowed' })).status).toBe(200)
    state.query.mockClear(); state.roles = ['parent']
    expect((await call('/api/cms/articles/article-1', 'PATCH', { title: 'denied' })).status).toBe(403)
    expect(state.query.mock.calls.some(([sql]) => sql.startsWith('UPDATE articles'))).toBe(false)
  })
})
