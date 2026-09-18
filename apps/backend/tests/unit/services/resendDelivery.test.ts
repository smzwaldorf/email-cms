import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createCmsMemoryStore } from '../../helpers/cmsMemoryStore'
const holder = vi.hoisted(() => ({ store: null as ReturnType<typeof createCmsMemoryStore> | null }))
vi.mock('#/lib/supabase', () => ({ getSupabaseClient: () => ({ from: holder.store!.from }) }))
import { backendEmailPlatformService } from '#/services/emailPlatform/backendEmailPlatformService'
const request = { batchId: 'batch', newsletterId: 'newsletter', recipients: [
  { recipientId: 'r1', familyId: 'f1', parentEmail: 'one@example.test', subject: 'One', htmlContent: '<p>Class one</p>' },
  { recipientId: 'r2', familyId: 'f2', parentEmail: 'two@example.test', subject: 'Two', htmlContent: '<p>Class two</p>' },
] }
beforeEach(() => {
  holder.store = createCmsMemoryStore()
  holder.store.rows('newsletter_delivery_batch_recipients').push(...request.recipients.map(r => ({ id: r.recipientId, batch_id: 'batch', send_status: 'handoff_pending' })))
  vi.stubEnv('DELIVERY_ENABLED', 'true')
  vi.stubEnv('NEWSLETTER_TEST_RECIPIENTS', 'one@example.test,two@example.test')
  vi.stubEnv('RESEND_API_KEY', 're_fixture')
  vi.stubEnv('RESEND_FROM_EMAIL', 'School <school@example.test>')
})
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals() })
describe('Resend newsletter delivery', () => {
  it('sends isolated HTML with stable per-recipient idempotency keys and persists individual IDs', async () => {
    const send = vi.fn().mockResolvedValueOnce(Response.json({ id: 'email-one' })).mockResolvedValueOnce(Response.json({ id: 'email-two' }))
    vi.stubGlobal('fetch', send)
    const result = await backendEmailPlatformService.sendNewsletter(request)
    expect(result.provider).toBe('resend')
    expect(result.providerMessageIds).toEqual({ r1: 'email-one', r2: 'email-two' })
    for (let i = 0; i < 2; i++) {
      const [url, init] = send.mock.calls[i]
      expect(url).toBe('https://api.resend.com/emails')
      expect(init.headers['Idempotency-Key']).toBe(`newsletter/batch/r${i + 1}`)
      expect(JSON.parse(init.body)).toMatchObject({ to: [request.recipients[i].parentEmail], html: request.recipients[i].htmlContent })
      expect(holder.store!.rows('newsletter_delivery_batch_recipients')[i]).toMatchObject({ send_status: 'sent', provider_message_id: i === 0 ? 'email-one' : 'email-two' })
    }
  })
  it('preserves acceptance when a later request times out', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(Response.json({ id: 'email-one' })).mockRejectedValueOnce(new Error('timeout')))
    await expect(backendEmailPlatformService.sendNewsletter(request)).rejects.toThrow('timeout')
    expect(holder.store!.rows('newsletter_delivery_batch_recipients')[0]).toMatchObject({ send_status: 'sent', provider_message_id: 'email-one' })
    expect(holder.store!.rows('newsletter_delivery_batch_recipients')[1].send_status).toBe('handoff_pending')
  })
  it('returns explicit rejections without claiming acceptance or exposing provider response details', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ message: 'private recipient' }, { status: 422 })))
    const result = await backendEmailPlatformService.sendNewsletter(request)
    expect(result.sent).toBe(false)
    expect(result.failedRecipients).toEqual([{ recipientId: 'r1', error: 'resend_http_422' }, { recipientId: 'r2', error: 'resend_http_422' }])
  })
  it('blocks the whole request before network access when one address is not allowed', async () => {
    vi.stubEnv('NEWSLETTER_TEST_RECIPIENTS', 'one@example.test')
    const send = vi.fn(); vi.stubGlobal('fetch', send)
    await expect(backendEmailPlatformService.sendNewsletter(request)).rejects.toThrow()
    expect(send).not.toHaveBeenCalled()
  })
  it('requires Resend configuration even when legacy Kit credentials exist', async () => {
    vi.stubEnv('RESEND_API_KEY', '')
    vi.stubEnv('KIT_API_TOKEN', 'legacy')
    const send = vi.fn(); vi.stubGlobal('fetch', send)
    await expect(backendEmailPlatformService.sendNewsletter(request)).rejects.toThrow('RESEND_API_KEY')
    expect(send).not.toHaveBeenCalled()
  })
})
