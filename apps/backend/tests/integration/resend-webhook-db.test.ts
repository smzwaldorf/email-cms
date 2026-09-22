import { Client } from 'pg'
import { createHmac } from 'node:crypto'
import { beforeAll, afterAll, describe, expect, it, vi } from 'vitest'
import '#/env'
const state = vi.hoisted(() => ({ client: null as Client | null }))
vi.mock('#/lib/db', () => ({
  query: (sql: string, values: unknown[]) => state.client!.query(sql.replaceAll('public.', 'pg_temp.'), values),
  withTransaction: async (fn: () => Promise<unknown>) => {
    await state.client!.query('BEGIN')
    try { const result = await fn(); await state.client!.query('COMMIT'); return result }
    catch (error) { await state.client!.query('ROLLBACK'); throw error }
  },
}))
import { handleResendWebhook } from '#/services/resendWebhookService'
const secret = `whsec_${Buffer.from('isolated-fixture').toString('base64')}`
const local = (() => { try { return ['127.0.0.1', 'localhost'].includes(new URL(process.env.DATABASE_URL!).hostname) } catch { return false } })()
describe.skipIf(process.env.RUN_RESEND_DB_TESTS !== 'true' || !local)('Resend atomic persistence in PostgreSQL temporary tables', () => {
  beforeAll(async () => {
    vi.stubEnv('RESEND_WEBHOOK_SECRET', secret)
    state.client = new Client({ connectionString: process.env.DATABASE_URL }); await state.client.connect()
    await state.client.query(`
      CREATE TEMP TABLE resend_webhook_events (event_id text PRIMARY KEY, email_id text, event_type text, occurred_at timestamptz, payload jsonb);
      CREATE TEMP TABLE newsletter_delivery_batches (id uuid, newsletter_id uuid);
      CREATE TEMP TABLE newsletter_delivery_batch_recipients (id uuid, batch_id uuid, parent_id uuid, journey_correlation_id text, provider_message_id text);
      CREATE TEMP TABLE analytics_events (user_id uuid, newsletter_id uuid, event_type text, metadata jsonb, created_at timestamptz);
      INSERT INTO newsletter_delivery_batches VALUES ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002');
    `)
  })
  afterAll(async () => { await state.client?.end(); vi.unstubAllEnvs() })
  const send = (id: string, type: string) => {
    const raw = JSON.stringify({ type, created_at: '2026-09-22T08:00:00Z', data: { email_id: 'provider-email' } })
    const timestamp = String(Math.floor(Date.now() / 1000))
    const signature = createHmac('sha256', Buffer.from(secret.slice(6), 'base64')).update(`${id}.${timestamp}.${raw}`).digest('base64')
    return handleResendWebhook(raw, new Headers({ 'svix-id': id, 'svix-timestamp': timestamp, 'svix-signature': `v1,${signature}` }))
  }
  it('rolls back unresolved receipts, retries after ID persistence, and deduplicates replay', async () => {
    expect((await send('open-1', 'email.opened')).status).toBe(503)
    expect((await state.client!.query('SELECT * FROM resend_webhook_events')).rows).toHaveLength(0)
    await state.client!.query(`INSERT INTO newsletter_delivery_batch_recipients VALUES
      ('00000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000004', 'journey', 'provider-email')`)
    expect((await send('open-1', 'email.opened')).status).toBe(200)
    expect((await send('open-1', 'email.opened')).body.duplicate).toBe(true)
    expect((await send('delivery-1', 'email.delivered')).status).toBe(200)
    const events = (await state.client!.query('SELECT * FROM analytics_events')).rows
    expect(events).toHaveLength(2)
    expect(events[0].newsletter_id).toBe('00000000-0000-4000-8000-000000000002')
    expect(events[0].metadata.source).toBe('resend')
  })
  it('rolls back the receipt if analytics insertion fails', async () => {
    await state.client!.query("ALTER TABLE analytics_events ADD CONSTRAINT reject_click CHECK (event_type <> 'email_click')")
    expect((await send('click-1', 'email.clicked')).status).toBe(503)
    expect((await state.client!.query("SELECT * FROM resend_webhook_events WHERE event_id = 'click-1'")).rows).toHaveLength(0)
    await state.client!.query('ALTER TABLE analytics_events DROP CONSTRAINT reject_click')
    expect((await send('click-1', 'email.clicked')).status).toBe(200)
  })
})
