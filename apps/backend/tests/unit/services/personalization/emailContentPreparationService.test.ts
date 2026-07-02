import { describe, expect, it } from 'vitest'

import {
  arePreparationOutputsDeterministic,
  emailContentPreparationService,
} from '@/services/emailContentPreparationService'
import type { PrepareEmailContentInput } from '@/types/emailPreparation'

function createBaseInput(overrides: Partial<PrepareEmailContentInput> = {}): PrepareEmailContentInput {
  return {
    rulesVersion: 'v1',
    startedAt: '2026-03-22T08:00:00.000Z',
    snapshotCapturedAt: '2026-03-22T08:00:00.000Z',
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
      bodyTemplate: 'Newsletter {{newsletter.revisionId}} for {{classes.list}}',
    },
    guardians: [
      {
        guardianId: 'guardian-1',
        guardianEmail: 'guardian.one@example.com',
        firstName: 'Mei',
        lastName: 'Chen',
        parentType: 'mother',
        familyId: 'family-1',
        children: [{ studentId: 'student-1', classId: 'A' }],
      },
    ],
    ...overrides,
  }
}

describe('emailContentPreparationService', () => {
  it('builds deterministic outputs for identical pinned inputs', async () => {
    const first = await emailContentPreparationService.prepare(createBaseInput())
    const second = await emailContentPreparationService.prepare(createBaseInput())

    expect(first.pinnedInputs.newsletterRevisionId).toBe('news-rev-1')
    expect(first.pinnedInputs.templateRevisionId).toBe('tmpl-rev-1')
    expect(first.pinnedInputs.recipientSnapshotCapturedAt).toBe('2026-03-22T08:00:00.000Z')
    expect(first.deterministicHash).toBe(second.deterministicHash)
    expect(arePreparationOutputsDeterministic(first, second)).toBe(true)
    expect(first.recipients).toEqual(second.recipients)
  })

  it('marks recipients failed for unsupported tokens, malformed syntax, missing sections, and missing required values', async () => {
    const result = await emailContentPreparationService.prepare(
      createBaseInput({
        template: {
          templateId: 'template-1',
          templateRevisionId: 'tmpl-rev-1',
          subjectTemplate: 'Hello {{bad.token}} {{guardian.email',
          bodyTemplate: '',
        },
        guardians: [
          {
            guardianId: 'guardian-failed',
            guardianEmail: 'failed@example.com',
            familyId: null,
            children: [{ studentId: 'student-1', classId: 'A' }],
          },
        ],
      }),
    )

    const recipient = result.recipients[0]
    expect(recipient.status).toBe('failed')
    expect(recipient.findings.map((finding) => finding.code)).toEqual(
      expect.arrayContaining([
        'unsupported_token',
        'malformed_token_syntax',
        'missing_required_section',
      ]),
    )
  })

  it('returns preview for a selected recipient and exposes findings', async () => {
    const result = await emailContentPreparationService.prepare(createBaseInput())
    const preview = emailContentPreparationService.getRecipientPreview(result.jobId, 'guardian-1')

    expect(preview.subject).toContain('guardian.one@example.com')
    expect(preview.body).toContain('news-rev-1')
    expect(preview.status).toBe('ready')
    expect(preview.findings).toEqual([])
  })

  it('exposes prepared identity fields and class article excerpts for Kit merge sync', async () => {
    const result = await emailContentPreparationService.prepare(createBaseInput())
    const recipient = result.recipients[0]

    expect(recipient.kitMergeData.identity).toEqual({ firstName: 'Mei', lastName: 'Chen' })
    expect(recipient.kitMergeData.stableMetadata).toEqual({
      parentType: 'mother',
      childClasses: ['Grade 1A'],
      childNames: ['student-1'],
    })
    expect(recipient.kitMergeData.classArticleExcerptSets).toEqual([
      {
        classId: 'A',
        excerpts: [
          {
            blockId: 'class-A-1',
            title: null,
            excerpt: 'Class content',
            editorialOrder: 1,
            personalizationKey: 'block:class-A-1',
            classId: 'A',
          },
        ],
      },
    ])
  })

  it('fails preparation when the pinned template html is incompatible', async () => {
    const result = await emailContentPreparationService.prepare(
      createBaseInput({
        template: {
          templateId: 'template-1',
          templateRevisionId: 'tmpl-rev-imported',
          subjectTemplate: 'Hello {{guardian.email}}',
          bodyTemplate: `
            <html>
              <head><style>.hero { color: red; }</style></head>
              <body><table><tr><td>Imported</td></tr></table></body>
            </html>
          `,
        },
      }),
    )

    const recipient = result.recipients[0]
    expect(recipient.status).toBe('failed')
    expect(recipient.findings.map((finding) => finding.code)).toContain('incompatible_template_html')
  })

  it('produces review summary counts and actionable errors', async () => {
    const result = await emailContentPreparationService.prepare(
      createBaseInput({
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
            familyId: null,
            children: [{ studentId: 'student-2', classId: 'A' }],
          },
        ],
        template: {
          templateId: 'template-1',
          templateRevisionId: 'tmpl-rev-1',
          subjectTemplate: 'Hello {{guardian.email}}',
          bodyTemplate: 'Family {{family.id}}',
        },
      }),
    )

    const summary = emailContentPreparationService.getReviewSummary(result.jobId)
    expect(summary.readyRecipients).toBe(1)
    expect(summary.failedRecipients).toBe(1)
    expect(summary.actionableErrors.length).toBeGreaterThan(0)
    expect(summary.actionableErrors[0]?.detailRef).toContain('guardian:')
  })
})
