import { currentDirectory, currentDeliveryContacts } from '#/services/identityDirectory'
import type { EmailPlatformRecipientRecord } from '../../types/emailPlatform'
import type { SupabaseClient } from '#/lib/supabase'

import type { EmailPlatformSyncJobRow, EmailPlatformWebhookEventRow } from '../../types/database'

import { KitAdapter } from './kitAdapter'
import { mapRecipientToKitPayload } from './kitMapping'
import {
  buildOperationalLog,
  buildWebhookEnvelope,
  classifyRetryableError,
  computePayloadFingerprint,
  createMetricSummary,
  mapWebhookEventToSubscriptionStatus,
  planRetry,
  shouldApplySubscriptionTransition,
  trackMetricOutcome,
} from './utils'
import { verifyKitWebhookSecret } from './webhook'
import {
  EmailPlatformConfig,
  EmailPlatformError,
  EmailPlatformJobType,
  EmailPlatformSyncJobStatus,
  EmailPlatformWebhookStatus,
} from '../../types/emailPlatform'

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-kit-webhook-secret, x-kit-event-id',
}

/** Supabase service client shape used by this module (tests may use a structural mock). */
export type AdminClientLike = Pick<SupabaseClient, 'from'>

/** PostgREST `select` overload used for head+count after update (typings vary by version). */
interface PostgrestBuilderWithCountSelect {
  select(
    columns: string,
    options: { count: 'exact'; head: boolean },
  ): Promise<{ error: { message: string } | null; count: number | null }>
}

export interface EmailPlatformRuntimeDependencies {
  createAdapter?: (config: EmailPlatformConfig) => KitAdapter
}

function createDefaultDependencies(): Required<EmailPlatformRuntimeDependencies> {
  return {
    createAdapter: (config) => new KitAdapter(config),
  }
}

export function buildJsonResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function getRetryConfig(
  jobOrEvent: { max_attempts?: number | null },
  config: EmailPlatformConfig,
) {
  return {
    maxAttempts: jobOrEvent.max_attempts ?? config.maxAttempts,
    initialRetryDelayMs: config.initialRetryDelayMs,
    maxRetryDelayMs: config.maxRetryDelayMs,
  }
}

/** Resolve only canonical Auth IDs or an explicit historical identifier mapping. */
export async function loadRecipientRecord(adminClient: AdminClientLike, familyId: string): Promise<EmailPlatformRecipientRecord | null> {
  const directory = await currentDirectory()
  let canonicalId = familyId
  if (!directory.families.some(family => family.id === canonicalId)) {
    const { data: rawMapping, error } = await adminClient.from('identity_reference_mappings')
      .select('auth_id').eq('entity_type', 'family').eq('legacy_id', familyId).maybeSingle()
    if (error) throw new Error(error.message)
    const mapping = rawMapping as { auth_id: string | null } | null
    if (!mapping?.auth_id) return null
    canonicalId = mapping.auth_id
  }
  const family = directory.families.find(row => row.id === canonicalId)
  if (!family) return null
  const contacts = (await currentDeliveryContacts()).filter(contact => contact.families.some(row => row.familyId === canonicalId))
  const { data: rawPreference, error } = await adminClient.from('newsletter_family_preferences')
    .select('newsletter_subscription_status').eq('auth_family_id', canonicalId).maybeSingle()
  if (error) throw new Error(error.message)
  const preference = rawPreference as { newsletter_subscription_status: EmailPlatformRecipientRecord['subscriptionStatus'] } | null
  const children = new Set(directory.familyMemberships.filter(row => row.familyId === canonicalId && row.relationship === 'child').map(row => row.personId))
  return {
    familyId,
    familyName: family.displayName,
    // A family-level provider mapping cannot safely choose between multiple adult addresses.
    primaryEmail: contacts.length === 1 ? contacts[0].email : null,
    isActive: true,
    subscriptionStatus: preference?.newsletter_subscription_status ?? 'pending',
    parentRelationships: directory.familyMemberships.filter(row => row.familyId === canonicalId && row.relationship !== 'child' && contacts.some(contact => contact.personId === row.personId)).map(row => row.relationship),
    children: directory.classMemberships.filter(row => row.relationship === 'student' && children.has(row.personId)).flatMap(row => {
      const student = directory.people.find(person => person.id === row.personId && person.kind === 'student')
      const klass = directory.classes.find(klass => klass.id === row.classId)
      return student && klass ? [{ studentId: student.id, name: student.displayName, classId: klass.id, classCode: klass.code, className: klass.displayName }] : []
    }),
  }
}

