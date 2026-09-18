import { describe, expect, it } from 'vitest'

import { mapAuthPreviewFamilyToCms, resolveAuthPreviewFamily } from '#/services/authDirectoryPreview'
import { composePersonalizedEmails } from '#/services/personalizedEmailComposer'
import type { SmzDirectoryGraph } from '#/auth'

const directory: SmzDirectoryGraph = {
  people: [
    { id: 'parent-a', displayName: 'Parent A', kind: 'adult' },
    { id: 'student-a', displayName: 'Student A', kind: 'student' },
    { id: 'parent-b', displayName: 'Parent B', kind: 'adult' },
    { id: 'student-b', displayName: 'Student B', kind: 'student' },
  ],
  families: [
    { id: 'auth-family-a', code: 'F-A', displayName: 'Family A' },
    { id: 'auth-family-b', code: 'F-B', displayName: 'Family B' },
  ],
  classes: [
    { id: 'auth-class-a', code: 'A1', displayName: 'Class A' },
    { id: 'auth-class-b', code: 'B1', displayName: 'Class B' },
  ],
  familyMemberships: [
    { familyId: 'auth-family-a', personId: 'parent-a', relationship: 'guardian' },
    { familyId: 'auth-family-a', personId: 'student-a', relationship: 'child' },
    { familyId: 'auth-family-b', personId: 'parent-b', relationship: 'guardian' },
    { familyId: 'auth-family-b', personId: 'student-b', relationship: 'child' },
  ],
  classMemberships: [
    { classId: 'auth-class-a', personId: 'student-a', relationship: 'student' },
    { classId: 'auth-class-b', personId: 'student-b', relationship: 'student' },
  ],
}

const cmsClasses = [
  { id: 'cms-class-a', class_code: 'A1', class_name: 'Class A', is_active: true },
  { id: 'cms-class-b', class_code: 'B1', class_name: 'Class B', is_active: true },
]

const newsletter = {
  newsletterId: 'newsletter-2025-W47',
  newsletterRevisionId: 'revision-1',
  sharedBlocks: [{ blockId: 'shared', title: 'Shared', content: 'shared-marker', url: 'https://example.test/shared', editorialOrder: 1 }],
  classBlocks: [
    { blockId: 'class-a', classId: 'cms-class-a', title: 'Class A', content: 'class-a-marker', url: 'https://example.test/class-a', editorialOrder: 2 },
    { blockId: 'class-b', classId: 'cms-class-b', title: 'Class B', content: 'class-b-marker', url: 'https://example.test/class-b', editorialOrder: 3 },
  ],
}

function renderForFamily(familyId: string, template?: Parameters<typeof composePersonalizedEmails>[0]['template']): string {
  const scope = resolveAuthPreviewFamily(directory, familyId)
  if (!scope) throw new Error(`Missing fixture family ${familyId}`)
  const mapped = mapAuthPreviewFamilyToCms(scope, cmsClasses)
  const result = composePersonalizedEmails({
    rulesVersion: 'v1',
    newsletter,
    template,
    classes: cmsClasses.map((schoolClass) => ({
      id: schoolClass.id,
      classCode: schoolClass.class_code,
      className: schoolClass.class_name,
      canonicalSortKey: schoolClass.class_code,
    })),
    guardians: [{
      guardianId: mapped.guardianId,
      guardianEmail: 'preview@example.invalid',
      familyId,
      children: mapped.children,
    }],
  })
  return result.payloads[0]?.renderedBody ?? ''
}

