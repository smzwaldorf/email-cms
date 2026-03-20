import { describe, expect, it } from 'vitest'

import { composePersonalizedEmails } from '@/services/personalizedEmailComposer'
import type { ComposePersonalizedEmailInput } from '@/types/personalization'

describe('personalized email composition integration', () => {
  it('returns one payload per guardian across single-child and multi-child families', () => {
    const input: ComposePersonalizedEmailInput = {
      rulesVersion: 'v1',
      snapshotCapturedAt: '2026-03-20T09:00:00.000Z',
      classes: [
        { id: 'A', className: 'Grade 1A', canonicalSortKey: '01' },
        { id: 'B', className: 'Grade 1B', canonicalSortKey: '02' },
      ],
      newsletter: {
        newsletterId: 'newsletter-1',
        newsletterRevisionId: 'rev-100',
        sharedBlocks: [{ blockId: 'shared-1', content: 'Shared', editorialOrder: 1 }],
        classBlocks: [
          { blockId: 'A-1', classId: 'A', content: 'A content', editorialOrder: 1 },
          { blockId: 'B-1', classId: 'B', content: 'B content', editorialOrder: 1 },
        ],
      },
      guardians: [
        {
          guardianId: 'guardian-single',
          guardianEmail: 'single@example.com',
          familyId: 'family-1',
          children: [{ studentId: 'student-1', classId: 'A' }],
        },
        {
          guardianId: 'guardian-multi',
          guardianEmail: 'multi@example.com',
          familyId: 'family-2',
          children: [
            { studentId: 'student-2', classId: 'A' },
            { studentId: 'student-3', classId: 'B' },
          ],
        },
      ],
    }

    const result = composePersonalizedEmails(input)

    expect(result.payloads).toHaveLength(2)
    expect(result.payloads.map((payload) => payload.guardianId)).toEqual([
      'guardian-single',
      'guardian-multi',
    ])

    const singlePayload = result.payloads.find((payload) => payload.guardianId === 'guardian-single')
    const multiPayload = result.payloads.find((payload) => payload.guardianId === 'guardian-multi')

    expect(singlePayload?.classBlocks.map((block) => block.blockId)).toEqual(['A-1'])
    expect(multiPayload?.classBlocks.map((block) => block.blockId)).toEqual(['A-1', 'B-1'])
  })
})
