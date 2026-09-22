import { createHmac, timingSafeEqual } from 'node:crypto'
import { query, withTransaction } from '#/lib/db'
import { runtimeEnvironment } from '#/runtime/environment'

// Svix signs the exact body, delivery ID, and attempt timestamp. Multiple v1
// signatures are valid during signing-key rotation.
export function verifyResendSignature(body: string, headers: Headers, secret: string, now = Date.now()): boolean {
  const id = headers.get('svix-id')
  const timestamp = headers.get('svix-timestamp')
  if (!id || !timestamp || !/^\d+$/.test(timestamp) || Math.abs(now / 1000 - Number(timestamp)) > 300) return false
  if (!/^whsec_[A-Za-z0-9+/]+={0,2}$/.test(secret)) return false
  const expected = createHmac('sha256', Buffer.from(secret.slice(6), 'base64'))
    .update(`${id}.${timestamp}.${body}`).digest()
  return (headers.get('svix-signature') ?? '').split(/\s+/).some(value => {
    if (!value.startsWith('v1,')) return false
    const actual = Buffer.from(value.slice(3), 'base64')
    return actual.length === expected.length && timingSafeEqual(actual, expected)
  })
}

const eventTypes: Record<string, string> = {
  'email.delivered': 'email_delivered',
  'email.opened': 'email_open',
  'email.clicked': 'email_click',
}
const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value)

export async function handleResendWebhook(rawBody: string, headers: Headers): Promise<{ status: number; body: Record<string, unknown> }> {
  const secret = runtimeEnvironment().RESEND_WEBHOOK_SECRET
  if (!secret) return { status: 503, body: { error: 'Resend webhook is not configured' } }
  if (!verifyResendSignature(rawBody, headers, secret)) return { status: 401, body: { error: 'Invalid webhook signature' } }
  let payload: unknown
  try { payload = JSON.parse(rawBody) } catch { return { status: 400, body: { error: 'Invalid JSON' } } }
  if (!isRecord(payload) || typeof payload.type !== 'string') return { status: 400, body: { error: 'Invalid event' } }
  const eventType = Object.hasOwn(eventTypes, payload.type) ? eventTypes[payload.type] : undefined
  if (!eventType) return { status: 200, body: { ignored: true } }
  const data = payload.data
  if (!isRecord(data) || typeof data.email_id !== 'string' || !data.email_id ||
      typeof payload.created_at !== 'string' || !Number.isFinite(Date.parse(payload.created_at))) {
    return { status: 400, body: { error: 'Invalid event data' } }
  }
  const eventId = headers.get('svix-id')!
  try {
    return await withTransaction(async () => {
      // Lock/deduplicate at the database boundary; receipt and analytics commit together.
      const receipt = await query(`INSERT INTO public.resend_webhook_events
        (event_id, email_id, event_type, occurred_at, payload) VALUES ($1, $2, $3, $4, $5::jsonb)
        ON CONFLICT (event_id) DO NOTHING RETURNING event_id`,
      [eventId, data.email_id, payload.type, payload.created_at, JSON.stringify(payload)])
      if (!receipt.rows.length) return { status: 200, body: { accepted: true, duplicate: true } }
      const recipients = await query<{ id: string; batch_id: string; parent_id: string | null; newsletter_id: string; journey_correlation_id: string }>(`
        SELECT r.id, r.batch_id, r.parent_id, r.journey_correlation_id, b.newsletter_id
        FROM public.newsletter_delivery_batch_recipients r
        JOIN public.newsletter_delivery_batches b ON b.id = r.batch_id
        WHERE r.provider_message_id = $1 LIMIT 2`, [data.email_id])
      // A provider event can beat send-response persistence. Roll back the receipt
      // and return 503 so Resend retries; never attribute by email address or tags.
      if (recipients.rows.length !== 1 || !recipients.rows[0].parent_id) throw new Error('Unresolved email ID')
      const recipient = recipients.rows[0]
      const click = isRecord(data.click) ? data.click : undefined
      await query(`INSERT INTO public.analytics_events
        (user_id, newsletter_id, event_type, metadata, created_at) VALUES ($1, $2, $3, $4::jsonb, $5)`,
      [recipient.parent_id, recipient.newsletter_id, eventType, JSON.stringify({
        source: 'resend', provider_message_id: data.email_id, provider_event_id: eventId,
        batch_id: recipient.batch_id, recipient_id: recipient.id,
        journey_correlation_id: recipient.journey_correlation_id,
        target_url: typeof click?.link === 'string' ? click.link : undefined,
      }), payload.created_at])
      return { status: 200, body: { accepted: true, duplicate: false } }
    })
  } catch {
    // No recipient data, payloads, secrets, or signed URLs in logs/responses.
    console.error('Resend webhook persistence failed; provider retry required')
    return { status: 503, body: { error: 'Event could not be processed; retry required' } }
  }
}
