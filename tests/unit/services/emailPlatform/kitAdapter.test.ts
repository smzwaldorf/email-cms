import { beforeEach, describe, expect, it, vi } from 'vitest'

import { KitAdapter } from '@/services/emailPlatform/kitAdapter.ts'
import { EmailPlatformConfig } from '@/types/emailPlatform.ts'

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
    },
  })
}

describe('KitAdapter', () => {
  const config: EmailPlatformConfig = {
    provider: 'kit',
    apiBaseUrl: 'https://api.kit.com',
    apiToken: 'kit-token',
    webhookSecret: 'shared-secret',
    webhookSecretHeader: 'x-kit-webhook-secret',
    maxAttempts: 5,
    initialRetryDelayMs: 1_000,
    maxRetryDelayMs: 8_000,
    workerBatchSize: 25,
    reconciliationBatchSize: 50,
    classTagPrefix: 'class:',
  }

  const fetchMock = vi.fn<[RequestInfo | URL, RequestInit?], Promise<Response>>()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('creates missing fields and tags, removes stale class tags, and returns the synced snapshot', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ custom_fields: [] }))
      .mockResolvedValueOnce(
        jsonResponse({
          custom_field: {
            id: 1,
            name: 'ck_external_identity_key',
            key: 'external_identity_key',
            label: 'external_identity_key',
          },
        }, 201),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          custom_field: { id: 2, name: 'ck_child_classes', key: 'child_classes', label: 'child_classes' },
        }, 201),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          custom_field: { id: 3, name: 'ck_child_names', key: 'child_names', label: 'child_names' },
        }, 201),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          custom_field: { id: 4, name: 'ck_parent_type', key: 'parent_type', label: 'parent_type' },
        }, 201),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          subscriber: {
            id: 101,
            email_address: 'parent@example.com',
            state: 'active',
            fields: {
              external_identity_key: 'family:family-1',
              child_classes: 'Grade 1A',
              child_names: 'Alice',
              parent_type: 'mother',
            },
          },
        }, 201),
      )
      .mockResolvedValueOnce(jsonResponse({ tags: [] }))
      .mockResolvedValueOnce(
        jsonResponse({ tag: { id: 11, name: 'class:A1', created_at: '2026-03-19T00:00:00.000Z' } }, 201),
      )
      .mockResolvedValueOnce(jsonResponse({ tags: [{ id: 9, name: 'class:OLD' }] }))
      .mockResolvedValueOnce(
        jsonResponse({
          subscriber: {
            id: 101,
            email_address: 'parent@example.com',
            state: 'active',
            tagged_at: '2026-03-19T00:00:00.000Z',
            fields: {},
          },
        }),
      )
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(
        jsonResponse({
          subscriber: {
            id: 101,
            email_address: 'parent@example.com',
            state: 'active',
            fields: {
              external_identity_key: 'family:family-1',
              child_classes: 'Grade 1A',
              child_names: 'Alice',
              parent_type: 'mother',
            },
          },
        }),
      )
      .mockResolvedValueOnce(jsonResponse({ tags: [{ id: 11, name: 'class:A1' }] }))

    const adapter = new KitAdapter(config, fetchMock as unknown as typeof fetch)
    const outcome = await adapter.upsertSubscriber({
      payload: {
        externalIdentityKey: 'family:family-1',
        emailAddress: 'parent@example.com',
        firstName: 'Parent One',
        state: 'active',
        parentType: 'mother',
        childClasses: ['Grade 1A'],
        childNames: ['Alice'],
        customFields: {
          external_identity_key: 'family:family-1',
          child_classes: 'Grade 1A',
          child_names: 'Alice',
          parent_type: 'mother',
        },
        tagNames: ['class:A1'],
      },
    })

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.kit.com/v4/custom_fields?per_page=500',
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({
          'X-Kit-Api-Key': 'kit-token',
        }),
      }),
    )
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.kit.com/v4/tags/11/subscribers/101',
      expect.objectContaining({ method: 'POST' }),
    )
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.kit.com/v4/tags/9/subscribers/101',
      expect.objectContaining({ method: 'DELETE' }),
    )
    expect(outcome.externalSubscriberId).toBe('101')
    expect(outcome.syncedTagNames).toEqual(['class:A1'])
    expect(outcome.syncedFieldKeys).toEqual([
      'external_identity_key',
      'child_classes',
      'child_names',
      'parent_type',
    ])
  })

  it('creates a broadcast targeted to a specific tag', async () => {
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse({
          tags: [{ id: 77, name: 'family:family-1' }],
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse(
          {
            broadcast: {
              id: 501,
              send_at: '2026-03-23T12:00:00Z',
              public_url: null,
            },
          },
          201,
        ),
      )

    const adapter = new KitAdapter(config, fetchMock as unknown as typeof fetch)
    const result = await adapter.createBroadcast({
      subject: 'Weekly Update',
      content: '<p>Hello family</p>',
      description: 'newsletter:1 batch:2 recipient:3',
      previewText: 'Hello family',
      sendAt: '2026-03-23T12:00:00Z',
      tagNames: ['family:family-1'],
      emailAddress: 'sender@example.com',
    })

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.kit.com/v4/broadcasts',
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('"subject":"Weekly Update"'),
      }),
    )
    expect(result).toEqual({
      broadcastId: '501',
      sendAt: '2026-03-23T12:00:00Z',
      publicUrl: null,
    })
  })
})
