import { buildNewsletterMergeFieldKeys } from '@/services/emailPlatform/kitMapping'
import { computePayloadFingerprint } from '@/services/emailPlatform/utils'
import type {
  EmailPlatformAdapter,
  EmailPlatformMergePropertySyncOutcome,
  EmailPlatformRecipientPayload,
  ParentType,
} from '@/types/emailPlatform'
import type { PreparedRecipientRecord } from '@/types/emailPreparation'
import type {
  KitClassArticleExcerpt,
  KitClassArticleExcerptSet,
  KitMergePropertyLimits,
  KitMergePropertySyncState,
  KitMergePropertyValidationError,
  KitNewsletterMergeFieldKeys,
  KitNewsletterMergePropertyPayload,
  KitProviderFieldIdentifierMap,
} from '@/types/kitMergeProperties'
import type { PersonalizedEmailResolvedBlock } from '@/types/personalization'

const DEFAULT_LIMITS: KitMergePropertyLimits = {
  maxArticlesPerRecipient: 20,
  maxExcerptLength: 5_000,
  maxSerializedPayloadBytes: 100_000,
  requiredFieldKeys: ['classArticleExcerpts'],
}

export interface KitMergePropertySubscriberMapping {
  externalSubscriberId: string | null
  externalEmailAddress?: string | null
}

export interface KitMergePropertySyncRecipientInput {
  preparedRecipient: PreparedRecipientRecord
  existingSyncState?: KitMergePropertySyncState | null
  subscriberMapping?: KitMergePropertySubscriberMapping | null
}

export interface KitMergePropertySyncInput {
  batchId: string
  newsletterId: string
  recipients: KitMergePropertySyncRecipientInput[]
  adapter: Pick<EmailPlatformAdapter, 'upsertSubscriberMergeProperties'>
  limits?: Partial<KitMergePropertyLimits>
}

export interface KitMergePropertyRecipientSyncResult {
  recipientId: string
  familyId: string | null
  externalSubscriberId: string | null
  payload: KitNewsletterMergePropertyPayload | null
  syncState: KitMergePropertySyncState
  providerOutcome: EmailPlatformMergePropertySyncOutcome | null
}

export interface KitMergePropertySyncResult {
  syncedRecipients: KitMergePropertyRecipientSyncResult[]
  skippedRecipients: KitMergePropertyRecipientSyncResult[]
  failedRecipients: KitMergePropertyRecipientSyncResult[]
  campaignReadyRecipients: KitMergePropertyRecipientSyncResult[]
}

function emptyFieldIdentifiers(): KitProviderFieldIdentifierMap {
  return {}
}

function normalizeText(value: string | null | undefined): string {
  return value?.trim() ?? ''
}

function normalizeList(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean))).sort((left, right) =>
    left.localeCompare(right),
  )
}

function splitName(emailAddress: string): { firstName: string | null; lastName: string | null } {
  const localPart = emailAddress.split('@')[0] ?? ''
  const parts = localPart
    .replace(/[._-]+/g, ' ')
    .split(' ')
    .map((part) => part.trim())
    .filter(Boolean)

  if (parts.length === 0) {
    return { firstName: null, lastName: null }
  }

  return {
    firstName: parts[0] ?? null,
    lastName: parts.length > 1 ? parts.slice(1).join(' ') : null,
  }
}

function stripHtml(value: string): string {
  return value
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
}

function toArticleExcerpt(block: PersonalizedEmailResolvedBlock): KitClassArticleExcerpt {
  return {
    blockId: block.blockId,
    title: block.title ?? null,
    excerpt: stripHtml(block.content),
    editorialOrder: block.editorialOrder,
    personalizationKey: block.personalizationKey,
    classId: block.classId ?? '',
  }
}

function classArticleExcerptSetsFromPayload(
  preparedRecipient: PreparedRecipientRecord,
): KitClassArticleExcerptSet[] {
  if (preparedRecipient.kitMergeData.classArticleExcerptSets.length > 0) {
    return preparedRecipient.kitMergeData.classArticleExcerptSets
  }

  const blocksByClass = new Map<string, PersonalizedEmailResolvedBlock[]>()
  for (const block of preparedRecipient.payload.classBlocks) {
    const classId = block.classId ?? ''
    if (!classId) continue
    const blocks = blocksByClass.get(classId) ?? []
    blocks.push(block)
    blocksByClass.set(classId, blocks)
  }

  return preparedRecipient.payload.resolvedClassIds.map((classId) => ({
    classId,
    excerpts: [...(blocksByClass.get(classId) ?? [])]
      .sort((left, right) => {
        if (left.editorialOrder !== right.editorialOrder) {
          return left.editorialOrder - right.editorialOrder
        }
        return left.blockId.localeCompare(right.blockId)
      })
      .map(toArticleExcerpt),
  }))
}

