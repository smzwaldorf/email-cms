import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { EmailPlatformSyncJobRow, EmailPlatformWebhookEventRow } from '@/types/database'

import type { AdminClientLike } from '@/services/emailPlatform/runtime.ts'
import {
  loadRecipientRecord,
  persistWebhookEvent,
  processSyncJob,
  processWebhookEvent,
} from '@/services/emailPlatform/runtime.ts'
import { EmailPlatformConfig, EmailPlatformError } from '@/types/emailPlatform.ts'

vi.mock('@/services/identityDirectory', () => ({ currentDirectory: vi.fn(), currentDeliveryContacts: vi.fn() }))
import { currentDirectory, currentDeliveryContacts } from '@/services/identityDirectory'
const directory = {
 people: [{id:'parent-1',displayName:'Parent One',kind:'adult' as const},{id:'student-1',displayName:'Alice',kind:'student' as const}],
 families:[{id:'family-1',code:'F1',displayName:'Parent One'}],
 classes:[{id:'class-a1',code:'A1',displayName:'Grade 1A'}],
 familyMemberships:[{familyId:'family-1',personId:'parent-1',relationship:'mother' as const},{familyId:'family-1',personId:'student-1',relationship:'child' as const}],
 classMemberships:[{personId:'student-1',classId:'class-a1',relationship:'student' as const}],
}
const contact = {personId:'parent-1',displayName:'Parent One',email:'parent@example.com',families:[{familyId:'family-1',familyCode:'F1',classIds:['class-a1'],classCodes:['A1']}]}
beforeEach(() => {
 vi.mocked(currentDirectory).mockResolvedValue(directory)
 vi.mocked(currentDeliveryContacts).mockResolvedValue([contact])
})

type Row = Record<string, unknown>
type TableName =
  | 'newsletter_family_preferences'
  | 'identity_reference_mappings'
  | 'email_platform_subscriber_mappings'
  | 'email_platform_sync_jobs'
  | 'email_platform_webhook_events'
  | 'email_platform_subscription_audit'

type DatabaseState = Record<TableName, Row[]>

