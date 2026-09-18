import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createCmsMemoryStore } from '../helpers/cmsMemoryStore'
const holder = vi.hoisted(() => ({ store: null as ReturnType<typeof createCmsMemoryStore> | null, query: vi.fn(), identity: null as { directory: () => Promise<unknown>; contacts: () => Promise<unknown[]>; sessionId?: string } | null }))
vi.mock('#/lib/supabase', () => ({ getSupabaseClient: () => ({ from: holder.store!.from }) }))
vi.mock('#/lib/db', () => ({ query: holder.query }))
vi.mock('#/session/http', () => ({ deliveryIdentityForSessionHash: async () => holder.identity }))
import { newsletterDeliveryService, validateRecipientEligibility } from '#/services/newsletterDeliveryService'
import { backendEmailPlatformService } from '#/services/emailPlatform/backendEmailPlatformService'
import { NewsletterDeliveryWorker } from '#/worker/deliveryWorker'
import type { SupabaseClient } from '#/lib/supabase'
import { withIdentityDirectory } from '#/services/identityDirectory'
beforeEach(() => { holder.store = createCmsMemoryStore(); holder.store.rows('newsletter_family_preferences').push({ family_id: 'pending-family', auth_family_id: 'pending-family', newsletter_subscription_status: 'pending' }); vi.restoreAllMocks(); holder.query.mockResolvedValue({ rows: [] }); vi.stubEnv('JWT_SECRET', 'synthetic-tracking-secret-for-tests') })
const identityContext = {
  directory: async () => {
    const store = holder.store!
    const enrollments = store.rows('student_class_enrollment')
    const familyIds = [...new Set(enrollments.map(row => String(row.family_id)))]
    const classIds = [...new Set(enrollments.map(row => String(row.class_id)))]
    return {
      people: enrollments.map(row => ({ id: String(row.student_id), displayName: 'Fixture Student', kind: 'student' as const })),
      families: familyIds.map(id => ({ id, code: id, displayName: id })),
      classes: classIds.map(id => ({ id, code: id, displayName: id })),
      familyMemberships: enrollments.map(row => ({ familyId: String(row.family_id), personId: String(row.student_id), relationship: 'child' as const })),
      classMemberships: enrollments.map(row => ({ personId: String(row.student_id), classId: String(row.class_id), relationship: 'student' as const })),
    }
  },
  contacts: async () => {
    const store = holder.store!
    return store.rows('family_enrollment').map(row => {
      const parent = store.rows('user_roles').find(user => user.id === row.parent_id)
      return { personId: String(row.parent_id), displayName: 'Fixture Parent', email: String(parent?.email ?? ''), families: [{ familyId: String(row.family_id), familyCode: String(row.family_id), classIds: [], classCodes: [] }] }
    }).filter(contact => contact.email)
  },
  sessionId: 'delivery-fixture',
}
const identityIt = (name: string, test: () => unknown) => it(name, () => withIdentityDirectory(identityContext, test))
beforeEach(() => { holder.identity = identityContext })
describe('durable delivery with actual preparation and mocked provider handoff', () => {
  identityIt('retains an accepted Resend email when a later parent times out in the actual worker path', async () => {
    holder.store!.rows('family_enrollment').push({ family_id: 'f1', parent_id: 'p3' })
    holder.store!.rows('user_roles').push({ id: 'p3', email: 'second@example.test' })
    const firstEmail = holder.store!.rows('user_roles').find(row => row.id === 'p1')!.email
    vi.stubEnv('DELIVERY_ENABLED', 'true')
    vi.stubEnv('NEWSLETTER_TEST_RECIPIENTS', `${firstEmail},second@example.test`)
    vi.stubEnv('RESEND_API_KEY', 're_fixture')
    vi.stubEnv('RESEND_FROM_EMAIL', 'school@example.test')
    const send = vi.fn().mockResolvedValueOnce(Response.json({ id: 'resend-first' })).mockRejectedValueOnce(new Error('second timeout'))
    vi.stubGlobal('fetch', send)
    try {
      const batch = await newsletterDeliveryService.createPublishBatch({ newsletterId: 'n1', audience: { mode: 'family', familyId: 'f1' } })
      await expect(newsletterDeliveryService.processQueuedBatch(batch.id)).rejects.toThrow('second timeout')
      const recipients = holder.store!.rows('newsletter_delivery_batch_recipients')
      expect(recipients.find(row => row.parent_id === 'p1')).toMatchObject({ send_status: 'sent', provider_message_id: 'resend-first' })
      expect(recipients.find(row => row.parent_id === 'p3')).toMatchObject({ send_status: 'handoff_pending' })
      await expect(newsletterDeliveryService.processQueuedBatch(batch.id)).rejects.toThrow('Provider outcome is uncertain')
      expect(send).toHaveBeenCalledTimes(2)
    } finally { vi.unstubAllGlobals(); vi.unstubAllEnvs() }
  })

  identityIt('does not repeat completed sends or automatically retry an uncertain provider handoff', async () => {
    const send = vi.spyOn(backendEmailPlatformService, 'sendNewsletter').mockRejectedValue(new Error('Provider timeout'))
    const batch = await newsletterDeliveryService.createPublishBatch({ newsletterId: 'n1', audience: { mode: 'family', familyId: 'f1' } })
    await expect(newsletterDeliveryService.processQueuedBatch(batch.id)).rejects.toThrow('Provider timeout')
    await expect(newsletterDeliveryService.processQueuedBatch(batch.id)).rejects.toThrow('Provider outcome is uncertain')
    expect(send).toHaveBeenCalledOnce()
    holder.store!.rows('newsletter_delivery_batches')[0].state = 'completed'
    await newsletterDeliveryService.processQueuedBatch(batch.id)
    expect(send).toHaveBeenCalledOnce()
  })

  identityIt('counts two parents separately without multiplying recipients for siblings or repeated memberships', async () => {
    holder.store!.rows('family_enrollment').push({ family_id: 'f1', parent_id: 'p3' }, { family_id: 'f1', parent_id: 'p1' })
    holder.store!.rows('user_roles').push({ id: 'p3', email: 'second@example.test' })
    holder.store!.rows('student_class_enrollment').push({ family_id: 'f1', student_id: 's3', class_id: 'C4', graduated_at: null })
    const preview = await newsletterDeliveryService.previewAudience({ mode: 'classes', classIds: ['C6', 'C4'] })
    expect(preview).toMatchObject({ totalCandidates: 2, eligibleCount: 1, eligibleRecipientCount: 2, ineligibleCount: 1, exclusionReasons: { not_subscribed: 1 } })
    const batch = await newsletterDeliveryService.createPublishBatch({ newsletterId: 'n1', audience: { mode: 'family', familyId: 'f1' } })
    expect(batch.totalRecipients).toBe(2)
    expect(batch.eligibleRecipients).toBe(2)
  })

  identityIt('uses the reviewed template revision even when the active template changes before processing', async () => {
    const send = vi.spyOn(backendEmailPlatformService, 'sendNewsletter').mockImplementation(async input => ({ providerMessageId: 'kit-pinned', sentRecipientIds: input.recipients.map(r => r.recipientId), failedRecipients: [] }))
    const batch = await newsletterDeliveryService.createPublishBatch({ newsletterId: 'n1', audience: { mode: 'family', familyId: 'f1' }, templateRevisionId: 'template-v1' })
    holder.store!.rows('email_templates')[0].current_revision_id = 'template-v2'
    holder.store!.rows('email_template_revisions').push({ id: 'template-v2', template_id: 'template', subject_template: 'Changed', body_template: '<p>Wrong revision</p>' })
    await newsletterDeliveryService.processQueuedBatch(batch.id)
    expect(send.mock.calls[0][0].recipients[0].htmlContent).toContain('Hello')
    expect(send.mock.calls[0][0].recipients[0].htmlContent).not.toContain('Wrong revision')
    expect(batch.selectedFamilyIds).toEqual(['f1'])
  })

  identityIt('rejects an empty audience before creating jobs or batches', async () => {
    await expect(newsletterDeliveryService.createPublishBatch({ newsletterId: 'n1', audience: { mode: 'classes', classIds: ['C4'] } })).rejects.toThrow('No eligible parents')
    expect(holder.store!.rows('newsletter_delivery_batches')).toHaveLength(0)
    expect(holder.store!.rows('newsletter_delivery_jobs')).toHaveLength(0)
  })

  identityIt('snapshots subscribed audience, queues, prepares personalized HTML and records Resend outcomes', async () => {
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
  identityIt('retries only the requested batch instead of consuming other queued newsletters', async () => {
    holder.store!.rows('newsletter_delivery_jobs').push(
      { id: 'target-job', batch_id: 'target-batch', job_type: 'prepare_batch', status: 'queued', attempts: 0, max_attempts: 3, run_after: '2020-01-01T00:00:00Z', created_at: '2020-01-01T00:00:00Z' },
      { id: 'other-job', batch_id: 'other-batch', job_type: 'prepare_batch', status: 'queued', attempts: 0, max_attempts: 3, run_after: '2020-01-01T00:00:00Z', created_at: '2020-01-01T00:00:00Z' },
    )
    const process = vi.spyOn(newsletterDeliveryService, 'processQueuedBatch').mockResolvedValue({ id: 'target-batch' } as never)
    const worker = new NewsletterDeliveryWorker({ port: 8787, corsOrigin: '', workerId: 'fixture', workerBatchSize: 3, workerPollIntervalMs: 5000 }, { from: holder.store!.from } as unknown as SupabaseClient)

    expect(await worker.runBatchOnce('target-batch')).toBe(1)
    expect(process).toHaveBeenCalledWith('target-batch')
    expect(holder.store!.rows('newsletter_delivery_jobs').find(row => row.id === 'target-job')).toMatchObject({ status: 'succeeded' })
    expect(holder.store!.rows('newsletter_delivery_jobs').find(row => row.id === 'other-job')).toMatchObject({ status: 'queued' })
  })
  it.each([undefined, 'pending', 'unsubscribed', 'bounced', 'complained'])('excludes consent state %s', status => {
    expect(validateRecipientEligibility({ is_active: true, classIds: ['C6'], newsletter_subscription_status: status })).toEqual({ eligible: false, reason: 'not_subscribed' })
  })
  identityIt('compares PostgreSQL Date revisions with equivalent persisted timezone text', async () => {
    vi.spyOn(backendEmailPlatformService, 'sendNewsletter').mockImplementation(async input => ({ providerMessageId: 'kit-date', sentRecipientIds: input.recipients.map(r => r.recipientId), failedRecipients: [] }))
    holder.store!.rows('newsletters')[0].updated_at = new Date('2026-09-05T15:48:37.107Z')
    const batch = await newsletterDeliveryService.createPublishBatch({ newsletterId: 'n1' })
    holder.store!.rows('newsletter_delivery_batches')[0].pinned_newsletter_revision_id = '2026-09-05T23:48:37.107+08:00'
    await newsletterDeliveryService.processQueuedBatch(batch.id)
    expect((await newsletterDeliveryService.fetchBatch(batch.id)).sentRecipients).toBe(1)
  })
  identityIt('still rejects a changed newsletter revision before provider handoff', async () => {
    const send = vi.spyOn(backendEmailPlatformService, 'sendNewsletter')
    holder.store!.rows('newsletters')[0].updated_at = new Date('2026-09-05T15:48:37.107Z')
    const batch = await newsletterDeliveryService.createPublishBatch({ newsletterId: 'n1' })
    holder.store!.rows('newsletters')[0].updated_at = new Date('2026-09-05T15:49:37.107Z')
    await expect(newsletterDeliveryService.processQueuedBatch(batch.id)).rejects.toThrow('pinned inputs mismatch')
    expect(send).not.toHaveBeenCalled()
  })
})
