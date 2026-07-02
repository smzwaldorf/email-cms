import { describe, expect, it, vi } from 'vitest'

import { KitMergePropertySyncService } from '@/services/kitMergePropertySyncService'
import type { PreparedRecipientRecord } from '@/types/emailPreparation'

function createPreparedRecipient(overrides: Partial<PreparedRecipientRecord> = {}): PreparedRecipientRecord {
  const base: PreparedRecipientRecord = {
    guardianId: 'G-1',
    guardianEmail: 'mei.chen@example.com',
    status: 'ready',
    payload: {
      guardianId: 'G-1',
      guardianEmail: 'mei.chen@example.com',
      familyId: 'family-1',
      newsletterId: 'N-2026-04',
      newsletterRevisionId: 'rev-1',
      rules_version: 'v1',
      input_fingerprint: 'input-fp-1',
      sharedBlocks: [],
      classBlocks: [
        {
          blockId: 'oak-1',
          title: 'Oak One',
          content: '<p>Oak excerpt one</p>',
          editorialOrder: 1,
          personalizationKey: 'article:oak-1',
          classId: 'oak',
        },
        {
          blockId: 'oak-2',
          title: 'Oak Two',
          content: '<p>Oak excerpt two</p>',
          editorialOrder: 2,
          personalizationKey: 'article:oak-2',
          classId: 'oak',
        },
      ],
      resolvedClassIds: ['oak'],
      classFallback: 'none',
      renderedSubject: 'Oak newsletter',
      renderedBody: '<p>Body</p>',
    },
    kitMergeData: {
      identity: { firstName: 'Mei', lastName: 'Chen' },
      stableMetadata: {
        parentType: 'mother',
        childClasses: ['Oak'],
        childNames: ['Lina'],
      },
      classArticleExcerptSets: [
        {
          classId: 'oak',
          excerpts: [
            {
              blockId: 'oak-1',
              title: 'Oak One',
              excerpt: 'Oak excerpt one',
              editorialOrder: 1,
              personalizationKey: 'article:oak-1',
              classId: 'oak',
            },
            {
              blockId: 'oak-2',
              title: 'Oak Two',
              excerpt: 'Oak excerpt two',
              editorialOrder: 2,
              personalizationKey: 'article:oak-2',
              classId: 'oak',
            },
          ],
        },
      ],
      sourceBlocks: [],
    },
    findings: [],
  }

  return { ...base, ...overrides }
}

function createAdapter() {
  return {
    upsertSubscriberMergeProperties: vi.fn(async (input) => ({
      externalSubscriberId: input.externalSubscriberId ?? 'kit-101',
      externalEmailAddress: input.emailAddress,
      providerState: 'active',
      providerVersionMarker: 'provider-version-1',
      syncedFieldKeys: Object.keys(input.fields),
      syncedFieldIdentifiers: Object.fromEntries(
        Object.keys(input.fields).map((key, index) => [
          key,
          { key, providerFieldId: String(index + 1), providerFieldName: key },
        ]),
      ),
      raw: { ok: true },
    })),
  }
}

