import { createHmac } from 'node:crypto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
const db = vi.hoisted(() => ({ query: vi.fn(), transaction: vi.fn() }))
vi.mock('#/lib/db', () => ({ query: db.query, withTransaction: db.transaction }))
import { handleResendWebhook, verifyResendSignature } from '#/services/resendWebhookService'
const secret = `whsec_${Buffer.from('fixture-webhook-secret').toString('base64')}`
function signed(body: string, timestamp = String(Math.floor(Date.now() / 1000))) {
  const signature = createHmac('sha256', Buffer.from(secret.slice(6), 'base64')).update(`msg_1.${timestamp}.${body}`).digest('base64')
  return new Headers({ 'svix-id': 'msg_1', 'svix-timestamp': timestamp, 'svix-signature': `v1,invalid v1,${signature}` })
}
const body = (type = 'email.opened') => JSON.stringify({ type, created_at: '2026-09-22T08:00:00Z', data: { email_id: 'email_1', click: { link: 'https://school.test/article/one' } } })
beforeEach(() => {
  vi.stubEnv('RESEND_WEBHOOK_SECRET', secret)
  db.query.mockReset(); db.transaction.mockReset()
  db.transaction.mockImplementation(fn => fn())
  db.query.mockResolvedValueOnce({ rows: [{ event_id: 'msg_1' }] })
    .mockResolvedValueOnce({ rows: [{ id: 'recipient', batch_id: 'batch', parent_id: 'parent', newsletter_id: 'newsletter', journey_correlation_id: 'journey' }] })
    .mockResolvedValueOnce({ rows: [] })
})
afterEach(() => vi.unstubAllEnvs())
describe('Resend webhook', () => {
  it('matches the published Svix signature test vector', () => {
    const headers = new Headers({ 'svix-id': 'msg_loFOjxBNrRLzqYUf', 'svix-timestamp': '1731705121', 'svix-signature': 'v1,rAvfW3dJ/X/qxhsaXPOyyCGmRKsaKWcsNccKXlIktD0=' })
    expect(verifyResendSignature('{"event_type":"ping","data":{"success":true}}', headers, 'whsec_plJ3nmyCDGBKInavdOK15jsl', 1731705121000)).toBe(true)
  })
  it.each(['email.delivered', 'email.opened', 'email.clicked'])('attributes %s using saved provider ID and original event time', async type => {
    const raw = body(type)
    expect((await handleResendWebhook(raw, signed(raw))).status).toBe(200)
    expect(db.transaction).toHaveBeenCalledOnce()
    const args = db.query.mock.calls[2][1]
    expect(args.slice(0, 2)).toEqual(['parent', 'newsletter'])
    expect(args[2]).toBe({ 'email.delivered': 'email_delivered', 'email.opened': 'email_open', 'email.clicked': 'email_click' }[type])
    expect(JSON.parse(args[3])).toMatchObject({ source: 'resend', recipient_id: 'recipient', provider_message_id: 'email_1' })
    expect(args[4]).toBe('2026-09-22T08:00:00Z')
  })
  it('rejects body tampering, missing headers, expired and future timestamps before touching DB', async () => {
    for (const [raw, headers] of [
      [body() + ' ', signed(body())], [body(), new Headers()],
      [body(), signed(body(), String(Math.floor(Date.now() / 1000) - 301))],
      [body(), signed(body(), String(Math.floor(Date.now() / 1000) + 601))],
    ] as const) expect((await handleResendWebhook(raw, headers)).status).toBe(401)
    expect(db.query).not.toHaveBeenCalled()
  })
  it('fails closed when the secret is missing', async () => {
    vi.stubEnv('RESEND_WEBHOOK_SECRET', '')
    expect((await handleResendWebhook(body(), signed(body()))).status).toBe(503)
    expect(db.query).not.toHaveBeenCalled()
  })
  it('acknowledges duplicate deliveries without inserting analytics twice', async () => {
    db.query.mockReset().mockResolvedValue({ rows: [] })
    expect((await handleResendWebhook(body(), signed(body()))).body.duplicate).toBe(true)
    expect(db.query).toHaveBeenCalledOnce()
  })
  it.each([[], [{ parent_id: 'a' }, { parent_id: 'b' }], [{ parent_id: null }]])('retries unresolved or ambiguous attribution', async rows => {
    db.query.mockReset().mockResolvedValueOnce({ rows: [{ event_id: 'msg_1' }] }).mockResolvedValueOnce({ rows })
    expect((await handleResendWebhook(body(), signed(body()))).status).toBe(503)
    expect(db.query).toHaveBeenCalledTimes(2)
  })
  it('retries transaction failures', async () => {
    db.transaction.mockRejectedValue(new Error('database unavailable'))
    expect((await handleResendWebhook(body(), signed(body()))).status).toBe(503)
  })
  it('ignores unsupported events and rejects malformed supported events', async () => {
    const ignored = body('email.sent')
    expect((await handleResendWebhook(ignored, signed(ignored))).body.ignored).toBe(true)
    const malformed = '{"type":"email.opened","data":{}}'
    expect((await handleResendWebhook(malformed, signed(malformed))).status).toBe(400)
    expect(db.query).not.toHaveBeenCalled()
  })
})