async function getMappingForFamily(adminClient: AdminClientLike, familyId: string) {
  const { data, error } = await adminClient
    .from('email_platform_subscriber_mappings')
    .select('*')
    .eq('provider', 'kit')
    .eq('family_id', familyId)
    .maybeSingle()

  if (error) {
    throw new Error(error.message)
  }

  return data
}

async function getMappingForExternalSubscriber(
  adminClient: AdminClientLike,
  externalSubscriberId: string | undefined,
) {
  if (!externalSubscriberId) {
    return null
  }

  const { data, error } = await adminClient
    .from('email_platform_subscriber_mappings')
    .select('*')
    .eq('provider', 'kit')
    .eq('external_subscriber_id', externalSubscriberId)
    .maybeSingle()

  if (error) {
    throw new Error(error.message)
  }

  return data
}

async function upsertMapping(
  adminClient: AdminClientLike,
  mappingInput: Record<string, unknown>,
) {
  const { data, error } = await adminClient
    .from('email_platform_subscriber_mappings')
    .upsert(mappingInput, {
      onConflict: 'provider,family_id',
    })
    .select('*')
    .single()

  if (error) {
    throw new Error(error.message)
  }

  return data
}

async function updateJobStatus(
  adminClient: AdminClientLike,
  jobId: string,
  updates: Record<string, unknown>,
) {
  const { error } = await adminClient
    .from('email_platform_sync_jobs')
    .update(updates)
    .eq('id', jobId)

  if (error) {
    throw new Error(error.message)
  }
}

async function updateWebhookStatus(
  adminClient: AdminClientLike,
  eventId: string,
  updates: Record<string, unknown>,
) {
  const { error } = await adminClient
    .from('email_platform_webhook_events')
    .update(updates)
    .eq('id', eventId)

  if (error) {
    throw new Error(error.message)
  }
}

export async function enqueueSyncJob(
  adminClient: AdminClientLike,
  jobInput: {
    familyId?: string | null
    mappingId?: string | null
    jobType: EmailPlatformJobType
    enqueueReason: string
    payload: unknown
    payloadFingerprint?: string | null
    mismatchReason?: string | null
  },
) {
  let query = adminClient
    .from('email_platform_sync_jobs')
    .select('id')
    .eq('provider', 'kit')
    .eq('job_type', jobInput.jobType)
    .in('status', ['pending', 'processing', 'retryable'])

  if (jobInput.familyId) {
    query = query.eq('family_id', jobInput.familyId)
  } else {
    query = query.is('family_id', null)
  }

  if (jobInput.payloadFingerprint) {
    query = query.eq('payload_fingerprint', jobInput.payloadFingerprint)
  }

  const { data: existingJobs, error: existingError } = await query.limit(1)

  if (existingError) {
    throw new Error(existingError.message)
  }

  if (existingJobs && existingJobs.length > 0) {
    return existingJobs[0]
  }

  const { data, error } = await adminClient
    .from('email_platform_sync_jobs')
    .insert({
      family_id: jobInput.familyId ?? null,
      mapping_id: jobInput.mappingId ?? null,
      provider: 'kit',
      job_type: jobInput.jobType,
      status: 'pending',
      enqueue_reason: jobInput.enqueueReason,
      payload: jobInput.payload,
      payload_fingerprint: jobInput.payloadFingerprint ?? null,
      mismatch_reason: jobInput.mismatchReason ?? null,
    })
    .select('id')
    .single()

  if (error) {
    throw new Error(error.message)
  }

  return data
}

