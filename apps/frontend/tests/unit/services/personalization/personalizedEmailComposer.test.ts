import { describe, expect, it } from 'vitest'

import { renderTemplateForRecipient } from '@/services/emailTemplateRenderer'
import { renderEmailTemplatePreview } from '@/services/emailTemplateTokens'
import { composePersonalizedEmails } from '@/services/personalizedEmailComposer'
import type { ComposePersonalizedEmailInput } from '@/types/personalization'

function createBaseInput(overrides: Partial<ComposePersonalizedEmailInput> = {}): ComposePersonalizedEmailInput {
  return {
    rulesVersion: 'v1',
    snapshotCapturedAt: '2026-03-20T08:00:00.000Z',
    classes: [
      { id: 'A', classCode: 'A1', className: 'Grade 1A', canonicalSortKey: '01-A' },
      { id: 'B', classCode: 'B1', className: 'Grade 1B', canonicalSortKey: '02-B' },
    ],
    newsletter: {
      newsletterId: 'newsletter-1',
      newsletterRevisionId: 'rev-42',
      sharedBlocks: [
        { blockId: 'shared-2', content: 'Shared two', editorialOrder: 2 },
        { blockId: 'shared-1', content: 'Shared one', editorialOrder: 1 },
      ],
      classBlocks: [
        { blockId: 'a-2', classId: 'A', content: 'Class A two', editorialOrder: 2 },
        { blockId: 'a-1', classId: 'A', content: 'Class A one', editorialOrder: 1 },
        { blockId: 'b-1', classId: 'B', content: 'Class B one', editorialOrder: 1 },
      ],
    },
    guardians: [
      {
        guardianId: 'guardian-1',
        guardianEmail: 'guardian.one@example.com',
        familyId: 'family-1',
        children: [{ studentId: 'student-1', studentName: 'Alice', classId: 'A' }],
      },
    ],
    ...overrides,
  }
}

