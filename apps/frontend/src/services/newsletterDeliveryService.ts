import { adminApi, adminRpc } from '@/services/backendApi'
import type {
  DeliveryAudienceRecipient,
  DeliveryAudienceSelection,
  DeliveryAudienceSummary,
  NewsletterDeliveryBatch,
  NewsletterDeliveryRecipient,
  PublishDeliveryRequest,
  ResendDeliveryRequest,
} from '@/types/emailDelivery'
import type { PersonalizationInputTemplate, PersonalizationWarning } from '@/types/personalization'

export interface RecipientEligibilityInput {
  is_active: boolean
  classIds: string[]
}

export interface AudienceCandidateShape {
  familyId: string
  classIds: string[]
}

export function defaultAudienceSelection(input?: DeliveryAudienceSelection): DeliveryAudienceSelection {
  if (!input) {
    return { mode: 'all' }
  }
  if (input.mode === 'classes') {
    return { mode: 'classes', classIds: [...(input.classIds ?? [])] }
  }
  if (input.mode === 'families') {
    return { mode: 'families', familyIds: [...(input.familyIds ?? [])] }
  }
  if (input.mode === 'family') {
    return { mode: 'family', familyId: input.familyId ?? '' }
  }
  return { mode: 'all' }
}

export function validateRecipientEligibility(family: RecipientEligibilityInput): { eligible: boolean; reason: string | null } {
  if (!family.is_active) {
    return { eligible: false, reason: 'family_inactive' }
  }
  if (family.classIds.length === 0) {
    return { eligible: false, reason: 'no_active_enrollment' }
  }
  return { eligible: true, reason: null }
}

export function filterAudienceCandidateFamilyIds(
  candidates: AudienceCandidateShape[],
  selectionInput?: DeliveryAudienceSelection,
): string[] {
  const selection = defaultAudienceSelection(selectionInput)
  if (selection.mode === 'classes') {
    const selectedClassIds = new Set(selection.classIds ?? [])
    return candidates
      .filter((candidate) => candidate.classIds.some((classId) => selectedClassIds.has(classId)))
      .map((candidate) => candidate.familyId)
  }
  if (selection.mode === 'families') {
    const selectedFamilyIds = new Set(selection.familyIds ?? [])
    return candidates
      .filter((candidate) => selectedFamilyIds.has(candidate.familyId))
      .map((candidate) => candidate.familyId)
  }
  if (selection.mode === 'family') {
    return selection.familyId ? [selection.familyId] : []
  }
  return candidates.map((candidate) => candidate.familyId)
}

export function selectCampaignReadyDeliveryRecipients(
  recipients: NewsletterDeliveryRecipient[],
): NewsletterDeliveryRecipient[] {
  return recipients.filter((recipient) =>
    recipient.preparationStatus === 'ready' &&
    recipient.kitMergeSyncStatus === 'synced' &&
    recipient.campaignReady,
  )
}

class NewsletterDeliveryService {
  previewAudience(selection?: DeliveryAudienceSelection): Promise<DeliveryAudienceSummary> {
    return adminRpc('newsletterDelivery', 'previewAudience', [selection])
  }

  resolveAudience(
    selection?: DeliveryAudienceSelection,
    options?: { constrainedFamilyIds?: string[] },
  ): Promise<DeliveryAudienceSummary & { recipients: DeliveryAudienceRecipient[] }> {
    return adminRpc('newsletterDelivery', 'resolveAudience', [selection, options])
  }

  resolveActiveTemplate(): Promise<PersonalizationInputTemplate | undefined> {
    return adminRpc('newsletterDelivery', 'resolveActiveTemplate')
  }

  resolveTemplateInputForPreview(templateId: string): Promise<PersonalizationInputTemplate | undefined> {
    return adminRpc('newsletterDelivery', 'resolveTemplateInputForPreview', [templateId])
  }

  async previewPersonalizationForFamily(args: {
    newsletterId: string
    familyId: string
    templateId?: string
  }): Promise<{
    renderedSubject: string
    renderedBody: string
    warnings: PersonalizationWarning[]
    template: PersonalizationInputTemplate | undefined
    guardianEmail: string | null
  }> {
    return adminApi.previewNewsletterEmail(args) as Promise<{
      renderedSubject: string
      renderedBody: string
      warnings: PersonalizationWarning[]
      template: PersonalizationInputTemplate | undefined
      guardianEmail: string | null
    }>
  }

  async createPublishBatch(request: PublishDeliveryRequest): Promise<NewsletterDeliveryBatch> {
    const result = await adminApi.publishAndDeliver(request)
    return result.batch
  }

  createResendBatch(request: ResendDeliveryRequest): Promise<NewsletterDeliveryBatch> {
    return adminApi.createResendBatch(request)
  }

  listBatchesForNewsletter(newsletterId: string): Promise<NewsletterDeliveryBatch[]> {
    return adminRpc('newsletterDelivery', 'listBatchesForNewsletter', [newsletterId])
  }

  listBatchRecipients(batchId: string): Promise<NewsletterDeliveryRecipient[]> {
    return adminApi.listDeliveryRecipients(batchId)
  }

  fetchBatch(batchId: string): Promise<NewsletterDeliveryBatch> {
    return adminRpc('newsletterDelivery', 'fetchBatch', [batchId])
  }
}

export const newsletterDeliveryService = new NewsletterDeliveryService()
