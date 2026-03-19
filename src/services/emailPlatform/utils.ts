import {
  EmailPlatformConfig,
  EmailPlatformError,
  EmailPlatformJobType,
  EmailPlatformSyncJobStatus,
  EmailPlatformWebhookEnvelope,
  EmailPlatformWebhookStatus,
  KitApiError,
  NewsletterSubscriptionStatus,
  OperationalMetricSummary,
  RetryPlan,
} from '../../types/emailPlatform.ts'

export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value)
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(',')}]`
  }

  const entries = Object.entries(value as Record<string, unknown>).sort(([left], [right]) =>
    left.localeCompare(right),
  )

  return `{${entries
    .map(([key, nestedValue]) => `${JSON.stringify(key)}:${stableStringify(nestedValue)}`)
    .join(',')}}`
}

export async function sha256Hex(value: string): Promise<string> {
  const encodedValue = new TextEncoder().encode(value)
  const digest = await crypto.subtle.digest('SHA-256', encodedValue)
  return Array.from(new Uint8Array(digest))
    .map((item) => item.toString(16).padStart(2, '0'))
    .join('')
}

export async function computePayloadFingerprint(value: unknown): Promise<string> {
  return sha256Hex(stableStringify(value))
}

export function planRetry(
  attemptCount: number,
  config: Pick<EmailPlatformConfig, 'maxAttempts' | 'initialRetryDelayMs' | 'maxRetryDelayMs'>,
  now: Date,
): RetryPlan {
  const nextAttemptCount = attemptCount + 1

  if (nextAttemptCount >= config.maxAttempts) {
    return {
      attemptCount: nextAttemptCount,
      nextRetryAt: null,
      shouldRetry: false,
      terminalStatus: 'dead_lettered',
    }
  }

  const delayMs = Math.min(
    config.initialRetryDelayMs * 2 ** Math.max(nextAttemptCount - 1, 0),
    config.maxRetryDelayMs,
  )

  return {
    attemptCount: nextAttemptCount,
    nextRetryAt: new Date(now.getTime() + delayMs).toISOString(),
    shouldRetry: true,
    terminalStatus: 'retryable',
  }
}

export function classifyRetryableError(error: unknown): { retryable: boolean; code: string } {
  if (error instanceof EmailPlatformError) {
    return { retryable: error.retryable, code: error.code }
  }

  if (error instanceof KitApiError) {
    return { retryable: error.retryable, code: error.code }
  }

  if (error instanceof Error && /timeout|network|fetch/i.test(error.message)) {
    return { retryable: true, code: 'network_error' }
  }

  return { retryable: false, code: 'unexpected_error' }
}

export function deriveWebhookEventType(payload: Record<string, unknown>): string {
  const eventName =
    (payload['event_type'] as string | undefined) ??
    (payload['event'] as { name?: string } | undefined)?.name

  if (eventName) {
    return eventName
  }

  const subscriberState = (payload['subscriber'] as { state?: string } | undefined)?.state

  switch (subscriberState) {
    case 'active':
      return 'subscriber.subscriber_activate'
    case 'cancelled':
      return 'subscriber.subscriber_unsubscribe'
    case 'bounced':
      return 'subscriber.subscriber_bounce'
    case 'complained':
      return 'subscriber.subscriber_complain'
    default:
      return 'subscriber.profile_update'
  }
}

export async function buildWebhookEnvelope(
  payload: Record<string, unknown>,
  explicitEventId?: string,
): Promise<EmailPlatformWebhookEnvelope> {
  const subscriber = (payload['subscriber'] as Record<string, unknown> | undefined) ?? {}
  const eventType = deriveWebhookEventType(payload)
  const payloadHash = await computePayloadFingerprint(payload)
  const providerEventId =
    explicitEventId ??
    `${eventType}:${String(subscriber['id'] ?? subscriber['email_address'] ?? payloadHash)}:${payloadHash}`

  return {
    eventType,
    providerEventId,
    occurredAt:
      (payload['occurred_at'] as string | undefined) ??
      (payload['created_at'] as string | undefined) ??
      (subscriber['created_at'] as string | undefined),
    payloadHash,
    payload,
    subscriber: {
      externalSubscriberId:
        subscriber['id'] === undefined ? undefined : String(subscriber['id']),
      emailAddress: subscriber['email_address'] as string | undefined,
      state: subscriber['state'] as string | undefined,
      fields: (subscriber['fields'] as Record<string, string> | undefined) ?? {},
    },
  }
}

export function mapProviderStateToSubscriptionStatus(
  providerState: string | undefined,
): NewsletterSubscriptionStatus {
  switch (providerState) {
    case 'active':
      return 'subscribed'
    case 'cancelled':
      return 'unsubscribed'
    case 'bounced':
      return 'bounced'
    case 'complained':
      return 'complained'
    default:
      return 'pending'
  }
}

export function mapWebhookEventToSubscriptionStatus(
  eventType: string,
  fallbackState?: string,
): NewsletterSubscriptionStatus {
  if (/unsubscribe/i.test(eventType)) {
    return 'unsubscribed'
  }

  if (/bounce/i.test(eventType)) {
    return 'bounced'
  }

  if (/complain/i.test(eventType)) {
    return 'complained'
  }

  if (/activate|subscribe/i.test(eventType)) {
    return 'subscribed'
  }

  return mapProviderStateToSubscriptionStatus(fallbackState)
}

export function shouldApplySubscriptionTransition(
  currentUpdatedAt: string | null | undefined,
  incomingOccurredAt: string | null | undefined,
): boolean {
  if (!incomingOccurredAt || !currentUpdatedAt) {
    return true
  }

  return new Date(incomingOccurredAt).getTime() >= new Date(currentUpdatedAt).getTime()
}

export function createMetricSummary(): OperationalMetricSummary {
  return {
    processed: 0,
    succeeded: 0,
    retried: 0,
    failed: 0,
    deadLettered: 0,
  }
}

export function trackMetricOutcome(
  summary: OperationalMetricSummary,
  status: EmailPlatformSyncJobStatus | EmailPlatformWebhookStatus,
): OperationalMetricSummary {
  summary.processed += 1

  switch (status) {
    case 'succeeded':
    case 'processed':
      summary.succeeded += 1
      break
    case 'retryable':
      summary.retried += 1
      break
    case 'failed':
      summary.failed += 1
      break
    case 'dead_lettered':
      summary.deadLettered += 1
      break
    default:
      break
  }

  return summary
}

export function buildOperationalLog(
  jobType: EmailPlatformJobType | 'webhook',
  summary: OperationalMetricSummary,
  extraContext: Record<string, unknown> = {},
): string {
  return JSON.stringify({
    scope: 'email-platform',
    provider: 'kit',
    jobType,
    ...summary,
    ...extraContext,
    timestamp: new Date().toISOString(),
  })
}
