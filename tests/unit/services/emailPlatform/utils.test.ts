import { describe, expect, it } from 'vitest'

import {
  buildWebhookEnvelope,
  mapWebhookEventToSubscriptionStatus,
  planRetry,
  shouldApplySubscriptionTransition,
  stableStringify,
} from '@/services/emailPlatform/utils.ts'

describe('email platform utils', () => {
  it('stableStringify sorts object keys deterministically', () => {
    expect(stableStringify({ b: 1, a: { d: 2, c: 3 } })).toBe(
      '{"a":{"c":3,"d":2},"b":1}',
    )
  })

  it('plans retries with exponential backoff and dead-letters at the limit', () => {
    const firstRetry = planRetry(
      0,
      {
        maxAttempts: 5,
        initialRetryDelayMs: 1_000,
        maxRetryDelayMs: 8_000,
      },
      new Date('2026-03-19T00:00:00.000Z'),
    )

    expect(firstRetry.shouldRetry).toBe(true)
    expect(firstRetry.nextRetryAt).toBe('2026-03-19T00:00:01.000Z')

    const deadLetter = planRetry(
      4,
      {
        maxAttempts: 5,
        initialRetryDelayMs: 1_000,
        maxRetryDelayMs: 8_000,
      },
      new Date('2026-03-19T00:00:00.000Z'),
    )

    expect(deadLetter.shouldRetry).toBe(false)
    expect(deadLetter.terminalStatus).toBe('dead_lettered')
  })

  it('derives a deterministic webhook envelope without an explicit event id', async () => {
    const envelope = await buildWebhookEnvelope({
      subscriber: {
        id: 42,
        email_address: 'parent@example.com',
        state: 'cancelled',
      },
    })

    expect(envelope.eventType).toBe('subscriber.subscriber_unsubscribe')
    expect(envelope.providerEventId).toContain('subscriber.subscriber_unsubscribe')
    expect(envelope.subscriber.externalSubscriberId).toBe('42')
  })

  it('maps webhook event types to local subscription states', () => {
    expect(
      mapWebhookEventToSubscriptionStatus('subscriber.subscriber_activate', 'active'),
    ).toBe('subscribed')
    expect(
      mapWebhookEventToSubscriptionStatus('subscriber.subscriber_unsubscribe', 'cancelled'),
    ).toBe('unsubscribed')
    expect(
      mapWebhookEventToSubscriptionStatus('subscriber.subscriber_bounce', 'bounced'),
    ).toBe('bounced')
  })

  it('prevents out-of-order subscription transitions from overwriting newer state', () => {
    expect(
      shouldApplySubscriptionTransition(
        '2026-03-19T10:00:00.000Z',
        '2026-03-19T09:00:00.000Z',
      ),
    ).toBe(false)
    expect(
      shouldApplySubscriptionTransition(
        '2026-03-19T10:00:00.000Z',
        '2026-03-19T11:00:00.000Z',
      ),
    ).toBe(true)
  })
})
