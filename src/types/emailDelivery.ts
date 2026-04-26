import type { PersonalizedEmailPayload } from '@/types/personalization'
import type { PreparationFinding } from '@/types/emailPreparation'
import type {
  KitMergePropertySyncState,
  KitMergePropertySyncStatus,
  KitNewsletterMergePropertyPayload,
  KitProviderFieldIdentifierMap,
} from '@/types/kitMergeProperties'

export type NewsletterDeliveryTrigger = 'publish' | 'resend'
export type NewsletterDeliveryAudienceMode = 'all' | 'classes' | 'families' | 'family'
export type NewsletterDeliveryBatchState =
  | 'queued'
  | 'preparing'
  | 'sending'
  | 'completed'
  | 'completed_with_failures'
  | 'failed'
export type NewsletterDeliveryEligibilityStatus = 'eligible' | 'ineligible'
export type NewsletterDeliveryPreparationStatus = 'pending' | 'ready' | 'warning' | 'failed' | 'skipped'
export type NewsletterDeliverySendStatus = 'pending' | 'handoff_pending' | 'sent' | 'failed' | 'skipped'

export interface DeliveryAudienceSelection {
  mode: NewsletterDeliveryAudienceMode
  classIds?: string[]
  familyIds?: string[]
  familyId?: string
}

export interface DeliveryAudienceRecipient {
  familyId: string
  parentId: string | null
  parentEmail: string | null
  classIds: string[]
  isActive: boolean
  subscriptionStatus: 'pending' | 'subscribed' | 'unsubscribed' | 'bounced' | 'complained'
  hasEnrollment: boolean
  eligibilityStatus: NewsletterDeliveryEligibilityStatus
  eligibilityReason: string | null
}

export interface DeliveryAudienceSummary {
  selection: DeliveryAudienceSelection
  totalCandidates: number
  eligibleCount: number
  ineligibleCount: number
  candidateFamilyIds: string[]
  eligibleFamilyIds: string[]
  ineligibleFamilyIds: string[]
}

export interface NewsletterDeliveryBatch {
  id: string
  newsletterId: string
  trigger: NewsletterDeliveryTrigger
  audienceMode: NewsletterDeliveryAudienceMode
  selectedClassIds: string[]
  selectedFamilyIds: string[]
  parentBatchId: string | null
  state: NewsletterDeliveryBatchState
  pinnedNewsletterRevisionId: string
  pinnedTemplateId: string | null
  pinnedTemplateRevisionId: string | null
  recipientSnapshotCapturedAt: string
  rulesVersion: string
  preparationJobId: string | null
  totalRecipients: number
  eligibleRecipients: number
  readyRecipients: number
  sentRecipients: number
  failedRecipients: number
  invalidRecipients: number
  metadata: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

export interface NewsletterDeliveryRecipient {
  id: string
  batchId: string
  familyId: string
  parentId: string | null
  parentEmail: string | null
  eligibilityStatus: NewsletterDeliveryEligibilityStatus
  preparationStatus: NewsletterDeliveryPreparationStatus
  sendStatus: NewsletterDeliverySendStatus
  failureReason: string | null
  preparedPayload: PersonalizedEmailPayload | null
  preparationFindings: PreparationFinding[]
  journeyCorrelationId: string
  providerMessageId: string | null
  providerError: string | null
  kitMergeSyncStatus: KitMergePropertySyncStatus
  kitMergePayload: KitNewsletterMergePropertyPayload | null
  kitMergePayloadFingerprint: string | null
  kitMergeProviderFieldIds: KitProviderFieldIdentifierMap
  kitMergeLastSyncedAt: string | null
  kitMergeProviderError: string | null
  kitMergeSyncState: KitMergePropertySyncState
  campaignReady: boolean
  lastAttemptedAt: string | null
  sentAt: string | null
  createdAt: string
  updatedAt: string
}

export interface PublishDeliveryRequest {
  newsletterId: string
  audience: DeliveryAudienceSelection
}

export interface ResendDeliveryRequest {
  parentBatchId: string
  audience?: DeliveryAudienceSelection
}