describe('composePersonalizedEmails', () => {
  it('resolves shared and class blocks for a single-child guardian', () => {
    const result = composePersonalizedEmails(createBaseInput())
    const payload = result.payloads[0]

    expect(payload.sharedBlocks.map((block) => block.blockId)).toEqual(['shared-1', 'shared-2'])
    expect(payload.classBlocks.map((block) => block.blockId)).toEqual(['a-1', 'a-2'])
    expect(payload.classFallback).toBe('none')
  })

  it('sorts classes canonically and deduplicates class blocks by personalization key', () => {
    const input = createBaseInput({
      guardians: [
        {
          guardianId: 'guardian-1',
          guardianEmail: 'guardian.one@example.com',
          children: [
            { studentId: 'student-1', classId: 'B' },
            { studentId: 'student-2', classId: 'A' },
          ],
        },
      ],
      newsletter: {
        newsletterId: 'newsletter-1',
        newsletterRevisionId: 'rev-42',
        sharedBlocks: [{ blockId: 'shared-1', content: 'Shared', editorialOrder: 1 }],
        classBlocks: [
          {
            blockId: 'b-dup',
            classId: 'B',
            content: 'Duplicate block from B',
            editorialOrder: 1,
            personalizationKey: 'dup-key',
          },
          {
            blockId: 'a-dup',
            classId: 'A',
            content: 'Duplicate block from A',
            editorialOrder: 1,
            personalizationKey: 'dup-key',
          },
          {
            blockId: 'b-2',
            classId: 'B',
            content: 'Unique B',
            editorialOrder: 2,
          },
        ],
      },
    })

    const result = composePersonalizedEmails(input)
    const payload = result.payloads[0]

    expect(payload.resolvedClassIds).toEqual(['A', 'B'])
    expect(payload.classBlocks.map((block) => block.blockId)).toEqual(['a-dup', 'b-2'])
  })

  it('returns deterministic fallback when no eligible class blocks are found', () => {
    const result = composePersonalizedEmails(
      createBaseInput({
        newsletter: {
          newsletterId: 'newsletter-1',
          newsletterRevisionId: 'rev-42',
          sharedBlocks: [{ blockId: 'shared-1', content: 'Shared', editorialOrder: 1 }],
          classBlocks: [{ blockId: 'class-c', classId: 'C', content: 'Class C', editorialOrder: 1 }],
        },
      }),
    )

    const payload = result.payloads[0]
    expect(payload.classBlocks).toHaveLength(0)
    expect(payload.classFallback).toBe('no_eligible_class_blocks')
  })

  it('freezes render-start membership snapshot in the output', () => {
    const input = createBaseInput()
    const result = composePersonalizedEmails(input)

    input.guardians[0].children.push({ studentId: 'student-2', classId: 'B' })

    expect(result.snapshot.guardians[0].children).toEqual([
      { studentId: 'student-1', studentName: 'Alice', classId: 'A' },
    ])
    expect(result.payloads[0].resolvedClassIds).toEqual(['A'])
  })

  it('generates stable metadata for identical inputs and rule versions', () => {
    const input = createBaseInput()
    const first = composePersonalizedEmails(input)
    const second = composePersonalizedEmails(input)

    expect(first.payloads[0].rules_version).toBe('v1')
    expect(second.payloads[0].rules_version).toBe('v1')
    expect(first.payloads[0].input_fingerprint).toBe(second.payloads[0].input_fingerprint)
    expect(first.payloads[0]).toEqual(second.payloads[0])
  })

  it('recomputes eligible classes from the latest membership snapshot on a new render', () => {
    const input = createBaseInput({
      guardians: [
        {
          guardianId: 'guardian-1',
          guardianEmail: 'guardian.one@example.com',
          children: [{ studentId: 'student-1', classId: 'A' }],
        },
      ],
      newsletter: {
        newsletterId: 'newsletter-1',
        newsletterRevisionId: 'rev-42',
        sharedBlocks: [{ blockId: 'shared-1', content: 'Shared', editorialOrder: 1 }],
        classBlocks: [
          { blockId: 'a-1', classId: 'A', content: 'Class A one', editorialOrder: 1 },
          { blockId: 'b-1', classId: 'B', content: 'Class B one', editorialOrder: 1 },
        ],
      },
    })

    const first = composePersonalizedEmails(input)
    expect(first.payloads[0].resolvedClassIds).toEqual(['A'])
    expect(first.payloads[0].classBlocks.map((block) => block.blockId)).toEqual(['a-1'])

    input.guardians[0].children.push({ studentId: 'student-2', classId: 'B' })

    const second = composePersonalizedEmails(input)
    expect(second.payloads[0].resolvedClassIds).toEqual(['A', 'B'])
    expect(second.payloads[0].classBlocks.map((block) => block.blockId)).toEqual(['a-1', 'b-1'])
  })

  it('surfaces explicit rules version changes in payload metadata', () => {
    const base = createBaseInput()
    const v1 = composePersonalizedEmails({ ...base, rulesVersion: 'v1' })
    const v2 = composePersonalizedEmails({ ...base, rulesVersion: 'v2' })

    expect(v1.payloads[0].rules_version).toBe('v1')
    expect(v2.payloads[0].rules_version).toBe('v2')
    expect(v1.payloads[0].input_fingerprint).not.toBe(v2.payloads[0].input_fingerprint)
  })

  it('emits warnings for missing class mappings and inconsistent memberships', () => {
    const result = composePersonalizedEmails(
      createBaseInput({
        classes: [{ id: 'A', className: 'Grade 1A' }],
        guardians: [
          {
            guardianId: 'guardian-1',
            guardianEmail: 'guardian.one@example.com',
            children: [
              { studentId: 'student-1', classId: 'A' },
              { studentId: 'student-2', classId: 'Z' },
              { studentId: 'student-3', classId: '' },
            ],
          },
        ],
      }),
    )

    expect(result.warnings.map((warning) => warning.code)).toEqual([
      'missing_class_mapping',
      'inconsistent_membership',
      'unknown_target_class',
    ])
  })

  it('includes article titles as bullet list in rendered body', () => {
    const result = composePersonalizedEmails(
      createBaseInput({
        newsletter: {
          newsletterId: 'newsletter-1',
          newsletterRevisionId: 'rev-42',
          sharedBlocks: [
            { blockId: 'shared-1', title: 'School Calendar', content: '<p>Details</p>', editorialOrder: 1 },
          ],
          classBlocks: [
            { blockId: 'a-1', classId: 'A', title: null, content: '<p>Class update</p>', editorialOrder: 2 },
          ],
        },
      }),
    )

    const body = result.payloads[0].renderedBody ?? ''
    expect(body).toContain('<h2>Articles in this newsletter</h2>')
    expect(body).toContain('<ul>')
    expect(body).toContain('<li>School Calendar</li>')
    expect(body).toContain('<li>Article 2</li>')
  })

  it('matches legacy body-template token expansion for a single custom-html block (backfill shape)', () => {
    const bodyTemplate = '<p>{{newsletter.id}} — {{classes.list}}</p>'
    const ctx = {
      guardian: { id: 'g1', email: 'a@b.com' },
      family: { id: 'f1' },
      newsletter: { id: 'n1', revisionId: 'r1' },
      classes: { ids: ['A', 'B'] },
    }
    const legacy = renderEmailTemplatePreview('', bodyTemplate, ctx).body
    const walker = renderTemplateForRecipient(
      [{ type: 'custom-html', order: 0, visible: true, bodyHtml: bodyTemplate, config: {} }],
      { templateContext: ctx, sharedArticles: [], classes: [], weeklyItems: [] },
      { wrapInDocumentShell: false },
    ).html
    expect(walker).toBe(legacy)
  })

  it('uses stable renderedHtmlFingerprint for identical block-based composition inputs', () => {
    const input = createBaseInput({
      newsletter: {
        newsletterId: 'newsletter-1',
        newsletterRevisionId: 'rev-42',
        sharedBlocks: [],
        classBlocks: [],
      },
      template: {
        templateId: 'template-1',
        templateRevisionId: 'tmpl-rev-1',
        subjectTemplate: 'Hello {{guardian.email}}',
        bodyTemplate: '<p>legacy body unused when blocks present</p>',
        blocks: [
          {
            type: 'custom-html',
            order: 0,
            visible: true,
            bodyHtml: '<p>{{guardian.email}}</p>',
            config: {},
          },
        ],
      },
    })
    const first = composePersonalizedEmails(input)
    const second = composePersonalizedEmails(input)
    expect(first.payloads[0].renderedHtmlFingerprint).toBe(second.payloads[0].renderedHtmlFingerprint)
    expect(first.payloads[0].renderedHtmlFingerprint).toMatch(/^html-[0-9a-f]{8}$/)
  })

  it('does not append legacy newsletter summary HTML when template blocks are present', () => {
    const withBlocks = composePersonalizedEmails(
      createBaseInput({
        template: {
          templateId: 't',
          templateRevisionId: 'tr',
          subjectTemplate: 'Subject',
          bodyTemplate: '',
          blocks: [
            {
              type: 'custom-html',
              order: 0,
              visible: true,
              bodyHtml: '<p>block only</p>',
              config: {},
            },
          ],
        },
      }),
    )
    expect(withBlocks.payloads[0].renderedBody ?? '').not.toContain('Articles in this newsletter')

    const legacyPath = composePersonalizedEmails(
      createBaseInput({
        template: {
          templateId: 't',
          templateRevisionId: 'tr',
          subjectTemplate: 'Subject',
          bodyTemplate: '<p>base</p>',
        },
      }),
    )
    expect(legacyPath.payloads[0].renderedBody ?? '').toContain('Articles in this newsletter')
  })
})
