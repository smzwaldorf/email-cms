import { describe, expect, it } from 'vitest'

import { emailContentPreparationService } from '@/services/emailContentPreparationService'
import type { PrepareEmailContentInput } from '@/types/emailPreparation'

function createFlowInput(): PrepareEmailContentInput {
  return {
    rulesVersion: 'v1',
    startedAt: '2026-03-22T09:00:00.000Z',
    snapshotCapturedAt: '2026-03-22T09:00:00.000Z',
    classes: [{ id: 'A', className: 'Grade 1A', canonicalSortKey: '01' }],
    newsletter: {
      newsletterId: 'newsletter-1',
      newsletterRevisionId: 'news-rev-1',
      sharedBlocks: [{ blockId: 'shared-1', content: 'Shared content', editorialOrder: 1 }],
      classBlocks: [{ blockId: 'class-A-1', classId: 'A', content: 'Class content', editorialOrder: 1 }],
    },
    template: {
      templateId: 'template-1',
      templateRevisionId: 'tmpl-rev-1',
      subjectTemplate: 'Hello {{guardian.email}}',
      bodyTemplate: 'Family {{family.id}}',
    },
    guardians: [
      {
        guardianId: 'guardian-ready',
        guardianEmail: 'ready@example.com',
        familyId: 'family-ready',
        children: [{ studentId: 'student-1', classId: 'A' }],
      },
      {
        guardianId: 'guardian-warning',
        guardianEmail: 'warning@example.com',
        familyId: 'family-warning',
        children: [{ studentId: 'student-warning', classId: 'Z' }],
      },
      {
        guardianId: 'guardian-failed',
        guardianEmail: 'failed@example.com',
        familyId: null,
        children: [{ studentId: 'student-2', classId: 'A' }],
      },
    ],
  }
}

describe('email content preparation flow', () => {
  it('keeps mixed-outcome batches and hands off ready-only payloads', async () => {
    const job = await emailContentPreparationService.prepare(createFlowInput())
    const handoff = emailContentPreparationService.createDeliveryHandoff(job.jobId)

    expect(job.summary.readyRecipients).toBe(1)
    expect(job.summary.warningRecipients).toBe(1)
    expect(job.summary.failedRecipients).toBe(1)
    expect(handoff.readyPayloads).toHaveLength(1)
    expect(handoff.readyPayloads[0].guardianId).toBe('guardian-ready')
    expect(handoff.deliverablePayloads).toHaveLength(1)
    expect(handoff.nonReadyRecipients).toHaveLength(2)
    expect(handoff.failedRecipients).toHaveLength(1)
    expect(handoff.failedRecipients[0].guardianId).toBe('guardian-failed')
  })

  it('retries only previously failed recipients against new pinned inputs', async () => {
    const first = await emailContentPreparationService.prepare(createFlowInput())
    const retry = await emailContentPreparationService.retryFailedRecipients(first.jobId, {
      ...createFlowInput(),
      startedAt: '2026-03-22T10:00:00.000Z',
      newsletter: {
        ...createFlowInput().newsletter,
        newsletterRevisionId: 'news-rev-2',
      },
      template: {
        ...createFlowInput().template!,
        templateRevisionId: 'tmpl-rev-2',
      },
      guardians: [
        {
          guardianId: 'guardian-ready',
          guardianEmail: 'ready@example.com',
          familyId: 'family-ready',
          children: [{ studentId: 'student-1', classId: 'A' }],
        },
        {
          guardianId: 'guardian-failed',
          guardianEmail: 'failed@example.com',
          familyId: 'family-fixed',
          children: [{ studentId: 'student-2', classId: 'A' }],
        },
      ],
    })

    expect(retry.retryOfJobId).toBe(first.jobId)
    expect(retry.pinnedInputs.newsletterRevisionId).toBe('news-rev-2')
    expect(retry.pinnedInputs.templateRevisionId).toBe('tmpl-rev-2')
    expect(retry.recipients).toHaveLength(1)
    expect(retry.recipients[0].guardianId).toBe('guardian-failed')
    expect(retry.recipients[0].status).toBe('ready')
  })

  it('prepares block-based templates via the same composition path as apply-for-merge', async () => {
    const job = await emailContentPreparationService.prepare({
      ...createFlowInput(),
      template: {
        templateId: 'template-1',
        templateRevisionId: 'tmpl-rev-blocks',
        subjectTemplate: 'Hello {{guardian.email}}',
        bodyTemplate: '',
        blocks: [
          {
            type: 'custom-html',
            order: 0,
            visible: true,
            bodyHtml: '<p>Family {{family.id}} · {{newsletter.id}}</p>',
            config: {},
          },
        ],
      },
    })

    const ready = job.recipients.filter((r) => r.status === 'ready')
    expect(ready).toHaveLength(1)
    const body = ready[0].payload.renderedBody ?? ''
    expect(body).toContain('family-ready')
    expect(body).toContain('newsletter-1')
    expect(body).not.toContain('Articles in this newsletter')
  })
})
