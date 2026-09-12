import { Readable } from 'node:stream'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { beforeEach, describe, expect, it, vi } from 'vitest'
const m = vi.hoisted(() => ({ viewer: vi.fn(), admin: vi.fn(), runQuery: vi.fn(), publish: vi.fn(), createBatch: vi.fn(), edit: vi.fn(), webhook: vi.fn(), readiness: vi.fn(), lock: vi.fn() }))
vi.mock('#/lib/db', () => ({ withTransaction: (fn: (client: { query: typeof m.lock }) => unknown) => fn({ query: m.lock }) }))
vi.mock('#/auth', async () => ({ ...await vi.importActual<typeof import('#/auth')>('#/auth'), requireViewer: m.viewer, requireAdmin: m.admin }))
vi.mock('#/services/adminService', () => ({ adminService: { publishNewsletter: m.publish, getNewsletterPublishReadiness: m.readiness } }))
vi.mock('#/services/newsletterDeliveryService', () => ({ newsletterDeliveryService: { createPublishBatch: m.createBatch } }))
vi.mock('#/services/cmsArticleService', () => ({ cmsArticleService: { update: m.edit } }))
vi.mock('#/lib/query', () => ({ runSerializedQuery: m.runQuery, from: vi.fn() }))
vi.mock('#/services/emailPlatform/backendEmailPlatformService', () => ({ backendEmailPlatformService: { handleKitWebhook: m.webhook } }))
import { handleApiRequest } from '#/routes'
import { HttpError } from '#/auth'
import { getSupabaseClient } from '#/lib/supabase'
const actor = { id: 'local-admin', role: 'admin', roles: ['admin'], teacherClassIds: [], parentClassIds: [] }
async function call(path: string, body: unknown = {}, method = 'POST') {
  const req = Readable.from([JSON.stringify(body)]) as IncomingMessage
  req.url = path; req.method = method; req.headers = { authorization: 'Bearer fixture' }
  let status = 0; let result = ''
  const res = { writeHead: (code: number) => { status = code }, end: (data: string) => { result = data } } as unknown as ServerResponse
  await handleApiRequest(req, res, { supabase: getSupabaseClient(), corsOrigin: 'http://localhost:5174' })
  return { status, body: result ? JSON.parse(result) : null }
}
beforeEach(() => {
  vi.clearAllMocks(); m.viewer.mockResolvedValue(actor); m.admin.mockResolvedValue(actor); m.lock.mockResolvedValue({ rows: [{ status: 'draft', is_template: false }] }); m.readiness.mockResolvedValue({ canPublish: true, audienceSummary: {} })
})
describe('CMS HTTP boundary and publish handoff', () => {
  it('stops unauthenticated data access before query execution', async () => {
    m.admin.mockRejectedValue(new HttpError(401, 'Missing bearer token'))
    expect((await call('/api/data/query', { table: 'user_roles' })).status).toBe(401)
    expect(m.runQuery).not.toHaveBeenCalled()
  })
  it('blocks role writes, unknown tables and dynamic query method attacks', async () => {
    for (const body of [
      { table: 'user_roles', mutation: { type: 'update', payload: { role: 'admin' } } },
      { table: 'user_auth_identities' },
      { table: 'cms_browser_sessions' },
      { table: 'cms_login_flows' },
      { table: 'articles', filters: [{ op: 'delete', column: 'id', value: 'x' }] },
    ]) expect((await call('/api/data/query', body)).status).toBeGreaterThanOrEqual(400)
    expect(m.runQuery).not.toHaveBeenCalled()
  })
  it('denies unknown/internal RPC and legacy plain publication', async () => {
    for (const [service, method] of [['admin', 'getCurrentAuthUserId'], ['admin', 'publishNewsletter'], ['admin', 'updateUserAccessControl'], ['newsletterDelivery', 'processQueuedBatch']]) {
      expect((await call('/api/admin/rpc', { service, method, args: ['fixture'] })).status).toBe(403)
    }
    expect(m.publish).not.toHaveBeenCalled()
  })
  it('never widens an invalid audience selection to send-to-all', async () => {
    expect((await call('/api/admin/newsletters/n1/publish-and-deliver', { audience: { mode: 'typo' } })).status).toBe(400)
    expect((await call('/api/admin/newsletters/n1/publish-and-deliver', { audience: { mode: 'family' } })).status).toBe(400)
    expect(m.publish).not.toHaveBeenCalled()
  })
  it('denies teacher publication before CMS mutation', async () => {
    m.viewer.mockResolvedValue({ ...actor, roles: ['teacher'] })
    expect((await call('/api/admin/newsletters/n1/publish-and-deliver')).status).toBe(403)
    expect(m.publish).not.toHaveBeenCalled()
  })
  it('authorized publication hands audience to durable batch creation', async () => {
    m.publish.mockResolvedValue({ id: 'n1', status: 'published' }); m.createBatch.mockResolvedValue({ id: 'batch-1' })
    const result = await call('/api/admin/newsletters/n1/publish-and-deliver', { audience: { mode: 'family', familyId: 'f1' } })
    expect(result.status).toBe(202)
    expect(m.createBatch).toHaveBeenCalledWith({ newsletterId: 'n1', audience: expect.objectContaining({ mode: 'family', familyId: 'f1' }) })
    expect(m.publish.mock.invocationCallOrder[0]).toBeLessThan(m.createBatch.mock.invocationCallOrder[0])
  })
  it('rejects repeat publication and unavailable audience before writes', async () => {
    m.lock.mockResolvedValueOnce({ rows: [{ status: 'published', is_template: false }] })
    expect((await call('/api/admin/newsletters/n1/publish-and-deliver')).status).toBe(409)
    m.readiness.mockResolvedValueOnce({ canPublish: true })
    expect((await call('/api/admin/newsletters/n1/publish-and-deliver')).status).toBe(422)
    expect(m.publish).not.toHaveBeenCalled()
  })
  it('keeps provider sends outside public API and callbacks behind verifier', async () => {
    expect((await call('/api/admin/email-platform/kit-send-newsletter')).status).toBe(404)
    m.webhook.mockResolvedValue({ status: 401, body: { error: 'invalid secret' } })
    expect((await call('/api/webhooks/kit', { event: 'delivered' })).status).toBe(401)
    expect(m.webhook).toHaveBeenCalledWith(expect.objectContaining({ rawBody: '{"event":"delivered"}' }))
  })
})