function createConfig(): EmailPlatformConfig {
  return {
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
}

function createDatabaseState(overrides: Partial<DatabaseState> = {}): DatabaseState {
  return {
    newsletter_family_preferences: [],
    identity_reference_mappings: [],
    email_platform_subscriber_mappings: [],
    email_platform_sync_jobs: [],
    email_platform_webhook_events: [],
    email_platform_subscription_audit: [],
    ...overrides,
  }
}

class MockQueryBuilder {
  private readonly filters: Array<(row: Row) => boolean> = []

  constructor(
    private readonly table: TableName,
    private readonly state: DatabaseState,
  ) {}

  select(_columns?: string, _options?: Record<string, unknown>) {
    return this
  }

  eq(column: string, value: unknown) {
    this.filters.push((row) => row[column] === value)
    return this
  }

  ilike(column: string, value: unknown) {
    const normalizedValue = String(value).toLowerCase()
    this.filters.push((row) => String(row[column] ?? '').toLowerCase() === normalizedValue)
    return this
  }

  in(column: string, values: unknown[]) {
    this.filters.push((row) => values.includes(row[column]))
    return this
  }

  is(column: string, value: unknown) {
    this.filters.push((row) => row[column] === value)
    return this
  }

  not(column: string, operator: string, value: unknown) {
    if (operator === 'is' && value === null) {
      this.filters.push((row) => row[column] !== null && row[column] !== undefined)
    }
    return this
  }

  lte(column: string, value: unknown) {
    const target = new Date(String(value)).getTime()
    this.filters.push((row) => new Date(String(row[column])).getTime() <= target)
    return this
  }

  order(_column: string, _options?: Record<string, unknown>) {
    return this
  }

  then<TResult1 = { data: Row[]; error: null }, TResult2 = never>(
    onfulfilled?:
      | ((value: { data: Row[]; error: null }) => TResult1 | PromiseLike<TResult1>)
      | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ) {
    return Promise.resolve({
      data: this.filteredRows(),
      error: null,
    }).then(onfulfilled, onrejected)
  }

  async limit(count: number) {
    return {
      data: this.filteredRows().slice(0, count),
      error: null,
    }
  }

  async maybeSingle() {
    return {
      data: this.filteredRows()[0] ?? null,
      error: null,
    }
  }

  async single() {
    return {
      data: this.filteredRows()[0] ?? null,
      error: null,
    }
  }

  insert(payload: Row | Row[]) {
    const rows = Array.isArray(payload) ? payload : [payload]

    if (this.table === 'email_platform_webhook_events') {
      const duplicateRow = rows.find((row) =>
        this.state.email_platform_webhook_events.some(
          (existingRow) => existingRow.delivery_key === row.delivery_key,
        ),
      )

      if (duplicateRow) {
        return {
          select: () => ({
            single: async () => ({
              data: null,
              error: {
                message: 'duplicate key value violates unique constraint',
              },
            }),
          }),
        }
      }
    }

    const insertedRows = rows.map((row, index) => {
      const nextRow = {
        ...row,
        id: row.id ?? `${this.table}-${this.state[this.table].length + index + 1}`,
      }
      this.state[this.table].push(nextRow)
      return nextRow
    })

    return {
      select: () => ({
        single: async () => ({
          data: insertedRows[0],
          error: null,
        }),
      }),
    }
  }

  update(updates: Row) {
    const rows = this.state[this.table]
    const filters: Array<(row: Row) => boolean> = []

    const applyUpdates = () => {
      const matchingRows: Row[] = []

      for (const [index, row] of rows.entries()) {
        if (!filters.every((filter) => filter(row))) {
          continue
        }

        const nextRow = {
          ...row,
          ...updates,
        }

        rows[index] = nextRow
        matchingRows.push(nextRow)
      }

      return matchingRows
    }

    const chain = {
      eq: async (column: string, value: unknown) => {
        filters.push((row) => row[column] === value)
        applyUpdates()
        return { error: null }
      },
      in: (column: string, values: unknown[]) => {
        filters.push((row) => values.includes(row[column]))
        return chain
      },
      select: async (_columns?: string, _options?: Record<string, unknown>) => {
        const matchingRows = applyUpdates()
        return {
          error: null,
          count: matchingRows.length,
        }
      },
    }

    return chain
  }

  upsert(payload: Row, options?: { onConflict?: string }) {
    let existingRow: Row | undefined

    if (this.table === 'email_platform_subscriber_mappings' && options?.onConflict === 'provider,family_id') {
      existingRow = this.state.email_platform_subscriber_mappings.find(
        (row) => row.provider === payload.provider && row.family_id === payload.family_id,
      )
    }

    if (existingRow) {
      Object.assign(existingRow, payload)
    } else {
      existingRow = {
        ...payload,
        id: payload.id ?? `${this.table}-${this.state[this.table].length + 1}`,
      }
      this.state[this.table].push(existingRow)
    }

    return {
      select: () => ({
        single: async () => ({
          data: existingRow,
          error: null,
        }),
      }),
    }
  }

  private filteredRows() {
    return this.state[this.table].filter((row) => this.filters.every((filter) => filter(row)))
  }
}

class MockAdminClient {
  constructor(private readonly state: DatabaseState) {}

  from(table: string) {
    return new MockQueryBuilder(table as TableName, this.state)
  }
}

describe('email platform runtime', () => {
  it('processes an outbound sync job and stores reconciliation metadata', async () => {
    const state = createDatabaseState({
      newsletter_family_preferences: [{family_id:'family-1',auth_family_id:'family-1',newsletter_subscription_status:'subscribed'}],
      email_platform_sync_jobs: [
        {
          id: 'job-1',
          family_id: 'family-1',
          job_type: 'upsert_subscriber',
          attempt_count: 0,
          max_attempts: 5,
          status: 'pending',
          next_retry_at: '2026-03-20T00:00:00.000Z',
        },
      ],
    })
    const adminClient = new MockAdminClient(state) as unknown as AdminClientLike
    const adapter = {
      upsertSubscriber: vi.fn().mockResolvedValue({
        externalSubscriberId: 'sub-1',
        externalEmailAddress: 'parent@example.com',
        providerState: 'active',
        providerVersionMarker: 'provider-v1',
        syncedTagNames: ['class:A1'],
        syncedTagIds: [11],
        syncedFieldKeys: ['child_classes', 'child_names', 'parent_type'],
        raw: {},
      }),
      getSubscriberSnapshot: vi.fn(),
    }

    const status = await processSyncJob(
      adminClient,
      state.email_platform_sync_jobs[0] as unknown as EmailPlatformSyncJobRow,
      createConfig(),
      {
        createAdapter: () => adapter as unknown as never,
      },
    )

    expect(status).toBe('succeeded')
    expect(adapter.upsertSubscriber).toHaveBeenCalledTimes(1)
    expect(state.email_platform_subscriber_mappings).toHaveLength(1)
    expect(state.email_platform_subscriber_mappings[0].external_subscriber_id).toBe('sub-1')
    expect(state.email_platform_subscriber_mappings[0].last_payload_fingerprint).toBeTruthy()
    expect(state.email_platform_subscriber_mappings[0].last_provider_version_marker).toBe('provider-v1')
    expect(state.email_platform_sync_jobs[0].status).toBe('succeeded')
    expect(state.email_platform_sync_jobs[0].payload_fingerprint).toBeTruthy()
  })

  it('marks retryable sync failures with incremented attempts and next retry time', async () => {
    const state = createDatabaseState({
      newsletter_family_preferences: [{family_id:'family-1',auth_family_id:'family-1',newsletter_subscription_status:'subscribed'}],
      email_platform_sync_jobs: [
        {
          id: 'job-1',
          family_id: 'family-1',
          job_type: 'upsert_subscriber',
          attempt_count: 0,
          max_attempts: 5,
          status: 'pending',
          next_retry_at: '2026-03-20T00:00:00.000Z',
        },
      ],
    })
    const adminClient = new MockAdminClient(state) as unknown as AdminClientLike
    const adapter = {
      upsertSubscriber: vi.fn().mockRejectedValue(
        new EmailPlatformError('network timeout', {
          code: 'kit_api_error',
          retryable: true,
        }),
      ),
      getSubscriberSnapshot: vi.fn(),
    }

    const status = await processSyncJob(
      adminClient,
      state.email_platform_sync_jobs[0] as unknown as EmailPlatformSyncJobRow,
      createConfig(),
      {
        createAdapter: () => adapter as unknown as never,
      },
    )

    expect(status).toBe('retryable')
    expect(state.email_platform_sync_jobs[0].status).toBe('retryable')
    expect(state.email_platform_sync_jobs[0].attempt_count).toBe(1)
    expect(state.email_platform_sync_jobs[0].last_error_code).toBe('kit_api_error')
    expect(state.email_platform_sync_jobs[0].next_retry_at).toBeTruthy()
  })

  it('accepts duplicate webhook deliveries without creating a second event', async () => {
    const state = createDatabaseState({
      email_platform_webhook_events: [
        {
          id: 'event-1',
          provider: 'kit',
          provider_event_id: 'evt-1',
          delivery_key: 'evt-1',
          event_type: 'subscriber.subscriber_unsubscribe',
          payload_hash: 'hash-1',
          payload: {},
          status: 'processed',
        },
      ],
    })
    const adminClient = new MockAdminClient(state) as unknown as AdminClientLike
    const request = new Request('https://example.com/webhook', {
      method: 'POST',
      headers: {
        'x-kit-webhook-secret': 'shared-secret',
        'x-kit-event-id': 'evt-1',
      },
    })
    const rawBody = JSON.stringify({
      event_type: 'subscriber.subscriber_unsubscribe',
      subscriber: {
        id: 42,
        email_address: 'parent@example.com',
        state: 'cancelled',
      },
    })

    const result = await persistWebhookEvent(adminClient, request, rawBody, createConfig())

    expect(result.accepted).toBe(true)
    expect(result.duplicate).toBe(true)
    expect(result.event?.id).toBe('event-1')
    expect(state.email_platform_webhook_events).toHaveLength(1)
  })

  it('queues reconciliation when a webhook references an unknown local subscriber', async () => {
    const state = createDatabaseState({
      email_platform_webhook_events: [
        {
          id: 'event-1',
          provider: 'kit',
          provider_event_id: 'evt-1',
          payload_hash: 'hash-1',
          payload: {
            event_type: 'subscriber.subscriber_unsubscribe',
            subscriber: {
              id: 42,
              email_address: 'missing@example.com',
              state: 'cancelled',
            },
          },
          status: 'received',
          attempt_count: 0,
          max_attempts: 5,
          next_retry_at: '2026-03-20T00:00:00.000Z',
        },
      ],
    })
    const adminClient = new MockAdminClient(state) as unknown as AdminClientLike

    const status = await processWebhookEvent(
      adminClient,
      state.email_platform_webhook_events[0] as unknown as EmailPlatformWebhookEventRow,
      createConfig(),
    )

    expect(status).toBe('unresolved')
    expect(state.email_platform_webhook_events[0].status).toBe('unresolved')
    expect(state.email_platform_webhook_events[0].unresolved_reason).toBe('unknown_local_subscriber')
    expect(state.email_platform_sync_jobs).toHaveLength(1)
    expect(state.email_platform_sync_jobs[0].job_type).toBe('reconcile_subscriber')
    expect(state.email_platform_sync_jobs[0].enqueue_reason).toBe('unknown_local_subscriber')
  })

  it('applies unsubscribe webhook state transitions and writes an audit row', async () => {
    const state = createDatabaseState({
      newsletter_family_preferences: [
        {
          id: 'family-1',
          family_id: 'family-1',
          auth_family_id: 'family-1',
          newsletter_subscription_status: 'subscribed',
          newsletter_subscription_updated_at: '2026-03-19T00:00:00.000Z',
        },
      ],
      email_platform_subscriber_mappings: [
        {
          id: 'mapping-1',
          family_id: 'family-1',
          provider: 'kit',
          external_subscriber_id: '42',
          external_email_address: 'parent@example.com',
        },
      ],
      email_platform_webhook_events: [
        {
          id: 'event-1',
          provider: 'kit',
          provider_event_id: 'evt-1',
          payload_hash: 'hash-1',
          payload: {
            event_type: 'subscriber.subscriber_unsubscribe',
            occurred_at: '2026-03-20T00:00:00.000Z',
            subscriber: {
              id: 42,
              email_address: 'parent@example.com',
              state: 'cancelled',
            },
          },
          status: 'received',
          attempt_count: 0,
          max_attempts: 5,
          next_retry_at: '2026-03-20T00:00:00.000Z',
        },
      ],
    })
    const adminClient = new MockAdminClient(state) as unknown as AdminClientLike

    const status = await processWebhookEvent(
      adminClient,
      state.email_platform_webhook_events[0] as unknown as EmailPlatformWebhookEventRow,
      createConfig(),
    )

    expect(status).toBe('processed')
    expect(state.newsletter_family_preferences[0].newsletter_subscription_status).toBe('unsubscribed')
    expect(state.newsletter_family_preferences[0].newsletter_subscription_source).toBe('kit_webhook')
    expect(state.newsletter_family_preferences[0].newsletter_unsubscribed_at).toBe('2026-03-20T00:00:00.000Z')
    expect(state.email_platform_subscription_audit).toHaveLength(1)
    expect(state.email_platform_subscription_audit[0].old_status).toBe('subscribed')
    expect(state.email_platform_subscription_audit[0].new_status).toBe('unsubscribed')
    expect(state.email_platform_webhook_events[0].status).toBe('processed')
  })
})

describe('Auth-owned recipients and consent', () => {
 it('defaults missing canonical consent to pending despite a subscribed legacy preference', async () => {
  const state=createDatabaseState({newsletter_family_preferences:[{family_id:'old-family',auth_family_id:null,newsletter_subscription_status:'subscribed'}]})
  const record=await loadRecipientRecord(new MockAdminClient(state) as unknown as AdminClientLike,'family-1')
  expect(record?.subscriptionStatus).toBe('pending')
  expect(record?.primaryEmail).toBe('parent@example.com')
 })
 it('does not select a primary address when a family has multiple adults', async () => {
  vi.mocked(currentDeliveryContacts).mockResolvedValue([contact,{...contact,personId:'parent-2',email:'second@example.com'}])
  const record=await loadRecipientRecord(new MockAdminClient(createDatabaseState()) as unknown as AdminClientLike,'family-1')
  expect(record?.primaryEmail).toBeNull()
 })
 it('never discovers a local family from an email without a provider mapping', async () => {
  const state=createDatabaseState({newsletter_family_preferences:[{family_id:'family-1',auth_family_id:'family-1',newsletter_subscription_status:'subscribed'}]})
  const event={id:'unknown-email',payload_hash:'hash',attempt_count:0,max_attempts:5,payload:{event_type:'subscriber.subscriber_unsubscribe',occurred_at:'2026-03-20T00:00:00.000Z',subscriber:{email_address:'parent@example.com',state:'cancelled'}}}
  state.email_platform_webhook_events.push(event)
  expect(await processWebhookEvent(new MockAdminClient(state) as unknown as AdminClientLike,event as unknown as EmailPlatformWebhookEventRow,createConfig())).toBe('unresolved')
  expect(state.newsletter_family_preferences[0].newsletter_subscription_status).toBe('subscribed')
  expect(state.email_platform_subscriber_mappings).toHaveLength(0)
 })
 it('does not overwrite a newer subscription with an older webhook', async () => {
  const state=createDatabaseState({newsletter_family_preferences:[{family_id:'family-1',auth_family_id:'family-1',newsletter_subscription_status:'subscribed',newsletter_subscription_updated_at:'2026-03-21T00:00:00.000Z'}],email_platform_subscriber_mappings:[{id:'mapping',provider:'kit',family_id:'family-1',external_subscriber_id:'42'}]})
  const event={id:'older-event',payload_hash:'hash',attempt_count:0,max_attempts:5,payload:{event_type:'subscriber.subscriber_unsubscribe',occurred_at:'2026-03-20T00:00:00.000Z',subscriber:{id:42,email_address:'parent@example.com',state:'cancelled'}}}
  state.email_platform_webhook_events.push(event)
  expect(await processWebhookEvent(new MockAdminClient(state) as unknown as AdminClientLike,event as unknown as EmailPlatformWebhookEventRow,createConfig())).toBe('processed')
  expect(state.newsletter_family_preferences[0].newsletter_subscription_status).toBe('subscribed')
  expect(state.newsletter_family_preferences[0].newsletter_subscription_updated_at).toBe('2026-03-21T00:00:00.000Z')
  expect(state.email_platform_subscription_audit[0].metadata).toMatchObject({applied:false})
 })
})
