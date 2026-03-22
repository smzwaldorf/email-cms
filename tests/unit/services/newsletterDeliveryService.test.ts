import { describe, expect, it } from 'vitest'

import {
  defaultAudienceSelection,
  filterAudienceCandidateFamilyIds,
  validateRecipientEligibility,
} from '@/services/newsletterDeliveryService'

describe('newsletterDeliveryService helpers', () => {
  it('defaults to all audience mode', () => {
    expect(defaultAudienceSelection()).toEqual({ mode: 'all' })
  })

  it('filters candidates by class audience', () => {
    const filtered = filterAudienceCandidateFamilyIds(
      [
        { familyId: 'f-1', classIds: ['A1'] },
        { familyId: 'f-2', classIds: ['B1'] },
        { familyId: 'f-3', classIds: ['A1', 'C1'] },
      ],
      { mode: 'classes', classIds: ['A1'] },
    )
    expect(filtered).toEqual(['f-1', 'f-3'])
  })

  it('filters candidates by selected families and one family mode', () => {
    const candidates = [
      { familyId: 'f-1', classIds: ['A1'] },
      { familyId: 'f-2', classIds: ['B1'] },
    ]
    expect(
      filterAudienceCandidateFamilyIds(candidates, { mode: 'families', familyIds: ['f-2'] }),
    ).toEqual(['f-2'])
    expect(
      filterAudienceCandidateFamilyIds(candidates, { mode: 'family', familyId: 'f-1' }),
    ).toEqual(['f-1'])
  })

  it('marks ineligible recipients independently', () => {
    expect(
      validateRecipientEligibility({
        is_active: true,
        newsletter_subscription_status: 'subscribed',
        classIds: ['A1'],
      }),
    ).toEqual({ eligible: true, reason: null })

    expect(
      validateRecipientEligibility({
        is_active: false,
        newsletter_subscription_status: 'subscribed',
        classIds: ['A1'],
      }),
    ).toEqual({ eligible: false, reason: 'family_inactive' })

    expect(
      validateRecipientEligibility({
        is_active: true,
        newsletter_subscription_status: 'unsubscribed',
        classIds: ['A1'],
      }),
    ).toEqual({ eligible: false, reason: 'subscription_blocked' })
  })
})
