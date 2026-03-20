import { describe, expect, it, vi } from 'vitest'

import type { EmailPlatformSyncJobRow, EmailPlatformWebhookEventRow } from '@/types/database'

import type { AdminClientLike } from '@/services/emailPlatform/runtime.ts'
import {
  persistWebhookEvent,
  processSyncJob,
  processWebhookEvent,
} from '@/services/emailPlatform/runtime.ts'
import { EmailPlatformConfig, EmailPlatformError } from '@/types/emailPlatform.ts'

type Row = Record<string, unknown>
type TableName =
  | 'families'
  | 'family_enrollment'
  | 'student_class_enrollment'
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
    families: [],
    family_enrollment: [],
    student_class_enrollment: [],
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
      families: [
        {
          id: 'family-1',
          family_name: 'Parent One',
          guardian_email: 'parent@example.com',
          is_active: true,
          newsletter_subscription_status: 'subscribed',
        },
      ],
      family_enrollment: [
        {
          family_id: 'family-1',
          parent_id: 'parent-1',
          relationship: 'mother',
        },
      ],
      student_class_enrollment: [
        {
          family_id: 'family-1',
          student_id: 'student-1',
          class_id: 'class-a1',
          graduated_at: null,
          students: {
            name: 'Alice',
            is_active: true,
          },
          classes: {
            class_name: 'Grade 1A',
            class_code: 'A1',
            is_active: true,
          },
        },
      ],
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
      families: [
        {
          id: 'family-1',
          family_name: 'Parent One',
          guardian_email: 'parent@example.com',
          is_active: true,
          newsletter_subscription_status: 'subscribed',
        },
      ],
      family_enrollment: [
        {
          family_id: 'family-1',
          parent_id: 'parent-1',
          relationship: 'mother',
        },
      ],
      student_class_enrollment: [
        {
          family_id: 'family-1',
          student_id: 'student-1',
          class_id: 'class-a1',
          graduated_at: null,
          students: {
            name: 'Alice',
            is_active: true,
          },
          classes: {
            class_name: 'Grade 1A',
            class_code: 'A1',
            is_active: true,
          },
        },
      ],
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
      families: [
        {
          id: 'family-1',
          family_name: 'Parent One',
          guardian_email: 'parent@example.com',
          is_active: true,
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
    expect(state.families[0].newsletter_subscription_status).toBe('unsubscribed')
    expect(state.families[0].newsletter_subscription_source).toBe('kit_webhook')
    expect(state.families[0].newsletter_unsubscribed_at).toBe('2026-03-20T00:00:00.000Z')
    expect(state.email_platform_subscription_audit).toHaveLength(1)
    expect(state.email_platform_subscription_audit[0].old_status).toBe('subscribed')
    expect(state.email_platform_subscription_audit[0].new_status).toBe('unsubscribed')
    expect(state.email_platform_webhook_events[0].status).toBe('processed')
  })
})
