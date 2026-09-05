import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createCmsMemoryStore } from '../helpers/cmsMemoryStore'
const holder = vi.hoisted(() => ({ store: null as ReturnType<typeof createCmsMemoryStore> | null }))
vi.mock('#/lib/supabase', () => ({ getSupabaseClient: () => ({ from: holder.store!.from }) }))
import { newsletterDeliveryService, validateRecipientEligibility } from '#/services/newsletterDeliveryService'
import { backendEmailPlatformService } from '#/services/emailPlatform/backendEmailPlatformService'
import { NewsletterDeliveryWorker } from '#/worker/deliveryWorker'
import type { SupabaseClient } from '#/lib/supabase'
beforeEach(() => { holder.store = createCmsMemoryStore(); vi.restoreAllMocks() })
describe('durable delivery with actual preparation and mocked provider handoff', () => {
  it('snapshots subscribed audience, queues, prepares personalized HTML and records Kit outcomes', async () => {
    const send = vi.spyOn(backendEmailPlatformService, 'sendNewsletter').mockImplementation(async input => ({ providerMessageId: 'kit-fixture', sentRecipientIds: input.recipients.map(r => r.recipientId), failedRecipients: [] }))
    const batch = await newsletterDeliveryService.createPublishBatch({ newsletterId: 'n1' })
    expect(holder.store!.rows('newsletter_delivery_jobs')).toHaveLength(1)
    const recipients = holder.store!.rows('newsletter_delivery_batch_recipients')
    expect(recipients.find(row => row.family_id === 'pending-family')).toMatchObject({ eligibility_status: 'ineligible', send_status: 'skipped' })
    const worker = new NewsletterDeliveryWorker({ port: 8787, corsOrigin: '', workerId: 'fixture', workerBatchSize: 3, workerPollIntervalMs: 5000 }, { from: holder.store!.from } as unknown as SupabaseClient)
    expect(await worker.runOnce()).toBe(1)
    expect(holder.store!.rows('newsletter_delivery_jobs')[0].last_error).toBeNull()
    expect(recipients.find(row => row.family_id === 'f1')).toMatchObject({ preparation_status: 'ready', failure_reason: null })
    expect(send).toHaveBeenCalledOnce()
    expect(send.mock.calls[0][0].recipients).toHaveLength(1)
    expect(send.mock.calls[0][0].recipients[0].htmlContent).toContain('Original note')
    expect(recipients.find(row => row.family_id === 'f1')).toMatchObject({ send_status: 'sent', provider_message_id: 'kit-fixture', preparation_status: 'ready' })
    expect(holder.store!.rows('newsletter_delivery_jobs')[0].status).toBe('succeeded')
    expect((await newsletterDeliveryService.fetchBatch(batch.id)).sentRecipients).toBe(1)
  })
  it.each([undefined, 'pending', 'unsubscribed', 'bounced', 'complained'])('excludes consent state %s', status => {
    expect(validateRecipientEligibility({ is_active: true, classIds: ['C6'], newsletter_subscription_status: status })).toEqual({ eligible: false, reason: 'not_subscribed' })
  })
  it('compares PostgreSQL Date revisions with equivalent persisted timezone text', async () => {
    vi.spyOn(backendEmailPlatformService, 'sendNewsletter').mockImplementation(async input => ({ providerMessageId: 'kit-date', sentRecipientIds: input.recipients.map(r => r.recipientId), failedRecipients: [] }))
    holder.store!.rows('newsletters')[0].updated_at = new Date('2026-09-05T15:48:37.107Z')
    const batch = await newsletterDeliveryService.createPublishBatch({ newsletterId: 'n1' })
    holder.store!.rows('newsletter_delivery_batches')[0].pinned_newsletter_revision_id = '2026-09-05T23:48:37.107+08:00'
    await newsletterDeliveryService.processQueuedBatch(batch.id)
    expect((await newsletterDeliveryService.fetchBatch(batch.id)).sentRecipients).toBe(1)
  })
  it('still rejects a changed newsletter revision before provider handoff', async () => {
    const send = vi.spyOn(backendEmailPlatformService, 'sendNewsletter')
    holder.store!.rows('newsletters')[0].updated_at = new Date('2026-09-05T15:48:37.107Z')
    const batch = await newsletterDeliveryService.createPublishBatch({ newsletterId: 'n1' })
    holder.store!.rows('newsletters')[0].updated_at = new Date('2026-09-05T15:49:37.107Z')
    await expect(newsletterDeliveryService.processQueuedBatch(batch.id)).rejects.toThrow('pinned inputs mismatch')
    expect(send).not.toHaveBeenCalled()
  })
})