describe('Auth-backed preview directory scope', () => {
  it('keeps shared content for both paired families and excludes the other class in fallback rendering', () => {
    const familyABody = renderForFamily('auth-family-a')
    const familyBBody = renderForFamily('auth-family-b')

    for (const body of [familyABody, familyBBody]) expect(body).toContain('shared-marker')
    expect(familyABody).toContain('class-a-marker')
    expect(familyABody).not.toContain('class-b-marker')
    expect(familyABody).not.toContain('https://example.test/class-b')
    expect(familyBBody).toContain('class-b-marker')
    expect(familyBBody).not.toContain('class-a-marker')
    expect(familyBBody).not.toContain('https://example.test/class-a')
  })

  it('keeps the same Auth class boundary for block-template rendering', () => {
    const template = {
      templateId: 'template-1',
      templateRevisionId: 'template-revision-1',
      subjectTemplate: 'Preview',
      bodyTemplate: '',
      blocks: [
        { type: 'shared-article-feature' as const, order: 0, visible: true, bodyHtml: '<a href="{{article.url}}">{{article.title}} {{article.excerpt}}</a>', config: { maxItems: 10 } },
        { type: 'class-article-feature' as const, order: 1, visible: true, bodyHtml: '<a href="{{article.url}}">{{class.code}} {{article.title}} {{article.excerpt}}</a>', config: { maxItemsPerClass: 10 } },
      ],
    }
    const familyABody = renderForFamily('auth-family-a', template)
    const familyBBody = renderForFamily('auth-family-b', template)

    for (const body of [familyABody, familyBBody]) expect(body).toContain('shared-marker')
    expect(familyABody).toContain('class-a-marker')
    expect(familyABody).not.toContain('class-b-marker')
    expect(familyABody).not.toContain('https://example.test/class-b')
    expect(familyBBody).toContain('class-b-marker')
    expect(familyBBody).not.toContain('class-a-marker')
    expect(familyBBody).not.toContain('https://example.test/class-a')
  })

  it('validates foreign targets against the catalogue without widening family entitlement', () => {
    const scope = resolveAuthPreviewFamily(directory, 'auth-family-b')
    if (!scope) throw new Error('Missing fixture family B')
    const mapped = mapAuthPreviewFamilyToCms(scope, cmsClasses)
    const result = composePersonalizedEmails({
      rulesVersion: 'v1',
      newsletter: {
        ...newsletter,
        classBlocks: [
          ...newsletter.classBlocks,
          { blockId: 'unknown', classId: 'cms-class-unknown', title: 'Unknown', content: 'unknown-marker', url: 'https://example.test/unknown', editorialOrder: 4 },
        ],
      },
      classes: cmsClasses.map((schoolClass) => ({
        id: schoolClass.id,
        classCode: schoolClass.class_code,
        className: schoolClass.class_name,
        canonicalSortKey: schoolClass.class_code,
      })),
      guardians: [{
        guardianId: mapped.guardianId,
        guardianEmail: 'preview@example.invalid',
        familyId: 'auth-family-b',
        children: mapped.children,
      }],
    })
    const body = result.payloads[0]?.renderedBody ?? ''

    expect(result.warnings.filter((warning) => warning.code === 'unknown_target_class')).toEqual([
      expect.objectContaining({ details: { blockId: 'unknown', classId: 'cms-class-unknown' } }),
    ])
    expect(body).not.toContain('class-a-marker')
    expect(body).not.toContain('https://example.test/class-a')
    expect(body).not.toContain('unknown-marker')
    expect(body).not.toContain('https://example.test/unknown')
  })

  it('keeps a zero-child family from inheriting known catalogue class content', () => {
    const zeroChildDirectory: SmzDirectoryGraph = {
      ...directory,
      families: [...directory.families, { id: 'auth-family-empty', code: 'F-E', displayName: 'Family Empty' }],
      familyMemberships: [...directory.familyMemberships, { familyId: 'auth-family-empty', personId: 'parent-b', relationship: 'guardian' }],
    }
    const scope = resolveAuthPreviewFamily(zeroChildDirectory, 'auth-family-empty')
    if (!scope) throw new Error('Missing zero-child fixture family')
    const mapped = mapAuthPreviewFamilyToCms(scope, cmsClasses)
    const result = composePersonalizedEmails({
      rulesVersion: 'v1',
      newsletter,
      classes: cmsClasses.map((schoolClass) => ({
        id: schoolClass.id,
        classCode: schoolClass.class_code,
        className: schoolClass.class_name,
        canonicalSortKey: schoolClass.class_code,
      })),
      guardians: [{
        guardianId: mapped.guardianId,
        guardianEmail: 'preview@example.invalid',
        familyId: 'auth-family-empty',
        children: mapped.children,
      }],
    })
    const body = result.payloads[0]?.renderedBody ?? ''

    expect(result.warnings.filter((warning) => warning.code === 'unknown_target_class')).toEqual([])
    expect(body).not.toContain('class-a-marker')
    expect(body).not.toContain('https://example.test/class-a')
    expect(body).not.toContain('class-b-marker')
    expect(body).not.toContain('https://example.test/class-b')
  })
})