describe('KitMergePropertySyncService', () => {
  it('syncs identity fields and single-class excerpts from prepared output', async () => {
    const adapter = createAdapter()
    const result = await new KitMergePropertySyncService().syncPreparedRecipients({
      batchId: 'B-1',
      newsletterId: 'N-2026-04',
      adapter,
      recipients: [{ preparedRecipient: createPreparedRecipient() }],
    })

    expect(result.campaignReadyRecipients).toHaveLength(1)
    const fields = adapter.upsertSubscriberMergeProperties.mock.calls[0]?.[0].fields
    expect(fields?.first_name).toBe('Mei')
    expect(fields?.last_name).toBe('Chen')
    expect(fields?.newsletter_b_1_class_article_count).toBe('2')
    expect(fields?.newsletter_b_1_class_article_excerpts).toContain('Oak excerpt one')
  })

  it('preserves multi-class excerpts in canonical prepared order', async () => {
    const adapter = createAdapter()
    const preparedRecipient = createPreparedRecipient({
      guardianId: 'G-2',
      kitMergeData: {
        ...createPreparedRecipient().kitMergeData,
        classArticleExcerptSets: [
          {
            classId: 'oak',
            excerpts: [
              {
                blockId: 'oak-1',
                title: 'Oak',
                excerpt: 'Oak excerpt',
                editorialOrder: 1,
                personalizationKey: 'article:oak-1',
                classId: 'oak',
              },
            ],
          },
          {
            classId: 'willow',
            excerpts: [
              {
                blockId: 'willow-1',
                title: 'Willow',
                excerpt: 'Willow excerpt',
                editorialOrder: 2,
                personalizationKey: 'article:willow-1',
                classId: 'willow',
              },
            ],
          },
        ],
      },
    })

    await new KitMergePropertySyncService().syncPreparedRecipients({
      batchId: 'B-1',
      newsletterId: 'N-2026-04',
      adapter,
      recipients: [{ preparedRecipient }],
    })

    const classPayload = adapter.upsertSubscriberMergeProperties.mock.calls[0]?.[0].fields
      .newsletter_b_1_class_article_excerpts
    expect(classPayload.indexOf('Oak excerpt')).toBeLessThan(classPayload.indexOf('Willow excerpt'))
  })

  it('skips unchanged successful payloads and preserves fingerprint metadata', async () => {
    const adapter = createAdapter()
    const service = new KitMergePropertySyncService()
    const first = await service.syncPreparedRecipients({
      batchId: 'B-1',
      newsletterId: 'N-2026-04',
      adapter,
      recipients: [{ preparedRecipient: createPreparedRecipient() }],
    })
    const syncedState = first.campaignReadyRecipients[0]?.syncState

    const second = await service.syncPreparedRecipients({
      batchId: 'B-1',
      newsletterId: 'N-2026-04',
      adapter,
      recipients: [{ preparedRecipient: createPreparedRecipient(), existingSyncState: syncedState }],
    })

    expect(adapter.upsertSubscriberMergeProperties).toHaveBeenCalledTimes(1)
    expect(second.campaignReadyRecipients).toHaveLength(1)
    expect(second.campaignReadyRecipients[0]?.syncState.lastSuccessfulPayloadFingerprint)
      .toBe(syncedState?.lastSuccessfulPayloadFingerprint)
  })

  it('re-syncs drifted payloads when the local fingerprint changes', async () => {
    const adapter = createAdapter()
    const service = new KitMergePropertySyncService()
    const initial = await service.syncPreparedRecipients({
      batchId: 'B-1',
      newsletterId: 'N-2026-04',
      adapter,
      recipients: [{ preparedRecipient: createPreparedRecipient() }],
    })
    const changed = createPreparedRecipient({
      kitMergeData: {
        ...createPreparedRecipient().kitMergeData,
        classArticleExcerptSets: [
          {
            classId: 'oak',
            excerpts: [
              {
                blockId: 'oak-1',
                title: 'Oak One',
                excerpt: 'Changed excerpt',
                editorialOrder: 1,
                personalizationKey: 'article:oak-1',
                classId: 'oak',
              },
            ],
          },
        ],
      },
    })

    const drift = await service.syncPreparedRecipients({
      batchId: 'B-1',
      newsletterId: 'N-2026-04',
      adapter,
      recipients: [{ preparedRecipient: changed, existingSyncState: initial.campaignReadyRecipients[0]?.syncState }],
    })

    expect(adapter.upsertSubscriberMergeProperties).toHaveBeenCalledTimes(2)
    expect(drift.campaignReadyRecipients[0]?.syncState.driftReason).toBe('payload_fingerprint_changed')
  })

  it('blocks only recipients with oversized or missing required excerpts', async () => {
    const adapter = createAdapter()
    const invalid = createPreparedRecipient({
      guardianId: 'G-invalid',
      kitMergeData: {
        ...createPreparedRecipient().kitMergeData,
        classArticleExcerptSets: [
          {
            classId: 'oak',
            excerpts: [
              {
                blockId: 'oak-1',
                title: 'Oak One',
                excerpt: '',
                editorialOrder: 1,
                personalizationKey: 'article:oak-1',
                classId: 'oak',
              },
            ],
          },
        ],
      },
    })

    const result = await new KitMergePropertySyncService().syncPreparedRecipients({
      batchId: 'B-1',
      newsletterId: 'N-2026-04',
      adapter,
      limits: { maxExcerptLength: 100 },
      recipients: [
        { preparedRecipient: invalid },
        { preparedRecipient: createPreparedRecipient({ guardianId: 'G-valid' }) },
      ],
    })

    expect(result.failedRecipients.map((recipient) => recipient.recipientId)).toContain('G-invalid')
    expect(result.campaignReadyRecipients.map((recipient) => recipient.recipientId)).toContain('G-valid')
  })
})