export async function fetchDueSyncJobs(
  adminClient: AdminClientLike,
  config: EmailPlatformConfig,
  filters: { jobId?: string; limit?: number } = {},
) {
  let query = adminClient
    .from('email_platform_sync_jobs')
    .select('*')
    .eq('provider', 'kit')
    .in('status', ['pending', 'retryable'])
    .lte('next_retry_at', new Date().toISOString())
    .order('created_at', { ascending: true })
    .limit(filters.limit ?? config.workerBatchSize)

  if (filters.jobId) {
    query = query.eq('id', filters.jobId)
  }

  const { data, error } = await query

  if (error) {
    throw new Error(error.message)
  }

  return data ?? []
}

export async function fetchDueWebhookEvents(
  adminClient: AdminClientLike,
  config: EmailPlatformConfig,
  filters: { eventId?: string; includeUnresolved?: boolean } = {},
) {
  const statuses = filters.includeUnresolved
    ? ['received', 'retryable', 'unresolved']
    : ['received', 'retryable']
  let query = adminClient
    .from('email_platform_webhook_events')
    .select('*')
    .eq('provider', 'kit')
    .in('status', statuses)
    .lte('next_retry_at', new Date().toISOString())
    .order('received_at', { ascending: true })
    .limit(config.reconciliationBatchSize)

  if (filters.eventId) {
    query = query.eq('id', filters.eventId)
  }

  const { data, error } = await query

  if (error) {
    throw new Error(error.message)
  }

  return data ?? []
}

async function markJobProcessing(adminClient: AdminClientLike, jobId: string) {
  await updateJobStatus(adminClient, jobId, {
    status: 'processing',
    processing_started_at: new Date().toISOString(),
  })
}

async function markWebhookProcessing(adminClient: AdminClientLike, eventId: string) {
  await updateWebhookStatus(adminClient, eventId, {
    status: 'processing',
    processing_started_at: new Date().toISOString(),
  })
}

async function handleSyncJobFailure(
  adminClient: AdminClientLike,
  job: EmailPlatformSyncJobRow,
  error: unknown,
  config: EmailPlatformConfig,
): Promise<EmailPlatformSyncJobStatus> {
  const classifiedError = classifyRetryableError(error)
  const retryPlan = classifiedError.retryable
    ? planRetry(job.attempt_count ?? 0, getRetryConfig(job, config), new Date())
    : {
        attemptCount: (job.attempt_count ?? 0) + 1,
        nextRetryAt: null,
        shouldRetry: false,
        terminalStatus: 'failed' as const,
      }

  const status = retryPlan.shouldRetry ? 'retryable' : retryPlan.terminalStatus

  await updateJobStatus(adminClient, job.id, {
    status,
    attempt_count: retryPlan.attemptCount,
    next_retry_at: retryPlan.nextRetryAt ?? new Date().toISOString(),
    dead_lettered_at: status === 'dead_lettered' ? new Date().toISOString() : null,
    last_error_code: classifiedError.code,
    last_error_message: error instanceof Error ? error.message : String(error),
  })

  return status as EmailPlatformSyncJobStatus
}

async function handleWebhookFailure(
  adminClient: AdminClientLike,
  event: EmailPlatformWebhookEventRow,
  error: unknown,
  config: EmailPlatformConfig,
): Promise<EmailPlatformWebhookStatus> {
  const classifiedError = classifyRetryableError(error)
  const retryPlan = classifiedError.retryable
    ? planRetry(event.attempt_count ?? 0, getRetryConfig(event, config), new Date())
    : {
        attemptCount: (event.attempt_count ?? 0) + 1,
        nextRetryAt: null,
        shouldRetry: false,
        terminalStatus: 'failed' as const,
      }

  const status = retryPlan.shouldRetry ? 'retryable' : retryPlan.terminalStatus

  await updateWebhookStatus(adminClient, event.id, {
    status,
    attempt_count: retryPlan.attemptCount,
    next_retry_at: retryPlan.nextRetryAt ?? new Date().toISOString(),
    dead_lettered_at: status === 'dead_lettered' ? new Date().toISOString() : null,
    last_error_code: classifiedError.code,
    last_error_message: error instanceof Error ? error.message : String(error),
  })

  return status as EmailPlatformWebhookStatus
}

