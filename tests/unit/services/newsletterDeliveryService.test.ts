import { describe, expect, it } from 'vitest'

import {
  defaultAudienceSelection,
  filterAudienceCandidateFamilyIds,
  selectCampaignReadyDeliveryRecipients,
  validateRecipientEligibility,
} from '@/services/newsletterDeliveryService'
import type { NewsletterDeliveryRecipient } from '@/types/emailDelivery'

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
        classIds: ['A1'],
      }),
    ).toEqual({ eligible: true, reason: null })

    expect(
      validateRecipientEligibility({
        is_active: false,
        classIds: ['A1'],
      }),
    ).toEqual({ eligible: false, reason: 'family_inactive' })

    expect(
      validateRecipientEligibility({
        is_active: true,
        classIds: ['A1'],
      }),
    ).toEqual({ eligible: true, reason: null })
  })

  it('selects only fully synced recipients for one Kit campaign audience', () => {
    const baseRecipient: NewsletterDeliveryRecipient = {
      id: 'recipient-1',
      batchId: 'batch-1',
      familyId: 'family-1',
      parentId: 'parent-1',
      parentEmail: 'parent@example.com',
      eligibilityStatus: 'eligible',
      preparationStatus: 'ready',
      sendStatus: 'handoff_pending',
      failureReason: null,
      preparedPayload: null,
      preparationFindings: [],
      journeyCorrelationId: 'journey-1',
      providerMessageId: null,
      providerError: null,
      kitMergeSyncStatus: 'synced',
      kitMergePayload: null,
      kitMergePayloadFingerprint: 'fp-1',
      kitMergeProviderFieldIds: {},
      kitMergeLastSyncedAt: '2026-04-25T00:00:00.000Z',
      kitMergeProviderError: null,
      kitMergeSyncState: {
        status: 'synced',
        payloadFingerprint: 'fp-1',
        lastSuccessfulPayloadFingerprint: 'fp-1',
        lastSuccessfulSyncedAt: '2026-04-25T00:00:00.000Z',
        providerFieldIdentifiers: {},
        providerError: null,
        validationErrors: [],
        driftReason: null,
        campaignReady: true,
      },
      campaignReady: true,
      lastAttemptedAt: null,
      sentAt: null,
      createdAt: '2026-04-25T00:00:00.000Z',
      updatedAt: '2026-04-25T00:00:00.000Z',
    }

    const selected = selectCampaignReadyDeliveryRecipients([
      baseRecipient,
      {
        ...baseRecipient,
        id: 'recipient-failed-sync',
        kitMergeSyncStatus: 'failed',
        kitMergeProviderError: 'payload_size_exceeded',
        campaignReady: false,
        kitMergeSyncState: {
          ...baseRecipient.kitMergeSyncState,
          status: 'failed',
          providerError: 'payload_size_exceeded',
          campaignReady: false,
        },
      },
    ])

    expect(selected.map((recipient) => recipient.id)).toEqual(['recipient-1'])
  })
})