function buildStablePayload(preparedRecipient: PreparedRecipientRecord): Pick<
  EmailPlatformRecipientPayload,
  'customFields' | 'parentType' | 'childClasses' | 'childNames' | 'firstName'
> {
  const familyId = preparedRecipient.payload.familyId ?? preparedRecipient.guardianId
  const identity = preparedRecipient.kitMergeData.identity
  const stableMetadata = preparedRecipient.kitMergeData.stableMetadata
  const fallbackName = splitName(preparedRecipient.guardianEmail)
  const firstName = normalizeText(identity.firstName) || fallbackName.firstName || undefined
  const lastName = normalizeText(identity.lastName) || fallbackName.lastName || ''
  const parentType: ParentType = stableMetadata.parentType

  return {
    firstName,
    parentType,
    childClasses: normalizeList(stableMetadata.childClasses),
    childNames: normalizeList(stableMetadata.childNames),
    customFields: {
      external_identity_key: `family:${familyId}`,
      first_name: firstName ?? '',
      last_name: lastName,
      child_classes: normalizeList(stableMetadata.childClasses).join(', '),
      child_names: normalizeList(stableMetadata.childNames).join(', '),
      parent_type: parentType,
    },
  }
}

async function buildPayload(input: {
  batchId: string
  newsletterId: string
  preparedRecipient: PreparedRecipientRecord
  fieldKeys: KitNewsletterMergeFieldKeys
}): Promise<KitNewsletterMergePropertyPayload> {
  const stablePayload = buildStablePayload(input.preparedRecipient)
  const classArticleExcerptSets = classArticleExcerptSetsFromPayload(input.preparedRecipient)
  const articleCount = classArticleExcerptSets.reduce((sum, set) => sum + set.excerpts.length, 0)
  const mergePayloadWithoutFingerprint = {
    batchId: input.batchId,
    newsletterId: input.newsletterId,
    recipientId: input.preparedRecipient.guardianId,
    familyId: input.preparedRecipient.payload.familyId ?? null,
    guardianEmail: input.preparedRecipient.guardianEmail,
    identity: input.preparedRecipient.kitMergeData.identity,
    stableMetadata: {
      externalIdentityKey: `family:${input.preparedRecipient.payload.familyId ?? input.preparedRecipient.guardianId}`,
      parentType: stablePayload.parentType,
      childClasses: stablePayload.childClasses,
      childNames: stablePayload.childNames,
    },
    classArticleExcerptSets,
  }
  const payloadFingerprint = await computePayloadFingerprint(mergePayloadWithoutFingerprint)
  const fields = {
    ...stablePayload.customFields,
    [input.fieldKeys.classArticleExcerpts]: JSON.stringify(classArticleExcerptSets),
    [input.fieldKeys.classArticleCount]: String(articleCount),
    [input.fieldKeys.payloadFingerprint]: payloadFingerprint,
  }

  return {
    ...mergePayloadWithoutFingerprint,
    fieldKeys: input.fieldKeys,
    fields,
    payloadFingerprint,
  }
}

function serializedByteLength(value: unknown): number {
  return new TextEncoder().encode(JSON.stringify(value)).byteLength
}