export async function processSyncJob(
  adminClient: AdminClientLike,
  job: EmailPlatformSyncJobRow,
  config: EmailPlatformConfig,
  dependencies: EmailPlatformRuntimeDependencies = {},
): Promise<EmailPlatformSyncJobStatus> {
  const { createAdapter } = { ...createDefaultDependencies(), ...dependencies }
  const adapter = createAdapter(config)
  await markJobProcessing(adminClient, job.id)

  try {
    if (!job.family_id && job.job_type === 'upsert_subscriber') {
      throw new EmailPlatformError('Sync job is missing family_id.', {
        code: 'missing_family_id',
        retryable: false,
      })
    }

    if (job.job_type === 'reconcile_subscriber') {
      return await processReconciliationJob(adminClient, job, adapter, config)
    }

    if (job.job_type === 'sync_newsletter_merge_properties') {
      return await processNewsletterMergePropertyJob(adminClient, job, adapter)
    }

    const familyId = job.family_id
    if (!familyId) {
      throw new EmailPlatformError('Sync job is missing family_id.', {
        code: 'missing_family_id',
        retryable: false,
      })
    }

    const recipient = await loadRecipientRecord(adminClient, familyId)

    if (!recipient) {
      throw new EmailPlatformError(`Family ${familyId} was not found.`, {
        code: 'family_not_found',
        retryable: false,
      })
    }

    if (!recipient.isActive || !recipient.primaryEmail || recipient.children.length === 0 || recipient.subscriptionStatus === 'pending') {
      throw new EmailPlatformError(
        `Family ${familyId} is not eligible for outbound Kit sync.`,
        {
          code: 'ineligible_recipient',
          retryable: false,
        },
      )
    }

    const payload = mapRecipientToKitPayload(recipient, {
      classTagPrefix: config.classTagPrefix,
    })
    const payloadFingerprint = await computePayloadFingerprint(payload)
    const syncOutcome = await adapter.upsertSubscriber({ payload })

    const mapping = await upsertMapping(adminClient, {
      family_id: recipient.familyId,
      provider: 'kit',
      external_identity_key: payload.externalIdentityKey,
      external_subscriber_id: syncOutcome.externalSubscriberId,
      external_email_address: syncOutcome.externalEmailAddress,
      provider_state: syncOutcome.providerState,
      last_synced_at: new Date().toISOString(),
      last_payload_fingerprint: payloadFingerprint,
      last_provider_version_marker: syncOutcome.providerVersionMarker,
      sync_metadata: {
        synced_tag_names: syncOutcome.syncedTagNames,
        synced_tag_ids: syncOutcome.syncedTagIds,
        synced_field_keys: syncOutcome.syncedFieldKeys,
      },
    })

    await updateJobStatus(adminClient, job.id, {
      mapping_id: mapping.id,
      status: 'succeeded',
      payload,
      payload_fingerprint: payloadFingerprint,
      completed_at: new Date().toISOString(),
      last_error_code: null,
      last_error_message: null,
      metrics: {
        synced_tag_count: syncOutcome.syncedTagNames.length,
        synced_field_count: syncOutcome.syncedFieldKeys.length,
      },
    })

    return 'succeeded'
  } catch (error) {
    return await handleSyncJobFailure(adminClient, job, error, config)
  }
}

