/** Opt-in cross-project contract test. Run only against smz-auth's disposable CMS bridge. */
import { readFileSync } from 'node:fs'
import { createServer, type Server } from 'node:http'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { createCmsMemoryStore, type Row } from '../helpers/cmsMemoryStore'
interface Bridge { issuer: string; resource: string; parentTeacherAccessToken: string; adminAccessToken: string; controlUrl: string; controlSecret: string }
const h = vi.hoisted(() => ({ store: null as ReturnType<typeof createCmsMemoryStore> | null }))
vi.mock('#/lib/supabase', () => ({ getSupabaseClient: () => ({ from: h.store!.from, auth: { getUser: async () => ({ data: { user: null } }) } }) }))
vi.mock('#/lib/db', () => {
  const query = async (sql: string, values: unknown[] = []) => {
    if (sql.includes('FROM user_auth_identities')) return { rows: [{ id: `local-${values[1]}`, email: 'linked@example.test', role: 'admin', display_name: 'Linked data anchor' }] }
    if (sql.includes('FROM classes')) return { rows: h.store!.rows('classes').filter(row => (values[0] as string[]).includes(row.class_code as string)) }
    if (sql.includes('SELECT * FROM articles')) return { rows: h.store!.rows('articles').filter(row => row.id === values[0]) }
    if (sql.includes('SELECT status, is_template')) return { rows: h.store!.rows('newsletters').filter(row => row.id === values[0]) }
    if (sql.startsWith('UPDATE articles')) {
      const row = h.store!.rows('articles').find(row => row.id === values[0])!
      for (const match of sql.matchAll(/"(title|content|summary|author)" = \$(\d+)/g)) row[match[1]] = values[Number(match[2]) - 1]
      return { rows: [row] }
    }
    return { rows: [] }
  }
  return { withClient: (fn: (client: { query: typeof query }) => unknown) => fn({ query }), withTransaction: (fn: (client: { query: typeof query }) => unknown) => fn({ query }) }
})
import { handleApiRequest } from '#/routes'
import { backendEmailPlatformService } from '#/services/emailPlatform/backendEmailPlatformService'
import { NewsletterDeliveryWorker } from '#/worker/deliveryWorker'
import type { SupabaseClient } from '#/lib/supabase'
const fixturePath = process.env.SMZ_CMS_BRIDGE_FIXTURE
let bridge: Bridge
let server: Server
let base: string
async function control(body: Row) {
  const response = await fetch(bridge.controlUrl, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${bridge.controlSecret}` }, body: JSON.stringify(body) })
  expect(response.ok).toBe(true)
}
async function call(path: string, token: string, body?: unknown, method = body === undefined ? 'GET' : 'POST') {
  const response = await fetch(`${base}${path}`, { method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) })
  return { status: response.status, body: await response.json() }
}
describe.skipIf(!fixturePath)('real SMZ Auth -> CMS HTTP -> preparation -> provider fixture', () => {
  beforeAll(async () => {
    bridge = JSON.parse(readFileSync(fixturePath!, 'utf8'))
    await control({ action: 'reset' })
    bridge = JSON.parse(readFileSync(fixturePath!, 'utf8'))
    process.env.SMZ_AUTH_ISSUER = bridge.issuer
    process.env.KIT_API_TOKEN = 'fixture-not-a-real-provider-key'
    process.env.KIT_WEBHOOK_SECRET = 'fixture-webhook-secret'
    h.store = createCmsMemoryStore()
    server = createServer((req, res) => { void handleApiRequest(req, res, { supabase: { from: h.store!.from } as unknown as SupabaseClient, corsOrigin: 'http://localhost:5174' }) })
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
    const address = server.address()
    if (!address || typeof address === 'string') throw new Error('Missing test server address')
    base = `http://127.0.0.1:${address.port}`
  })
  afterAll(async () => { if (bridge) await control({ action: 'reset' }); if (server) await new Promise<void>(resolve => server.close(() => resolve())); vi.restoreAllMocks() })
  it('uses real token and directory facts for session, class visibility and authorized article edit', async () => {
    const token = bridge.parentTeacherAccessToken
    const session = await call('/api/auth/session', token)
    expect(session.status).toBe(200)
    expect(session.body.user).toMatchObject({ roles: ['teacher', 'parent'], teacherClassIds: ['C6'], parentClassIds: ['C4'] })
    expect((await call('/api/cms/articles/a1', token)).status).toBe(200)
    expect((await call('/api/cms/articles/a1', token, { content: '<p>Updated by live teacher</p>' }, 'PATCH')).status).toBe(200)
    expect((await call('/api/cms/articles/a1', token, { status: 'published' }, 'PATCH')).status).toBe(400)
    expect((await call('/api/admin/newsletters/n1/publish-and-deliver', token, {})).status).toBe(403)
    await control({ action: 'roles', roles: ['parent'] })
    expect((await call('/api/cms/articles/a1', token, { title: 'Denied' }, 'PATCH')).status).toBe(403)
    expect((await call('/api/cms/articles/a1', token)).status).toBe(404)
    await control({ action: 'roles', roles: ['parent', 'teacher'] })
  }, 20_000)
  it('denies revoked, changed class and unavailable live directory without stale grants', async () => {
    const token = bridge.parentTeacherAccessToken
    await control({ action: 'classScopes', parentClassEnabled: true, teacherClassEnabled: false })
    expect((await call('/api/cms/articles/a1', token)).status).toBe(404)
    await control({ action: 'classScopes', parentClassEnabled: true, teacherClassEnabled: true })
    await control({ action: 'revoke' })
    expect((await call('/api/auth/session', token)).status).toBe(403)
    await control({ action: 'restore' })
    await control({ action: 'outage', enabled: true })
    expect((await call('/api/auth/session', token)).status).toBe(503)
    await control({ action: 'outage', enabled: false })
    expect((await call('/api/auth/session', token)).status).toBe(200)
    expect((await call('/api/auth/session', 'invalid-fixture-token')).status).toBe(401)
  }, 20_000)
  it('publishes through HTTP, queues and prepares actual payloads then records mocked Kit delivery', async () => {
    const send = vi.spyOn(backendEmailPlatformService, 'sendNewsletter').mockImplementation(async input => ({ providerMessageId: 'kit-fixture', sentRecipientIds: input.recipients.map(r => r.recipientId), failedRecipients: [] }))
    const published = await call('/api/admin/newsletters/n1/publish-and-deliver', bridge.adminAccessToken, {})
    expect(published.status).toBe(202)
    expect(h.store!.rows('newsletter_delivery_jobs')).toHaveLength(1)
    const worker = new NewsletterDeliveryWorker({ port: 8787, corsOrigin: '', workerId: 'joint-fixture', workerBatchSize: 3, workerPollIntervalMs: 5000 }, { from: h.store!.from } as unknown as SupabaseClient)
    expect(await worker.runOnce()).toBe(1)
    expect(send).toHaveBeenCalledOnce()
    const recipient = send.mock.calls[0][0].recipients[0]
    expect(recipient.htmlContent).toContain('Updated by live teacher')
    expect(recipient.htmlContent).toContain('/week/2026-W36/article-one')
    expect(send.mock.calls[0][0].recipients).toHaveLength(1)
    expect(h.store!.rows('newsletter_delivery_batch_recipients').find(row => row.family_id === 'f1')).toMatchObject({ send_status: 'sent', provider_message_id: 'kit-fixture' })
    expect((await call('/api/admin/newsletters/n1/publish-and-deliver', bridge.adminAccessToken, {})).status).toBe(409)
    // Actual callback route and verifier; missing secret cannot mutate event history.
    expect((await call('/api/webhooks/kit', '', { type: 'subscriber.subscribe' })).status).toBe(401)
    expect(h.store!.rows('email_platform_webhook_events')).toHaveLength(0)
    const callback = () => fetch(`${base}/api/webhooks/kit`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'x-kit-webhook-secret': 'fixture-webhook-secret', 'x-kit-event-id': 'joint-event-1' },
      body: JSON.stringify({ subscriber: { id: 'unmapped-fixture-subscriber' } }),
    })
    const accepted = await callback()
    expect(accepted.status).toBe(200)
    expect(await accepted.json()).toMatchObject({ accepted: true, duplicate: false })
    const duplicate = await callback()
    expect(await duplicate.json()).toMatchObject({ accepted: true, duplicate: true })
    expect(h.store!.rows('email_platform_webhook_events')).toHaveLength(1)
    expect(h.store!.rows('email_platform_webhook_events')[0].status).toBe('unresolved')
  })
})