function validatePayload(
  payload: KitNewsletterMergePropertyPayload,
  limits: KitMergePropertyLimits,
): KitMergePropertyValidationError[] {
  const errors: KitMergePropertyValidationError[] = []
  const articleCount = payload.classArticleExcerptSets.reduce((sum, set) => sum + set.excerpts.length, 0)

  if (articleCount > limits.maxArticlesPerRecipient) {
    errors.push({
      code: 'article_count_exceeded',
      message: `Kit merge payload contains ${articleCount} articles; max is ${limits.maxArticlesPerRecipient}.`,
      fieldKey: payload.fieldKeys.classArticleCount,
      details: { articleCount, maxArticlesPerRecipient: limits.maxArticlesPerRecipient },
    })
  }

  for (const set of payload.classArticleExcerptSets) {
    for (const excerpt of set.excerpts) {
      if (excerpt.excerpt.length === 0) {
        errors.push({
          code: 'missing_required_excerpt',
          message: `Missing required article excerpt for class ${set.classId}.`,
          fieldKey: payload.fieldKeys.classArticleExcerpts,
          classId: set.classId,
          details: { blockId: excerpt.blockId },
        })
      }
      if (excerpt.excerpt.length > limits.maxExcerptLength) {
        errors.push({
          code: 'excerpt_length_exceeded',
          message: `Article excerpt ${excerpt.blockId} exceeds ${limits.maxExcerptLength} characters.`,
          fieldKey: payload.fieldKeys.classArticleExcerpts,
          classId: set.classId,
          details: { blockId: excerpt.blockId, length: excerpt.excerpt.length },
        })
      }
    }
  }

  for (const requiredFieldKey of limits.requiredFieldKeys) {
    const fieldKey = payload.fieldKeys[requiredFieldKey]
    if (!fieldKey || payload.fields[fieldKey] == null) {
      errors.push({
        code: 'missing_required_property',
        message: `Missing required Kit merge property ${String(requiredFieldKey)}.`,
        fieldKey,
      })
    }
  }

  const serializedSize = serializedByteLength(payload.fields)
  if (serializedSize > limits.maxSerializedPayloadBytes) {
    errors.push({
      code: 'payload_size_exceeded',
      message: `Kit merge payload is ${serializedSize} bytes; max is ${limits.maxSerializedPayloadBytes}.`,
      details: { serializedSize, maxSerializedPayloadBytes: limits.maxSerializedPayloadBytes },
    })
  }

  return errors
}

function createSyncState(input: Partial<KitMergePropertySyncState>): KitMergePropertySyncState {
  return {
    status: input.status ?? 'pending',
    payloadFingerprint: input.payloadFingerprint ?? null,
    lastSuccessfulPayloadFingerprint: input.lastSuccessfulPayloadFingerprint ?? null,
    lastSuccessfulSyncedAt: input.lastSuccessfulSyncedAt ?? null,
    providerFieldIdentifiers: input.providerFieldIdentifiers ?? emptyFieldIdentifiers(),
    providerError: input.providerError ?? null,
    validationErrors: input.validationErrors ?? [],
    driftReason: input.driftReason ?? null,
    campaignReady: input.campaignReady ?? false,
  }
}

export class KitMergePropertySyncService {
  async syncPreparedRecipients(input: KitMergePropertySyncInput): Promise<KitMergePropertySyncResult> {
    const limits: KitMergePropertyLimits = {
      ...DEFAULT_LIMITS,
      ...input.limits,
      requiredFieldKeys: input.limits?.requiredFieldKeys ?? DEFAULT_LIMITS.requiredFieldKeys,
    }
    const fieldKeys = buildNewsletterMergeFieldKeys({
      deliveryBatchId: input.batchId,
      newsletterId: input.newsletterId,
    })
    const results: KitMergePropertyRecipientSyncResult[] = []

    for (const recipientInput of input.recipients) {
      results.push(await this.syncRecipient({ ...recipientInput, input, fieldKeys, limits }))
    }

    return {
      syncedRecipients: results.filter((result) => result.syncState.status === 'synced' && result.providerOutcome),
      skippedRecipients: results.filter((result) => result.syncState.status === 'skipped' || !result.providerOutcome),
      failedRecipients: results.filter((result) => result.syncState.status === 'failed'),
      campaignReadyRecipients: results.filter((result) => result.syncState.campaignReady),
    }
  }