async function processNewsletterMergePropertyJob(
  adminClient: AdminClientLike,
  job: EmailPlatformSyncJobRow,
  adapter: KitAdapter,
): Promise<EmailPlatformSyncJobStatus> {
  const payload = job.payload
  const emailAddress = typeof payload.email_address === 'string' ? payload.email_address : null
  const fields = payload.fields && typeof payload.fields === 'object'
    ? payload.fields as Record<string, string>
    : null
  const externalSubscriberId =
    typeof payload.external_subscriber_id === 'string' ? payload.external_subscriber_id : null
  const firstName = typeof payload.first_name === 'string' ? payload.first_name : null
  const deliveryRecipientId =
    typeof payload.delivery_recipient_id === 'string' ? payload.delivery_recipient_id : null

  if (!emailAddress || !fields) {
    throw new EmailPlatformError('Newsletter merge property job is missing email_address or fields.', {
      code: 'invalid_merge_property_job_payload',
      retryable: false,
    })
  }

  const outcome = await adapter.upsertSubscriberMergeProperties({
    externalSubscriberId,
    emailAddress,
    firstName,
    fields,
  })
  const completedAt = new Date().toISOString()

  if (deliveryRecipientId) {
    const { error } = await adminClient
      .from('newsletter_delivery_batch_recipients')
      .update({
        kit_merge_sync_status: 'synced',
        kit_merge_provider_field_ids: outcome.syncedFieldIdentifiers,
        kit_merge_last_synced_at: completedAt,
        kit_merge_provider_error: null,
        campaign_ready: true,
      })
      .eq('id', deliveryRecipientId)

    if (error) {
      throw new Error(error.message)
    }
  }

  await updateJobStatus(adminClient, job.id, {
    status: 'succeeded',
    completed_at: completedAt,
    last_error_code: null,
    last_error_message: null,
    metrics: {
      synced_field_count: outcome.syncedFieldKeys.length,
      external_subscriber_id: outcome.externalSubscriberId,
    },
  })

  return 'succeeded'
}

async function processReconciliationJob(
  adminClient: AdminClientLike,
  job: EmailPlatformSyncJobRow,
  adapter: KitAdapter,
  config: EmailPlatformConfig,
): Promise<EmailPlatformSyncJobStatus> {
  const familyId = job.family_id ?? null

  if (!familyId) {
    throw new EmailPlatformError('Reconciliation job could not resolve a local family.', {
      code: 'reconciliation_family_unresolved',
      retryable: true,
    })
  }

  const recipient = await loadRecipientRecord(adminClient, familyId)

  if (!recipient || !recipient.primaryEmail || recipient.subscriptionStatus === 'pending') {
    throw new EmailPlatformError(`Family ${familyId} is unavailable for reconciliation.`, {
      code: 'family_not_found',
      retryable: false,
    })
  }

  const payload = mapRecipientToKitPayload(recipient, {
    classTagPrefix: config.classTagPrefix,
  })
  const payloadFingerprint = await computePayloadFingerprint(payload)
  const mapping = await getMappingForFamily(adminClient, familyId)

  if (!mapping?.external_subscriber_id) {
    await enqueueSyncJob(adminClient, {
      familyId,
      mappingId: mapping?.id ?? null,
      jobType: 'upsert_subscriber',
      enqueueReason: 'reconciliation_mapping_missing',
      payload,
      payloadFingerprint,
      mismatchReason: 'mapping_missing',
    })

    await updateJobStatus(adminClient, job.id, {
      family_id: familyId,
      mapping_id: mapping?.id ?? null,
      status: 'succeeded',
      payload,
      payload_fingerprint: payloadFingerprint,
      completed_at: new Date().toISOString(),
      mismatch_reason: 'mapping_missing',
      metrics: { queued_upsert: true },
    })

    return 'succeeded'
  }

  const snapshot = await adapter.getSubscriberSnapshot(mapping.external_subscriber_id)
  const expectedFields = payload.customFields
  const currentClassTags = snapshot.tagNames
    .filter((tagName) => tagName.startsWith(config.classTagPrefix))
    .sort((left, right) => left.localeCompare(right))
  const expectedClassTags = payload.tagNames.sort((left, right) => left.localeCompare(right))
  const mismatchReasons: string[] = []

  if (snapshot.state !== payload.state) {
    mismatchReasons.push('subscriber_state')
  }

  if (
    snapshot.fields.child_classes !== expectedFields.child_classes ||
    snapshot.fields.child_names !== expectedFields.child_names ||
    snapshot.fields.parent_type !== expectedFields.parent_type
  ) {
    mismatchReasons.push('custom_fields')
  }

  if (JSON.stringify(currentClassTags) !== JSON.stringify(expectedClassTags)) {
    mismatchReasons.push('class_tags')
  }

  await upsertMapping(adminClient, {
    family_id: familyId,
    provider: 'kit',
    external_identity_key: payload.externalIdentityKey,
    external_subscriber_id: snapshot.externalSubscriberId,
    external_email_address: snapshot.emailAddress,
    provider_state: snapshot.state,
    last_payload_fingerprint: payloadFingerprint,
    last_provider_version_marker: snapshot.providerVersionMarker,
    last_reconciled_at: new Date().toISOString(),
    last_drift_reason: mismatchReasons.join(', ') || null,
    sync_metadata: {
      last_snapshot_fields: snapshot.fields,
      last_snapshot_tags: snapshot.tagNames,
    },
  })

  if (mismatchReasons.length > 0) {
    await enqueueSyncJob(adminClient, {
      familyId,
      mappingId: mapping.id,
      jobType: 'upsert_subscriber',
      enqueueReason: 'provider_drift_detected',
      payload,
      payloadFingerprint,
      mismatchReason: mismatchReasons.join(', '),
    })
  }

  await updateJobStatus(adminClient, job.id, {
    family_id: familyId,
    mapping_id: mapping.id,
    status: 'succeeded',
    payload,
    payload_fingerprint: payloadFingerprint,
    completed_at: new Date().toISOString(),
    mismatch_reason: mismatchReasons.join(', ') || null,
    metrics: {
      drift_detected: mismatchReasons.length > 0,
      mismatch_reasons: mismatchReasons,
    },
  })

  return 'succeeded'
}

