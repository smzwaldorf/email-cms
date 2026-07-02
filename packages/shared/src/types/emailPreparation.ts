import type { ComposePersonalizedEmailInput, PersonalizedEmailPayload } from '@/types/personalization'
import type { KitPreparedRecipientMergeData } from '@/types/kitMergeProperties'

export type PreparationRecipientStatus = 'ready' | 'warning' | 'failed'

export type PreparationFindingCode =
  | 'unsupported_token'
  | 'malformed_token_syntax'
  | 'missing_required_section'
  | 'missing_required_value'
  | 'incompatible_template_html'
  | 'missing_class_mapping'
  | 'inconsistent_membership'
  | 'unknown_target_class'
  | 'composition_warning'

export type PreparationFindingSeverity = 'warning' | 'error'

export interface PreparationFinding {
  code: PreparationFindingCode
  severity: PreparationFindingSeverity
  guardianId: string
  message: string
  field?: 'subject' | 'body'
  details?: Record<string, unknown>
}

export interface PreparationPinnedInputReferences {
  newsletterId: string
  newsletterRevisionId: string
  templateId: string | null
  templateRevisionId: string | null
  recipientSnapshotCapturedAt: string
  rulesVersion: string
}

export interface PreparedRecipientRecord {
  guardianId: string
  guardianEmail: string
  status: PreparationRecipientStatus
  payload: PersonalizedEmailPayload
  kitMergeData: KitPreparedRecipientMergeData
  findings: PreparationFinding[]
}

export interface PreparationReviewSummary {
  totalRecipients: number
  readyRecipients: number
  warningRecipients: number
  failedRecipients: number
  actionableErrors: Array<{
    guardianId: string
    detailRef: string
    code: PreparationFindingCode
    message: string
    field?: 'subject' | 'body'
    details?: Record<string, unknown>
  }>
}

export interface EmailContentPreparationJob {
  jobId: string
  createdAt: string
  retryOfJobId: string | null
  pinnedInputs: PreparationPinnedInputReferences
  deterministicHash: string
  recipients: PreparedRecipientRecord[]
  summary: PreparationReviewSummary
}

export interface PrepareEmailContentInput extends ComposePersonalizedEmailInput {
  startedAt?: string
  preparationJobId?: string
  retryOfJobId?: string
}

export interface PreparedRecipientPreview {
  jobId: string
  guardianId: string
  subject: string
  body: string
  findings: PreparationFinding[]
  status: PreparationRecipientStatus
}

export interface DeliveryHandoffContract {
  jobId: string
  deliverablePayloads: PersonalizedEmailPayload[]
  readyPayloads: PersonalizedEmailPayload[]
  nonReadyRecipients: PreparedRecipientRecord[]
  failedRecipients: PreparedRecipientRecord[]
}