  private async syncRecipient(args: {
    preparedRecipient: PreparedRecipientRecord
    existingSyncState?: KitMergePropertySyncState | null
    subscriberMapping?: KitMergePropertySubscriberMapping | null
    input: KitMergePropertySyncInput
    fieldKeys: KitNewsletterMergeFieldKeys
    limits: KitMergePropertyLimits
  }): Promise<KitMergePropertyRecipientSyncResult> {
    const { preparedRecipient, existingSyncState } = args

    if (preparedRecipient.status !== 'ready') {
      return {
        recipientId: preparedRecipient.guardianId,
        familyId: preparedRecipient.payload.familyId ?? null,
        externalSubscriberId: args.subscriberMapping?.externalSubscriberId ?? null,
        payload: null,
        providerOutcome: null,
        syncState: createSyncState({
          status: 'skipped',
          providerError: 'recipient_not_ready',
          validationErrors: [],
          campaignReady: false,
        }),
      }
    }

    const payload = await buildPayload({
      batchId: args.input.batchId,
      newsletterId: args.input.newsletterId,
      preparedRecipient,
      fieldKeys: args.fieldKeys,
    })
    const validationErrors = validatePayload(payload, args.limits)
    const previousSuccessfulFingerprint =
      existingSyncState?.lastSuccessfulPayloadFingerprint ?? existingSyncState?.payloadFingerprint ?? null
    const driftReason =
      previousSuccessfulFingerprint && previousSuccessfulFingerprint !== payload.payloadFingerprint
        ? 'payload_fingerprint_changed'
        : null

    if (validationErrors.length > 0) {
      return {
        recipientId: preparedRecipient.guardianId,
        familyId: preparedRecipient.payload.familyId ?? null,
        externalSubscriberId: args.subscriberMapping?.externalSubscriberId ?? null,
        payload,
        providerOutcome: null,
        syncState: createSyncState({
          status: 'failed',
          payloadFingerprint: payload.payloadFingerprint,
          lastSuccessfulPayloadFingerprint: existingSyncState?.lastSuccessfulPayloadFingerprint ?? null,
          lastSuccessfulSyncedAt: existingSyncState?.lastSuccessfulSyncedAt ?? null,
          providerFieldIdentifiers: existingSyncState?.providerFieldIdentifiers,
          providerError: validationErrors[0]?.message ?? 'validation_failed',
          validationErrors,
          driftReason,
          campaignReady: false,
        }),
      }
    }

    if (
      existingSyncState?.status === 'synced' &&
      existingSyncState.lastSuccessfulPayloadFingerprint === payload.payloadFingerprint
    ) {
      return {
        recipientId: preparedRecipient.guardianId,
        familyId: preparedRecipient.payload.familyId ?? null,
        externalSubscriberId: args.subscriberMapping?.externalSubscriberId ?? null,
        payload,
        providerOutcome: null,
        syncState: createSyncState({
          status: 'synced',
          payloadFingerprint: payload.payloadFingerprint,
          lastSuccessfulPayloadFingerprint: existingSyncState.lastSuccessfulPayloadFingerprint,
          lastSuccessfulSyncedAt: existingSyncState.lastSuccessfulSyncedAt,
          providerFieldIdentifiers: existingSyncState.providerFieldIdentifiers,
          validationErrors: [],
          campaignReady: true,
        }),
      }
    }

    try {
      const outcome = await args.input.adapter.upsertSubscriberMergeProperties({
        externalSubscriberId: args.subscriberMapping?.externalSubscriberId ?? null,
        emailAddress: preparedRecipient.guardianEmail,
        firstName: payload.identity.firstName,
        fields: payload.fields,
      })

      return {
        recipientId: preparedRecipient.guardianId,
        familyId: preparedRecipient.payload.familyId ?? null,
        externalSubscriberId: outcome.externalSubscriberId,
        payload,
        providerOutcome: outcome,
        syncState: createSyncState({
          status: 'synced',
          payloadFingerprint: payload.payloadFingerprint,
          lastSuccessfulPayloadFingerprint: payload.payloadFingerprint,
          lastSuccessfulSyncedAt: new Date().toISOString(),
          providerFieldIdentifiers: outcome.syncedFieldIdentifiers,
          validationErrors: [],
          driftReason,
          campaignReady: true,
        }),
      }
    } catch (error) {
      return {
        recipientId: preparedRecipient.guardianId,
        familyId: preparedRecipient.payload.familyId ?? null,
        externalSubscriberId: args.subscriberMapping?.externalSubscriberId ?? null,
        payload,
        providerOutcome: null,
        syncState: createSyncState({
          status: 'failed',
          payloadFingerprint: payload.payloadFingerprint,
          lastSuccessfulPayloadFingerprint: existingSyncState?.lastSuccessfulPayloadFingerprint ?? null,
          lastSuccessfulSyncedAt: existingSyncState?.lastSuccessfulSyncedAt ?? null,
          providerFieldIdentifiers: existingSyncState?.providerFieldIdentifiers,
          providerError: error instanceof Error ? error.message : String(error),
          validationErrors: [],
          driftReason,
          campaignReady: false,
        }),
      }
    }
  }
}

export const kitMergePropertySyncService = new KitMergePropertySyncService()