export async function processPendingSyncJobs(
  adminClient: AdminClientLike,
  config: EmailPlatformConfig,
  filters: { jobId?: string; limit?: number } = {},
  dependencies: EmailPlatformRuntimeDependencies = {},
) {
  const jobs = await fetchDueSyncJobs(adminClient, config, filters)
  const summary = createMetricSummary()

  for (const job of jobs) {
    const status = await processSyncJob(adminClient, job, config, dependencies)
    trackMetricOutcome(summary, status)
  }

  console.log(buildOperationalLog('upsert_subscriber', summary, { total_jobs: jobs.length }))

  return {
    jobsProcessed: jobs.length,
    summary,
  }
}

export async function persistWebhookEvent(
  adminClient: AdminClientLike,
  request: Request,
  rawBody: string,
  config: EmailPlatformConfig,
) {
  const verification = verifyKitWebhookSecret(request, config)

  if (!verification.isValid) {
    return {
      accepted: false,
      response: buildJsonResponse(
        {
          error: verification.failureReason,
        },
        401,
      ),
    }
  }

  const payload = JSON.parse(rawBody) as Record<string, unknown>
  const envelope = await buildWebhookEnvelope(
    payload,
    request.headers.get('x-kit-event-id') ?? undefined,
  )

  const insertPayload = {
    provider: 'kit',
    provider_event_id: envelope.providerEventId,
    event_type: envelope.eventType,
    delivery_key: envelope.providerEventId,
    signature_valid: true,
    payload: envelope.payload,
    payload_hash: envelope.payloadHash,
    occurred_at: envelope.occurredAt ?? null,
    status: 'received',
  }

  const { data, error } = await adminClient
    .from('email_platform_webhook_events')
    .insert(insertPayload)
    .select('*')
    .single()

  if (error) {
    if (/duplicate key/i.test(error.message)) {
      const { data: existingEvent, error: existingError } = await adminClient
        .from('email_platform_webhook_events')
        .select('*')
        .eq('provider', 'kit')
        .eq('delivery_key', envelope.providerEventId)
        .single()

      if (existingError) {
        throw new Error(existingError.message)
      }

      return {
        accepted: true,
        duplicate: true,
        event: existingEvent,
        response: buildJsonResponse({
          accepted: true,
          duplicate: true,
          eventId: existingEvent.id,
        }),
      }
    }

    throw new Error(error.message)
  }

  return {
    accepted: true,
    duplicate: false,
    event: data,
    response: buildJsonResponse({
      accepted: true,
      duplicate: false,
      eventId: data.id,
    }),
  }
}

