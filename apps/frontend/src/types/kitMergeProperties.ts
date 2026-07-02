import type { ParentType } from '@/types/emailPlatform'
import type { PersonalizedEmailResolvedBlock } from '@/types/personalization'

export type KitMergePropertySyncStatus =
  | 'pending'
  | 'skipped'
  | 'syncing'
  | 'synced'
  | 'failed'
  | 'drifted'

export type KitMergePropertyValidationCode =
  | 'missing_required_property'
  | 'missing_required_excerpt'
  | 'article_count_exceeded'
  | 'excerpt_length_exceeded'
  | 'payload_size_exceeded'

export interface KitMergePropertyValidationError {
  code: KitMergePropertyValidationCode
  message: string
  fieldKey?: string
  classId?: string
  details?: Record<string, unknown>
}

export interface KitProviderFieldIdentifier {
  key: string
  providerFieldId: string
  providerFieldName?: string | null
}

export type KitProviderFieldIdentifierMap = Record<string, KitProviderFieldIdentifier>

export interface KitRecipientIdentityMergeFields {
  firstName: string | null
  lastName: string | null
}

export interface KitRecipientStableMergeMetadata {
  externalIdentityKey: string
  parentType: ParentType
  childClasses: string[]
  childNames: string[]
}

export interface KitClassArticleExcerpt {
  blockId: string
  title: string | null
  excerpt: string
  editorialOrder: number
  personalizationKey: string
  classId: string
}

export interface KitClassArticleExcerptSet {
  classId: string
  excerpts: KitClassArticleExcerpt[]
}

export interface KitNewsletterMergeFieldKeys {
  classArticleExcerpts: string
  classArticleCount: string
  payloadFingerprint: string
}

export interface KitNewsletterMergePropertyPayload {
  batchId: string
  newsletterId: string
  recipientId: string
  familyId: string | null
  guardianEmail: string
  identity: KitRecipientIdentityMergeFields
  stableMetadata: KitRecipientStableMergeMetadata
  classArticleExcerptSets: KitClassArticleExcerptSet[]
  fieldKeys: KitNewsletterMergeFieldKeys
  fields: Record<string, string>
  payloadFingerprint: string
}

export interface KitMergePropertySyncState {
  status: KitMergePropertySyncStatus
  payloadFingerprint: string | null
  lastSuccessfulPayloadFingerprint: string | null
  lastSuccessfulSyncedAt: string | null
  providerFieldIdentifiers: KitProviderFieldIdentifierMap
  providerError: string | null
  validationErrors: KitMergePropertyValidationError[]
  driftReason: string | null
  campaignReady: boolean
}

export interface KitPreparedRecipientMergeData {
  identity: KitRecipientIdentityMergeFields
  stableMetadata: Omit<KitRecipientStableMergeMetadata, 'externalIdentityKey'>
  classArticleExcerptSets: KitClassArticleExcerptSet[]
  sourceBlocks: PersonalizedEmailResolvedBlock[]
}

export interface KitMergePropertyLimits {
  maxArticlesPerRecipient: number
  maxExcerptLength: number
  maxSerializedPayloadBytes: number
  requiredFieldKeys: Array<keyof KitNewsletterMergeFieldKeys>
}

