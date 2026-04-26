import { describe, expect, it } from 'vitest'

import {
  buildNewsletterMergeFieldKeys,
  mapRecipientToKitPayload,
} from '@/services/emailPlatform/kitMapping.ts'

describe('mapRecipientToKitPayload', () => {
  it('maps guardian identity, custom fields, and class tags', () => {
    const payload = mapRecipientToKitPayload(
      {
        familyId: 'family-1',
        primaryEmail: 'Parent@One.com',
        familyName: 'Parent One',
        isActive: true,
        subscriptionStatus: 'subscribed',
        parentRelationships: ['mother'],
        children: [
          {
            studentId: 'student-1',
            name: 'Alice',
            classId: 'class-a1',
            classCode: 'A1',
            className: 'Grade 1A',
          },
          {
            studentId: 'student-2',
            name: 'Ben',
            classId: 'class-b2',
            classCode: 'B2',
            className: 'Grade 2B',
          },
        ],
      },
      { classTagPrefix: 'class:' },
    )

    expect(payload.externalIdentityKey).toBe('family:family-1')
    expect(payload.emailAddress).toBe('parent@one.com')
    expect(payload.state).toBe('active')
    expect(payload.customFields).toEqual({
      external_identity_key: 'family:family-1',
      child_classes: 'Grade 1A, Grade 2B',
      child_names: 'Alice, Ben',
      parent_type: 'mother',
    })
    expect(payload.tagNames).toEqual(['class:A1', 'class:B2', 'family:family-1'])
  })

  it('marks mixed parent roles and unsubscribed families correctly', () => {
    const payload = mapRecipientToKitPayload(
      {
        familyId: 'family-2',
        primaryEmail: 'parent@two.com',
        familyName: null,
        isActive: true,
        subscriptionStatus: 'unsubscribed',
        parentRelationships: ['father', 'guardian'],
        children: [
          {
            studentId: 'student-1',
            name: 'Charlie',
            classId: 'class-c1',
            classCode: 'C1',
            className: 'Grade 3C',
          },
        ],
      },
      { classTagPrefix: 'grade:' },
    )

    expect(payload.firstName).toBeUndefined()
    expect(payload.state).toBe('cancelled')
    expect(payload.parentType).toBe('mixed')
    expect(payload.tagNames).toEqual(['family:family-2', 'grade:C1'])
  })

  it('builds deterministic newsletter-scoped merge field keys', () => {
    expect(
      buildNewsletterMergeFieldKeys({
        deliveryBatchId: 'B-1',
        newsletterId: 'N-2026-04',
      }),
    ).toEqual({
      classArticleExcerpts: 'newsletter_b_1_class_article_excerpts',
      classArticleCount: 'newsletter_b_1_class_article_count',
      payloadFingerprint: 'newsletter_b_1_payload_fingerprint',
    })
  })
})