export async function processWebhookEvent(
  adminClient: AdminClientLike,
  event: EmailPlatformWebhookEventRow,
  config: EmailPlatformConfig,
): Promise<EmailPlatformWebhookStatus> {
  await markWebhookProcessing(adminClient, event.id)

  try {
    const envelope = await buildWebhookEnvelope(
      event.payload as Record<string, unknown>,
      event.provider_event_id,
    )
    const mapping = await getMappingForExternalSubscriber(
      adminClient,
      envelope.subscriber.externalSubscriberId,
    )
    // Subscription history is CMS-owned; provider IDs must already be explicitly linked.
    // Never infer family identity from an email address in an incoming webhook.
    const { data: rawPreference, error: preferenceError } = mapping?.family_id
      ? await adminClient.from('newsletter_family_preferences').select('*').eq('family_id', mapping.family_id).maybeSingle()
      : { data: null, error: null }
    if (preferenceError) throw new Error(preferenceError.message)
    const preference = rawPreference as { family_id: string; newsletter_subscription_status: EmailPlatformRecipientRecord['subscriptionStatus']; newsletter_subscription_updated_at: string | null } | null
    const family = preference ? { ...preference, id: preference.family_id } : null

    if (!family) {
      await enqueueSyncJob(adminClient, {
        familyId: null,
        mappingId: null,
        jobType: 'reconcile_subscriber',
        enqueueReason: 'unknown_local_subscriber',
        payload: {
          email_address: envelope.subscriber.emailAddress ?? null,
          external_subscriber_id: envelope.subscriber.externalSubscriberId ?? null,
          provider_event_id: envelope.providerEventId,
        },
        payloadFingerprint: event.payload_hash,
        mismatchReason: 'unknown_local_subscriber',
      })

      await updateWebhookStatus(adminClient, event.id, {
        status: 'unresolved',
        unresolved_reason: 'unknown_local_subscriber',
        resolved_family_id: null,
        resolved_mapping_id: null,
        last_error_code: null,
        last_error_message: null,
      })

      return 'unresolved'
    }

    const nextStatus = mapWebhookEventToSubscriptionStatus(
      envelope.eventType,
      envelope.subscriber.state,
    )
    const occurredAt = envelope.occurredAt ?? new Date().toISOString()
    const shouldApply = shouldApplySubscriptionTransition(
      family.newsletter_subscription_updated_at,
      occurredAt,
    )

    if (shouldApply) {
      const familyUpdate: Record<string, unknown> = {
        newsletter_subscription_status: nextStatus,
        newsletter_subscription_source: 'kit_webhook',
        newsletter_subscription_updated_at: occurredAt,
      }

      if (nextStatus === 'subscribed') {
        familyUpdate.newsletter_subscribed_at = occurredAt
      }

      if (nextStatus === 'unsubscribed') {
        familyUpdate.newsletter_unsubscribed_at = occurredAt
      }

      const { error: familyUpdateError } = await adminClient
        .from('newsletter_family_preferences')
        .update(familyUpdate)
        .eq('family_id', family.id)

      if (familyUpdateError) {
        throw new Error(familyUpdateError.message)
      }
    }

    if (mapping) {
      await upsertMapping(adminClient, {
        family_id: family.id,
        provider: 'kit',
        external_identity_key: `family:${family.id}`,
        external_subscriber_id: envelope.subscriber.externalSubscriberId ?? mapping.external_subscriber_id,
        external_email_address: envelope.subscriber.emailAddress ?? mapping.external_email_address ?? null,
        provider_state: envelope.subscriber.state ?? null,
        last_provider_version_marker: event.payload_hash,
        last_reconciled_at: new Date().toISOString(),
        sync_metadata: {
          last_webhook_event_type: envelope.eventType,
          last_webhook_payload_hash: event.payload_hash,
        },
      })
    }

    const { error: auditError } = await adminClient
      .from('email_platform_subscription_audit')
      .insert({
        family_id: family.id,
        provider: 'kit',
        mapping_id: mapping?.id ?? null,
        webhook_event_id: event.id,
        old_status: family.newsletter_subscription_status ?? null,
        new_status: nextStatus,
        source: 'kit_webhook',
        event_type: envelope.eventType,
        occurred_at: occurredAt,
        metadata: {
          applied: shouldApply,
          provider_event_id: envelope.providerEventId,
        },
      })

    if (auditError) {
      throw new Error(auditError.message)
    }

    await updateWebhookStatus(adminClient, event.id, {
      status: 'processed',
      processed_at: new Date().toISOString(),
      resolved_family_id: family.id,
      resolved_mapping_id: mapping?.id ?? null,
      unresolved_reason: null,
      last_error_code: null,
      last_error_message: null,
      metrics: {
        applied_transition: shouldApply,
        next_status: nextStatus,
      },
    })

    return 'processed'
  } catch (error) {
    return await handleWebhookFailure(adminClient, event, error, config)
  }
}

