export type EmailPlatformProvider = 'kit'

export type EmailPlatformJobType = 'upsert_subscriber' | 'reconcile_subscriber'

export type EmailPlatformSyncJobStatus =
  | 'pending'
  | 'processing'
  | 'retryable'
  | 'succeeded'
  | 'failed'
  | 'dead_lettered'

export type EmailPlatformWebhookStatus =
  | 'received'
  | 'processing'
  | 'retryable'
  | 'processed'
  | 'unresolved'
  | 'failed'
  | 'dead_lettered'

export type NewsletterSubscriptionStatus =
  | 'pending'
  | 'subscribed'
  | 'unsubscribed'
  | 'bounced'
  | 'complained'

export type ParentType = 'father' | 'mother' | 'guardian' | 'mixed'

export interface EmailPlatformConfig {
  provider: EmailPlatformProvider
  apiBaseUrl: string
  apiToken: string
  webhookSecret: string
  webhookSecretHeader: string
  maxAttempts: number
  initialRetryDelayMs: number
  maxRetryDelayMs: number
  workerBatchSize: number
  reconciliationBatchSize: number
  classTagPrefix: string
}

export interface EmailPlatformRecipientChild {
  studentId: string
  name: string
  classId: string
  classCode: string
  className: string
}

export interface EmailPlatformRecipientRecord {
  familyId: string
  guardianEmail: string
  familyName?: string | null
  parentRelationships: string[]
  children: EmailPlatformRecipientChild[]
  isActive: boolean
  subscriptionStatus: NewsletterSubscriptionStatus
}

export interface EmailPlatformRecipientPayload {
  externalIdentityKey: string
  emailAddress: string
  firstName?: string
  state: 'active' | 'cancelled' | 'bounced' | 'complained' | 'inactive'
  parentType: ParentType
  childClasses: string[]
  childNames: string[]
  customFields: Record<string, string>
  tagNames: string[]
}

export interface EmailPlatformSyncRequest {
  payload: EmailPlatformRecipientPayload
}

export interface EmailPlatformSyncOutcome {
  externalSubscriberId: string
  externalEmailAddress: string
  providerState: string
  providerVersionMarker: string
  syncedTagNames: string[]
  syncedTagIds: number[]
  syncedFieldKeys: string[]
  raw: unknown
}

export interface EmailPlatformSubscriberSnapshot {
  externalSubscriberId: string
  emailAddress: string
  state: string
  fields: Record<string, string>
  tagNames: string[]
  providerVersionMarker: string
  raw: unknown
}

export interface EmailPlatformAdapter {
  upsertSubscriber(input: EmailPlatformSyncRequest): Promise<EmailPlatformSyncOutcome>
  getSubscriberSnapshot(externalSubscriberId: string): Promise<EmailPlatformSubscriberSnapshot>
}

export interface EmailPlatformWebhookVerificationResult {
  isValid: boolean
  failureReason?: string
}

export interface EmailPlatformWebhookEnvelope {
  eventType: string
  providerEventId: string
  occurredAt?: string
  payloadHash: string
  payload: Record<string, unknown>
  subscriber: {
    externalSubscriberId?: string
    emailAddress?: string
    state?: string
    fields?: Record<string, string>
  }
}

export interface RetryPlan {
  attemptCount: number
  nextRetryAt: string | null
  shouldRetry: boolean
  terminalStatus: EmailPlatformSyncJobStatus | EmailPlatformWebhookStatus
}

export interface OperationalMetricSummary {
  processed: number
  succeeded: number
  retried: number
  failed: number
  deadLettered: number
}

export class EmailPlatformError extends Error {
  readonly code: string
  readonly retryable: boolean
  readonly statusCode?: number
  readonly context?: Record<string, unknown>

  constructor(
    message: string,
    options: {
      code: string
      retryable?: boolean
      statusCode?: number
      context?: Record<string, unknown>
    },
  ) {
    super(message)
    this.name = 'EmailPlatformError'
    this.code = options.code
    this.retryable = options.retryable ?? false
    this.statusCode = options.statusCode
    this.context = options.context
  }
}

export class EmailPlatformConfigurationError extends EmailPlatformError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, {
      code: 'email_platform_configuration_error',
      retryable: false,
      context,
    })
    this.name = 'EmailPlatformConfigurationError'
  }
}

export class KitApiError extends EmailPlatformError {
  constructor(
    message: string,
    options: {
      retryable?: boolean
      statusCode?: number
      context?: Record<string, unknown>
    } = {},
  ) {
    super(message, {
      code: 'kit_api_error',
      retryable: options.retryable,
      statusCode: options.statusCode,
      context: options.context,
    })
    this.name = 'KitApiError'
  }
}