export async function processPendingWebhookEvents(
  adminClient: AdminClientLike,
  config: EmailPlatformConfig,
  filters: { eventId?: string; includeUnresolved?: boolean } = {},
) {
  const events = await fetchDueWebhookEvents(adminClient, config, filters)
  const summary = createMetricSummary()

  for (const event of events) {
    const status = await processWebhookEvent(adminClient, event, config)
    trackMetricOutcome(summary, status)
  }

  console.log(buildOperationalLog('webhook', summary, { total_events: events.length }))

  return {
    eventsProcessed: events.length,
    summary,
  }
}

export async function replayFailedEmailPlatformWork(
  adminClient: AdminClientLike,
  body: {
    jobIds?: string[]
    webhookEventIds?: string[]
    replayAllFailed?: boolean
  },
) {
  let jobsUpdated = 0
  let eventsUpdated = 0

  if (body.replayAllFailed || (body.jobIds && body.jobIds.length > 0)) {
    let jobQuery = adminClient
      .from('email_platform_sync_jobs')
      .update({
        status: 'pending',
        attempt_count: 0,
        next_retry_at: new Date().toISOString(),
        dead_lettered_at: null,
        last_error_code: null,
        last_error_message: null,
      })
      .in('status', ['failed', 'dead_lettered'])

    if (!body.replayAllFailed && body.jobIds) {
      jobQuery = jobQuery.in('id', body.jobIds)
    }

    const { error, count } = await (jobQuery as unknown as PostgrestBuilderWithCountSelect).select('*', {
      count: 'exact',
      head: true,
    })

    if (error) {
      throw new Error(error.message)
    }

    jobsUpdated = count ?? 0
  }

  if (body.replayAllFailed || (body.webhookEventIds && body.webhookEventIds.length > 0)) {
    let eventQuery = adminClient
      .from('email_platform_webhook_events')
      .update({
        status: 'received',
        attempt_count: 0,
        next_retry_at: new Date().toISOString(),
        dead_lettered_at: null,
        last_error_code: null,
        last_error_message: null,
        unresolved_reason: null,
      })
      .in('status', ['failed', 'dead_lettered', 'unresolved'])

    if (!body.replayAllFailed && body.webhookEventIds) {
      eventQuery = eventQuery.in('id', body.webhookEventIds)
    }

    const { error, count } = await (eventQuery as unknown as PostgrestBuilderWithCountSelect).select('*', {
      count: 'exact',
      head: true,
    })

    if (error) {
      throw new Error(error.message)
    }

    eventsUpdated = count ?? 0
  }

  return {
    jobsUpdated,
    eventsUpdated,
  }
}

export async function handleWorkerRequest(
  handler: () => Promise<Record<string, unknown>>,
) {
  try {
    const result = await handler()
    return buildJsonResponse(result)
  } catch (error) {
    console.error('Email platform worker error:', error)
    return buildJsonResponse(
      {
        error: error instanceof Error ? error.message : String(error),
      },
      500,
    )
  }
}
