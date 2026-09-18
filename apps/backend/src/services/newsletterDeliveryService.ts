import { currentDirectory, currentDeliveryContacts, classAliases, projectFamilyChildren, identityContext, withIdentityDirectory } from '#/services/identityDirectory'
import { deliveryIdentityForSessionHash } from '#/session/http'
import { runtimeEnvironment } from '#/runtime/environment'
import type { SmzDirectoryGraph } from '#/auth'
import { composeTrackedEmail } from '#/services/emailTrackingComposer'
import { DeliveryPolicyError } from '#/services/emailDeliveryPolicy'
import { getSupabaseClient } from '#/lib/supabase'
import { query } from '#/lib/db'
import {
  buildFallbackArticleImageUrl,
  extractFirstArticleImageUrl,
  formatArticleDisplayDate,
} from '#/services/articleEmailPresentation'
import { emailContentPreparationService } from '#/services/emailContentPreparationService'
import { backendEmailPlatformService } from '#/services/emailPlatform/backendEmailPlatformService'
import { coerceEmailTemplateBlocks } from '#/services/emailTemplateBlocks'
import { resolveAuthPreviewFamily } from '#/services/authDirectoryPreview'
import { composePersonalizedEmails } from '#/services/personalizedEmailComposer'
import { EMAIL_HTML_STORAGE_SIGN_TTL_SECONDS, replaceStorageTokens } from '#/utils/contentParser'
import type {
  DeliveryAudienceRecipient,
  DeliveryAudienceSelection,
  DeliveryAudienceSummary,
  NewsletterDeliveryBatch,
  NewsletterDeliveryRecipient,
  PublishDeliveryRequest,
  ResendDeliveryRequest,
} from '#/types/emailDelivery'
import type {
  NewsletterDeliveryBatchRecipientRow,
  NewsletterDeliveryBatchRow,
  NewsletterRow,
} from '#/types/database'
import type { PreparationFinding } from '#/types/emailPreparation'
import type {
  KitMergePropertySyncState,
  KitMergePropertySyncStatus,
  KitNewsletterMergePropertyPayload,
  KitProviderFieldIdentifierMap,
} from '#/types/kitMergeProperties'
import type {
  PersonalizationInputClass,
  PersonalizationInputGuardian,
  PersonalizationInputNewsletter,
  PersonalizationInputTemplate,
  PersonalizationWarning,
} from '#/types/personalization'

interface FamilyWithEnrollments {
  id: string
  is_active: boolean
  newsletter_subscription_status?: string
  classIds: string[]
}

export interface RecipientEligibilityInput {
  is_active: boolean
  newsletter_subscription_status?: string
  classIds: string[]
}

interface NewsletterArticleJoinRow {
  article_order: number
  targeting_mode?: 'shared' | 'targeted' | null
  target_class_ids?: string[] | null
  articles?: {
    id: string
    short_id?: string | null
    title?: string | null
    content: string
  } | Array<{
    id: string
    short_id?: string | null
    title?: string | null
    content: string
  }> | null
}

const PREVIEW_GUARDIAN_EMAIL = 'preview@example.invalid'

function asArrayValue<T>(value: T | T[] | null | undefined): T[] {
  if (value == null) return []
  return Array.isArray(value) ? value : [value]
}

function generateJourneyCorrelationId(): string {
  return `journey-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

// PostgreSQL returns timestamptz as Date, while persisted revision IDs are text.
function canonicalNewsletterRevision(value: string | Date): string {
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? String(value) : date.toISOString()
}

function getPublicAppBaseUrl(): string {
  return (runtimeEnvironment().APP_URL ?? runtimeEnvironment().VITE_APP_URL ?? 'http://localhost:5173').replace(/\/+$/, '')
}

function buildPublicArticleUrl(
  newsletter: NewsletterRow,
  article: { id: string; short_id?: string | null },
): string {
  const articleKey = article.short_id || article.id
  const newsletterPath = newsletter.week_number
    ? `/week/${encodeURIComponent(newsletter.week_number)}/${encodeURIComponent(articleKey)}`
    : `/newsletter/${encodeURIComponent(newsletter.id)}/${encodeURIComponent(articleKey)}`

  try {
    return new URL(newsletterPath, `${getPublicAppBaseUrl()}/`).toString()
  } catch {
    return newsletterPath
  }
}

function buildPublicNewsletterUrl(newsletter: NewsletterRow): string {
  const newsletterPath = newsletter.week_number
    ? `/week/${encodeURIComponent(newsletter.week_number)}`
    : `/newsletter/${encodeURIComponent(newsletter.id)}`

  try {
    return new URL(newsletterPath, `${getPublicAppBaseUrl()}/`).toString()
  } catch {
    return newsletterPath
  }
}

/**
 * Articles carrying this (case-insensitive) tag are routed to the
 * `weekly-summary-list` repeater instead of the featured article cards.
 * Admins assign it from the article taxonomy manager (`/admin/articles`).
 */
const WEEKLY_SUMMARY_SOURCE_TAG = 'weekly'

interface ArticleTagJoinRow {
  article_id: string
  article_tags?: { name?: string | null } | Array<{ name?: string | null }> | null
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
  if (family.newsletter_subscription_status !== 'subscribed') {
    return { eligible: false, reason: 'not_subscribed' }
  }
  return { eligible: true, reason: null }
}

/**
 * Family identity, membership, and delivery contacts are Auth-owned.
 * Preserve legacy eligibility when no CMS preference exists; explicit pending
 * or opt-out preferences must not count as consent to deliver.
 */
function effectiveSubscriptionStatus(status: string | null | undefined): 'subscribed' | 'unsubscribed' {
  // Families discovered from Auth predate CMS preferences and remain eligible
  // until CMS records an explicit non-subscribed state. Once a preference row
  // exists, pending/bounced/complained states must remain non-deliverable.
  return status == null || status === 'subscribed' ? 'subscribed' : 'unsubscribed'
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

/**
 * Targeted rows must name at least one class. Returning null means the row is
 * explicitly shared; malformed targeted rows fail closed instead of becoming
 * shared content for every family.
 */
export function resolveArticleTargetClassIds(input: {
  articleId: string
  targetingMode?: 'shared' | 'targeted' | null
  targetClassIds?: string[] | null
}): string[] | null {
  if (input.targetingMode !== 'targeted') return null
  const targetClassIds = input.targetClassIds?.filter((classId) => typeof classId === 'string' && classId.length > 0) ?? []
  if (targetClassIds.length === 0) {
    throw new Error(`Newsletter article ${input.articleId} is targeted but has no class targets`)
  }
  return targetClassIds
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

function mapBatchRow(row: NewsletterDeliveryBatchRow): NewsletterDeliveryBatch {
  return {
    id: row.id,
    newsletterId: row.newsletter_id,
    trigger: row.trigger,
    audienceMode: row.audience_mode,
    selectedClassIds: row.selected_class_ids ?? [],
    selectedFamilyIds: row.selected_family_ids ?? [],
    parentBatchId: row.parent_batch_id ?? null,
    state: row.state,
    pinnedNewsletterRevisionId: canonicalNewsletterRevision(row.pinned_newsletter_revision_id),
    pinnedTemplateId: row.pinned_template_id ?? null,
    pinnedTemplateRevisionId: row.pinned_template_revision_id ?? null,
    recipientSnapshotCapturedAt: row.recipient_snapshot_captured_at,
    rulesVersion: row.rules_version,
    preparationJobId: row.preparation_job_id ?? null,
    totalRecipients: row.total_recipients,
    eligibleRecipients: row.eligible_recipients,
    readyRecipients: row.ready_recipients,
    sentRecipients: row.sent_recipients,
    failedRecipients: row.failed_recipients,
    invalidRecipients: row.invalid_recipients,
    metadata: row.metadata ?? {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function mapRecipientRow(row: NewsletterDeliveryBatchRecipientRow): NewsletterDeliveryRecipient {
  const kitMergeSyncStatus: KitMergePropertySyncStatus = row.kit_merge_sync_status ?? 'pending'
  const kitMergeProviderFieldIds = (row.kit_merge_provider_field_ids ?? {}) as KitProviderFieldIdentifierMap
  const kitMergeSyncState: KitMergePropertySyncState = {
    status: kitMergeSyncStatus,
    payloadFingerprint: row.kit_merge_payload_fingerprint ?? null,
    lastSuccessfulPayloadFingerprint:
      kitMergeSyncStatus === 'synced' ? row.kit_merge_payload_fingerprint ?? null : null,
    lastSuccessfulSyncedAt: row.kit_merge_last_synced_at ?? null,
    providerFieldIdentifiers: kitMergeProviderFieldIds,
    providerError: row.kit_merge_provider_error ?? null,
    validationErrors: [],
    driftReason: kitMergeSyncStatus === 'drifted' ? 'payload_fingerprint_changed' : null,
    campaignReady: row.campaign_ready ?? false,
  }

  return {
    id: row.id,
    batchId: row.batch_id,
    familyId: row.family_id,
    parentId: row.parent_id ?? null,
    parentEmail: row.parent_email ?? row.guardian_email ?? null,
    eligibilityStatus: row.eligibility_status,
    preparationStatus: row.preparation_status,
    sendStatus: row.send_status,
    failureReason: row.failure_reason ?? null,
    preparedPayload: (row.prepared_payload ?? null) as NewsletterDeliveryRecipient['preparedPayload'],
    preparationFindings: (row.preparation_findings ?? []) as unknown as PreparationFinding[],
    journeyCorrelationId: row.journey_correlation_id,
    providerMessageId: row.provider_message_id ?? null,
    providerError: row.provider_error ?? null,
    kitMergeSyncStatus,
    kitMergePayload: (row.kit_merge_payload ?? null) as KitNewsletterMergePropertyPayload | null,
    kitMergePayloadFingerprint: row.kit_merge_payload_fingerprint ?? null,
    kitMergeProviderFieldIds,
    kitMergeLastSyncedAt: row.kit_merge_last_synced_at ?? null,
    kitMergeProviderError: row.kit_merge_provider_error ?? null,
    kitMergeSyncState,
    campaignReady: row.campaign_ready ?? false,
    lastAttemptedAt: row.last_attempted_at ?? null,
    sentAt: row.sent_at ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

class NewsletterDeliveryService {
  private async enqueueDeliveryJob(batchId: string, jobType: 'prepare_batch'): Promise<void> {
    const supabase = getSupabaseClient()
    const { error } = await supabase
      .from('newsletter_delivery_jobs')
      .insert({
        batch_id: batchId,
        job_type: jobType,
        status: 'queued',
        details: { source: 'newsletter_delivery_service' },
      })

    if (error) {
      throw new Error(`Failed to enqueue newsletter delivery job: ${error.message}`)
    }
  }

  private async sendPreparedBatchViaResend(input: {
    batchId: string
    newsletterId: string
    expectedDirectory: string
    recipients: Array<{
      recipientId: string
      familyId: string
      parentEmail: string | null
      journeyCorrelationId: string
      subject: string
      htmlContent: string
    }>
  }): Promise<{
    providerMessageId: string | null
    providerMessageIds: Record<string, string>
    sentRecipientIds: string[]
    failedRecipients: Array<{ recipientId: string; error: string }>
  }> {
    try {
      const contacts=await currentDeliveryContacts()
      if(JSON.stringify(await currentDirectory())!==input.expectedDirectory) throw new Error('Directory changed during preparation; review and prepare again')
      for(const recipient of input.recipients) if(!contacts.some(c=>c.email===recipient.parentEmail && c.families.some(f=>f.familyId===recipient.familyId))) throw new Error('Recipient access or address changed; review and prepare again')
      const families=await this.loadFamiliesWithEnrollments(input.recipients.map(r=>r.familyId))
      if(input.recipients.some(r=>!families.some(f=>f.id===r.familyId && validateRecipientEligibility(f).eligible))) throw new Error('Recipient consent or eligibility changed')
    } catch(error) { throw new DeliveryPolicyError(error instanceof Error ? error.message : String(error)) }
    const data = await backendEmailPlatformService.sendNewsletter({
      batchId: input.batchId,
      newsletterId: input.newsletterId,
      recipients: input.recipients,
    })

    return {
      providerMessageId: data.providerMessageId ?? null,
      providerMessageIds: data.providerMessageIds ?? {},
      sentRecipientIds: data.sentRecipientIds,
      failedRecipients: data.failedRecipients,
    }
  }

  private async loadFamiliesWithEnrollments(candidateFamilyIds?: string[]): Promise<FamilyWithEnrollments[]> {
    const directory=await currentDirectory()
    const aliases=await classAliases(directory)
    const {data:preferences,error}=await getSupabaseClient().from('newsletter_family_preferences').select('family_id,auth_family_id,newsletter_subscription_status')
    if(error) throw new Error(`Failed to load newsletter preferences: ${error.message}`)
    return directory.families.filter(f=>!candidateFamilyIds?.length || candidateFamilyIds.includes(f.id)).map(f=>({
      id:f.id,is_active:true,newsletter_subscription_status:effectiveSubscriptionStatus(((preferences??[]) as Array<{auth_family_id:string;newsletter_subscription_status:string}>).find(p=>p.auth_family_id===f.id)?.newsletter_subscription_status),
      classIds:[...new Set(projectFamilyChildren(directory,f.id,aliases).map(c=>c.classId))],
    }))
  }

  async resolveAudience(
    selectionInput?: DeliveryAudienceSelection,
    options?: { constrainedFamilyIds?: string[] },
  ): Promise<DeliveryAudienceSummary & { recipients: DeliveryAudienceRecipient[] }> {
    const selection = defaultAudienceSelection(selectionInput)
    const constrainedFamilyIds = options?.constrainedFamilyIds ?? []
    const families = await this.loadFamiliesWithEnrollments(
      constrainedFamilyIds.length > 0 ? constrainedFamilyIds : undefined,
    )

    const candidateFamilyIds = new Set(
      filterAudienceCandidateFamilyIds(
        families.map((family) => ({ familyId: family.id, classIds: family.classIds })),
        selection,
      ),
    )
    const candidates = families.filter((family) => candidateFamilyIds.has(family.id))

    const contacts=await currentDeliveryContacts()
    const parentEmailById=new Map(contacts.map(c=>[c.personId,c.email]))
    const parentIdsByFamily=new Map<string,string[]>()
    for(const contact of contacts) for(const family of contact.families) parentIdsByFamily.set(family.familyId,[...(parentIdsByFamily.get(family.familyId)??[]),contact.personId])

    const recipients = candidates.flatMap<DeliveryAudienceRecipient>((family) => {
      const eligibility = validateRecipientEligibility(family)
      const base = {
        familyId: family.id,
        classIds: family.classIds,
        isActive: family.is_active,
        subscriptionStatus: effectiveSubscriptionStatus(family.newsletter_subscription_status) as DeliveryAudienceRecipient['subscriptionStatus'],
        hasEnrollment: family.classIds.length > 0,
      }

      if (!eligibility.eligible) {
        return [{
          ...base,
          parentId: null,
          parentEmail: null,
          eligibilityStatus: 'ineligible',
          eligibilityReason: eligibility.reason,
        }]
      }

      const parentIdsForFamily = Array.from(new Set(parentIdsByFamily.get(family.id) ?? []))
      const parents = parentIdsForFamily
        .map((parentId) => ({ parentId, parentEmail: parentEmailById.get(parentId) ?? null }))
        .filter((parent) => !!parent.parentEmail)

      if (parents.length === 0) {
        return [{
          ...base,
          parentId: null,
          parentEmail: null,
          eligibilityStatus: 'ineligible',
          eligibilityReason: 'missing_parent_guardian_email',
        }]
      }

      return parents.map((parent) => ({
        ...base,
        parentId: parent.parentId,
        parentEmail: parent.parentEmail,
        eligibilityStatus: 'eligible' as const,
        eligibilityReason: null,
      }))
    })

    const eligibleFamilyIds = Array.from(new Set(recipients
      .filter((recipient) => recipient.eligibilityStatus === 'eligible')
      .map((recipient) => recipient.familyId)))
    const ineligibleFamilyIds = Array.from(new Set(recipients
      .filter((recipient) => recipient.eligibilityStatus === 'ineligible')
      .map((recipient) => recipient.familyId)))

    return {
      selection,
      recipients,
      totalCandidates: candidates.length,
      eligibleCount: eligibleFamilyIds.length,
      ineligibleCount: ineligibleFamilyIds.length,
      candidateFamilyIds: candidates.map((family) => family.id),
      eligibleFamilyIds,
      ineligibleFamilyIds,
    }
  }

  async resolveTemplateRevision(revisionId: string): Promise<PersonalizationInputTemplate> {
    const { data: revision, error } = await getSupabaseClient().from('email_template_revisions')
      .select('*').eq('id', revisionId).single()
    if (error || !revision) throw new Error('The previewed template revision is unavailable; preview again')
    return {
      templateId: revision.template_id, templateRevisionId: revision.id,
      subjectTemplate: revision.subject_template, bodyTemplate: revision.body_template,
      blocks: coerceEmailTemplateBlocks(revision.blocks),
    }
  }

  private async resolveActiveTemplate(): Promise<PersonalizationInputTemplate | undefined> {
    const supabase = getSupabaseClient()

    const { data: activeTemplate, error: activeTemplateError } = await supabase
      .from('email_templates')
      .select('id, current_revision_id')
      .eq('state', 'active')
      .not('current_revision_id', 'is', null)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (activeTemplateError) {
      throw new Error(`Failed to resolve active email template: ${activeTemplateError.message}`)
    }
    if (!activeTemplate || !activeTemplate.current_revision_id) {
      return undefined
    }

    const { data: revision, error: revisionError } = await supabase
      .from('email_template_revisions')
      .select('*')
      .eq('id', activeTemplate.current_revision_id)
      .single()
    if (revisionError) {
      throw new Error(`Failed to load active template revision: ${revisionError.message}`)
    }

    return {
      templateId: revision.template_id,
      templateRevisionId: revision.id,
      subjectTemplate: revision.subject_template,
      bodyTemplate: revision.body_template,
      blocks: coerceEmailTemplateBlocks((revision as { blocks?: unknown }).blocks),
    }
  }

  /**
   * Resolve a specific template revision (or the latest revision of a template)
   * for use by `previewPersonalizationForFamily`. Returns `undefined` when the
   * template has no revisions.
   */
  async resolveTemplateInputForPreview(templateId: string): Promise<PersonalizationInputTemplate | undefined> {
    const supabase = getSupabaseClient()
    const { data: template, error: templateError } = await supabase
      .from('email_templates')
      .select('id, current_revision_id')
      .eq('id', templateId)
      .maybeSingle()
    if (templateError) {
      throw new Error(`Failed to load template ${templateId}: ${templateError.message}`)
    }
    if (!template?.current_revision_id) {
      return undefined
    }
    const { data: revision, error: revisionError } = await supabase
      .from('email_template_revisions')
      .select('*')
      .eq('id', template.current_revision_id)
      .single()
    if (revisionError) {
      throw new Error(`Failed to load template revision: ${revisionError.message}`)
    }
    return {
      templateId: revision.template_id,
      templateRevisionId: revision.id,
      subjectTemplate: revision.subject_template,
      bodyTemplate: revision.body_template,
      blocks: coerceEmailTemplateBlocks((revision as { blocks?: unknown }).blocks),
    }
  }

  /**
   * Build a `PrepareEmailContentInput`-compatible composition for a single
   * (newsletter × family × template) tuple without touching delivery batches.
   * Used by the admin "Apply for merge" preview to render exactly what the
   * recipient would receive at send time. When an Auth directory is supplied,
   * its already-scoped family/child/class graph is the only source of preview
   * membership scope; local delivery rows are intentionally not consulted.
   */
  private async loadAuthDirectoryPreviewInputs(directory: SmzDirectoryGraph, familyId: string): Promise<{
    guardianId: string
    guardianEmail: string
    children: Array<{ studentId: string; studentName: string | null; classId: string }>
    classes: PersonalizationInputClass[]
    missingClassCodes: string[]
  }> {
    const scope = resolveAuthPreviewFamily(directory, familyId)
    if (!scope) {
      throw new Error(`SMZ family ${familyId} was not found in the current directory scope`)
    }

    const aliases=await classAliases(directory)
    return { guardianId:scope.guardianId,guardianEmail:PREVIEW_GUARDIAN_EMAIL,
      children:projectFamilyChildren(directory,familyId,aliases),
      classes:aliases.map(c=>({id:c.id,classCode:c.code,className:c.name,canonicalSortKey:c.code})),missingClassCodes:[] }
  }

  async previewPersonalizationForFamily(args: {
    newsletterId: string
    familyId: string
    templateId?: string
    directory?: SmzDirectoryGraph
  }): Promise<{
    renderedSubject: string
    renderedBody: string
    warnings: PersonalizationWarning[]
    template: PersonalizationInputTemplate | undefined
    guardianEmail: string | null
  }> {
    const supabase = getSupabaseClient()
    const { data: newsletter, error: newsletterError } = await supabase
      .from('newsletters')
      .select('*')
      .eq('id', args.newsletterId)
      .maybeSingle()
    if (newsletterError || !newsletter) {
      throw new Error(`Failed to load newsletter for preview: ${newsletterError?.message ?? 'not found'}`)
    }

    let guardianId = `preview:${args.familyId}`
    const parentEmail: string | null = null
    let guardians: PersonalizationInputGuardian[]
    let classes: PersonalizationInputClass[]
    let missingClassCodes: string[] = []
    if (args.directory) {
      const directoryInputs = await this.loadAuthDirectoryPreviewInputs(args.directory, args.familyId)
      guardianId = directoryInputs.guardianId
      guardians = [{
        guardianId,
        guardianEmail: directoryInputs.guardianEmail,
        familyId: args.familyId,
        children: directoryInputs.children,
      }]
      classes = directoryInputs.classes
      missingClassCodes = directoryInputs.missingClassCodes
    } else {
      throw new Error('A current Auth directory is required for preview')
    }

    const template = args.templateId
      ? await this.resolveTemplateInputForPreview(args.templateId)
      : await this.resolveActiveTemplate()
    const personalizationNewsletter = await this.buildNewsletterPersonalizationInput(newsletter as NewsletterRow)
    const composition = composePersonalizedEmails({
      rulesVersion: 'v1',
      newsletter: personalizationNewsletter,
      template,
      classes,
      guardians,
    })
    for (const classCode of missingClassCodes) {
      composition.warnings.push({
        code: 'missing_class_mapping',
        guardianId,
        message: `Class mapping is missing for class '${classCode}'.`,
        details: { classCode },
      })
    }
    const payload = composition.payloads[0]
    let renderedBody = payload?.renderedBody ?? ''
    if (renderedBody.includes('storage://')) {
      renderedBody = await replaceStorageTokens(renderedBody, EMAIL_HTML_STORAGE_SIGN_TTL_SECONDS)
    }
    return {
      renderedSubject: payload?.renderedSubject ?? '',
      renderedBody,
      warnings: composition.warnings,
      template,
      guardianEmail: parentEmail,
    }
  }

  private async buildNewsletterPersonalizationInput(
    newsletter: NewsletterRow,
  ): Promise<PersonalizationInputNewsletter> {
    const supabase = getSupabaseClient()
    const { data, error } = await supabase
      .from('newsletter_articles')
      .select('article_order, targeting_mode, target_class_ids, articles!inner(id, short_id, title, content)')
      .eq('newsletter_id', newsletter.id)
      .order('article_order', { ascending: true })

    if (error) {
      throw new Error(`Failed to load newsletter composition for delivery: ${error.message}`)
    }

    const rows = (data ?? []) as unknown as NewsletterArticleJoinRow[]
    const articleIds = rows
      .map((row) => asArrayValue(row.articles)[0]?.id)
      .filter((id): id is string => typeof id === 'string' && id.length > 0)
    const weeklyTaggedArticleIds = await this.loadWeeklyTaggedArticleIds(articleIds)

    const fallbackImageUrl = buildFallbackArticleImageUrl(getPublicAppBaseUrl())
    const displayDate = formatArticleDisplayDate({
      weekNumber: newsletter.week_number ?? null,
      articleTimestamp: newsletter.release_date ?? newsletter.published_at ?? newsletter.updated_at,
    })

    const sharedBlocks: PersonalizationInputNewsletter['sharedBlocks'] = []
    const classBlocks: PersonalizationInputNewsletter['classBlocks'] = []
    for (const row of rows) {
      const article = asArrayValue(row.articles)[0]
      if (!article) continue
      const block = {
        blockId: article.id,
        title: article.title ?? null,
        content: article.content,
        url: buildPublicArticleUrl(newsletter, article),
        imageUrl: extractFirstArticleImageUrl(article.content) ?? fallbackImageUrl,
        date: displayDate,
        sourceTag: weeklyTaggedArticleIds.has(article.id) ? WEEKLY_SUMMARY_SOURCE_TAG : null,
        editorialOrder: row.article_order,
        personalizationKey: `article:${article.id}`,
      }
      const targetClassIds = resolveArticleTargetClassIds({
        articleId: article.id,
        targetingMode: row.targeting_mode,
        targetClassIds: row.target_class_ids,
      })
      if (targetClassIds === null) {
        sharedBlocks.push(block)
        continue
      }
      for (const classId of targetClassIds) {
        classBlocks.push({ ...block, classId })
      }
    }

    return {
      newsletterId: newsletter.id,
      newsletterRevisionId: canonicalNewsletterRevision(newsletter.updated_at),
      title: newsletter.title ?? null,
      url: buildPublicNewsletterUrl(newsletter),
      sharedBlocks,
      classBlocks,
    }
  }

  /** IDs of articles carrying the (case-insensitive) `weekly` taxonomy tag. */
  private async loadWeeklyTaggedArticleIds(articleIds: string[]): Promise<Set<string>> {
    if (articleIds.length === 0) {
      return new Set()
    }
    const supabase = getSupabaseClient()
    const { data, error } = await supabase
      .from('article_tag_assignments')
      .select('article_id, article_tags!inner(name)')
      .in('article_id', articleIds)

    if (error) {
      throw new Error(`Failed to load article tags for delivery: ${error.message}`)
    }

    const weekly = new Set<string>()
    for (const row of (data ?? []) as unknown as ArticleTagJoinRow[]) {
      const tagName = asArrayValue(row.article_tags)[0]?.name ?? ''
      if (tagName.trim().toLowerCase() === WEEKLY_SUMMARY_SOURCE_TAG) {
        weekly.add(row.article_id)
      }
    }
    return weekly
  }

  private async loadGuardianInputs(recipientRows: NewsletterDeliveryBatchRecipientRow[]): Promise<{
    guardians: PersonalizationInputGuardian[]
    classes: PersonalizationInputClass[]
  }> {
    const directory=await currentDirectory()
    const aliases=await classAliases(directory)
    const contacts=await currentDeliveryContacts()
    const authorizedRows=recipientRows.filter(row=>contacts.some(c=>c.personId===row.parent_id && c.email===row.parent_email && c.families.some(f=>f.familyId===row.family_id)))
    for(const row of recipientRows.filter(r=>!authorizedRows.includes(r) && r.send_status!=='sent')) {
      const {error}=await getSupabaseClient().from('newsletter_delivery_batch_recipients').update({preparation_status:'failed',send_status:'skipped',failure_reason:'recipient_access_or_address_changed'}).eq('id',row.id)
      if(error) throw new Error('Could not record revoked recipient: '+error.message)
    }
    return { guardians:authorizedRows.map(row=>({guardianId:row.id,guardianEmail:row.parent_email!,familyId:row.family_id,children:projectFamilyChildren(directory,row.family_id,aliases)})),
      classes:aliases.map(c=>({id:c.id,classCode:c.code,className:c.name,canonicalSortKey:c.code})) }
  }

  private async updateBatchAggregateState(batchId: string): Promise<void> {
    const supabase = getSupabaseClient()
    const { data: recipients, error: recipientError } = await supabase
      .from('newsletter_delivery_batch_recipients')
      .select('eligibility_status, preparation_status, send_status')
      .eq('batch_id', batchId)
    if (recipientError) {
      throw new Error(`Failed to summarize delivery recipient state: ${recipientError.message}`)
    }

    const totalRecipients = recipients?.length ?? 0
    const eligibleRecipients = (recipients ?? []).filter((recipient) => recipient.eligibility_status === 'eligible').length
    const invalidRecipients = (recipients ?? []).filter((recipient) => recipient.eligibility_status === 'ineligible').length
    const readyRecipients = (recipients ?? []).filter((recipient) => recipient.preparation_status === 'ready').length
    const sentRecipients = (recipients ?? []).filter((recipient) => recipient.send_status === 'sent').length
    const failedRecipients = (recipients ?? []).filter((recipient) =>
      recipient.preparation_status === 'warning' ||
      recipient.preparation_status === 'failed' ||
      recipient.send_status === 'failed',
    ).length

    const state = failedRecipients > 0
      ? (sentRecipients > 0 ? 'completed_with_failures' : 'failed')
      : 'completed'

    const { error: updateError } = await supabase
      .from('newsletter_delivery_batches')
      .update({
        state,
        total_recipients: totalRecipients,
        eligible_recipients: eligibleRecipients,
        ready_recipients: readyRecipients,
        sent_recipients: sentRecipients,
        failed_recipients: failedRecipients,
        invalid_recipients: invalidRecipients,
      })
      .eq('id', batchId)
    if (updateError) {
      throw new Error(`Failed to persist delivery batch aggregates: ${updateError.message}`)
    }
  }

  private async processBatch(batch: NewsletterDeliveryBatch, newsletter: NewsletterRow): Promise<void> {
    const supabase = getSupabaseClient()
    await supabase
      .from('newsletter_delivery_batches')
      .update({ state: 'preparing' })
      .eq('id', batch.id)

    try {
      const { data: recipients, error: recipientError } = await supabase
        .from('newsletter_delivery_batch_recipients')
        .select('*')
        .eq('batch_id', batch.id)
        .eq('eligibility_status', 'eligible')
      if (recipientError) {
        throw new Error(`Failed to load eligible recipients for batch: ${recipientError.message}`)
      }

      const eligibleRecipientRows = (recipients ?? []) as NewsletterDeliveryBatchRecipientRow[]
      if (eligibleRecipientRows.some(recipient => recipient.send_status === 'handoff_pending')) {
        throw new Error('Provider outcome is uncertain; reconcile the prior handoff before retrying')
      }
      const expectedDirectory=JSON.stringify(await currentDirectory())
      const { guardians, classes } = await this.loadGuardianInputs(eligibleRecipientRows)
      const template = batch.pinnedTemplateRevisionId
        ? await this.resolveTemplateRevision(batch.pinnedTemplateRevisionId)
        : undefined
      const personalizationNewsletter = await this.buildNewsletterPersonalizationInput(newsletter)

      const preparationJob = await emailContentPreparationService.prepare({
        rulesVersion: batch.rulesVersion,
        newsletter: personalizationNewsletter,
        template,
        classes,
        guardians,
        startedAt: new Date().toISOString(),
        preparationJobId: batch.preparationJobId ?? `delivery-${batch.id}`,
      })

      if (
        preparationJob.pinnedInputs.newsletterRevisionId !== batch.pinnedNewsletterRevisionId ||
        preparationJob.pinnedInputs.templateId !== batch.pinnedTemplateId ||
        preparationJob.pinnedInputs.templateRevisionId !== batch.pinnedTemplateRevisionId ||
        preparationJob.pinnedInputs.rulesVersion !== batch.rulesVersion
      ) {
        throw new Error('Preparation pinned inputs mismatch with delivery batch contract')
      }

      await supabase
        .from('newsletter_delivery_batches')
        .update({
          state: 'sending',
          preparation_job_id: preparationJob.jobId,
        })
        .eq('id', batch.id)

      const recipientsByGuardian = new Map(eligibleRecipientRows.map((recipient) => [recipient.id, recipient]))
      const readyRecipientsToSend: Array<{
        rowId: string
        familyId: string
        parentEmail: string | null
        journeyCorrelationId: string
        subject: string
        htmlContent: string
      }> = []

      for (const prepared of preparationJob.recipients) {
        const row = recipientsByGuardian.get(prepared.guardianId)
        if (!row || row.send_status === 'sent') {
          continue
        }
        const isDeliverable = prepared.status === 'ready'
        const baseUpdates: Partial<NewsletterDeliveryBatchRecipientRow> = {
          preparation_status: prepared.status,
          prepared_payload: prepared.payload as unknown as Record<string, unknown>,
          preparation_findings: prepared.findings as unknown as Record<string, unknown>[],
          last_attempted_at: new Date().toISOString(),
        }
        let updates: Partial<NewsletterDeliveryBatchRecipientRow>
        if (!isDeliverable) {
          updates = {
            ...baseUpdates,
            send_status: 'failed',
            failure_reason: prepared.findings.find((finding) => finding.severity === 'error')?.message
              ?? (prepared.status === 'warning' ? 'recipient_not_ready' : 'preparation_failed'),
            provider_message_id: null,
            provider_error: prepared.status === 'warning' ? 'recipient_not_ready' : 'preparation_failed',
            kit_merge_sync_status: 'skipped',
            kit_merge_payload: null,
            kit_merge_payload_fingerprint: null,
            kit_merge_provider_error: prepared.status === 'warning' ? 'recipient_not_ready' : 'preparation_failed',
            campaign_ready: false,
            sent_at: null,
          }
        } else {
          readyRecipientsToSend.push({
            rowId: row.id,
            familyId: row.family_id,
            parentEmail: row.parent_email ?? null,
            journeyCorrelationId: row.journey_correlation_id,
            subject: prepared.payload.renderedSubject ?? '',
            htmlContent: composeTrackedEmail({
              html: prepared.payload.renderedBody ?? '', parentId: row.parent_id!,
              newsletterId: newsletter.id, batchId: batch.id, recipientId: row.id,
              journeyId: row.journey_correlation_id, appUrl: getPublicAppBaseUrl(),
              blocks: [...prepared.payload.sharedBlocks, ...prepared.payload.classBlocks],
            }),
          })
          updates = {
            ...baseUpdates,
            send_status: 'handoff_pending',
            failure_reason: null,
            provider_message_id: null,
            provider_error: null,
            kit_merge_sync_status: 'syncing',
            kit_merge_payload: prepared.kitMergeData as unknown as Record<string, unknown>,
            kit_merge_payload_fingerprint: prepared.payload.input_fingerprint,
            kit_merge_provider_error: null,
            campaign_ready: false,
            sent_at: null,
          }
        }
        await supabase
          .from('newsletter_delivery_batch_recipients')
          .update(updates)
          .eq('id', row.id)
      }

      if (readyRecipientsToSend.length > 0) {
        try {
          const sendResult = await this.sendPreparedBatchViaResend({
            batchId: batch.id,
            newsletterId: newsletter.id,
            expectedDirectory,
            recipients: readyRecipientsToSend.map((recipient) => ({
              recipientId: recipient.rowId,
              familyId: recipient.familyId,
              parentEmail: recipient.parentEmail,
              journeyCorrelationId: recipient.journeyCorrelationId,
              subject: recipient.subject,
              htmlContent: recipient.htmlContent,
            })),
          })

          const failedByRecipientId = new Map(
            sendResult.failedRecipients.map((entry) => [entry.recipientId, entry.error]),
          )
          const sentRecipientIds = new Set(sendResult.sentRecipientIds)
          const sentAt = new Date().toISOString()

          for (const recipient of readyRecipientsToSend) {
            const recipientFailure = failedByRecipientId.get(recipient.rowId)
              ?? (!sentRecipientIds.has(recipient.rowId) ? 'recipient_not_sent' : null)
            const isSent = !recipientFailure
            await supabase
              .from('newsletter_delivery_batch_recipients')
              .update({
                send_status: isSent ? 'sent' : 'failed',
                failure_reason: isSent ? null : recipientFailure,
                provider_message_id: isSent ? (sendResult.providerMessageIds[recipient.rowId] ?? sendResult.providerMessageId) : null,
                provider_error: isSent ? null : recipientFailure,
                kit_merge_sync_status: isSent ? 'synced' : 'failed',
                kit_merge_last_synced_at: isSent ? sentAt : null,
                kit_merge_provider_error: isSent ? null : recipientFailure,
                campaign_ready: isSent,
                sent_at: isSent ? sentAt : null,
                last_attempted_at: sentAt,
              })
              .eq('id', recipient.rowId)
          }
        } catch (sendError) {
          const errorMessage = sendError instanceof Error ? sendError.message : String(sendError)
          const attemptedAt = new Date().toISOString()
          for (const recipient of readyRecipientsToSend) {
            await supabase
              .from('newsletter_delivery_batch_recipients')
              .update({
                send_status: sendError instanceof DeliveryPolicyError ? 'failed' : 'handoff_pending',
                failure_reason: errorMessage,
                provider_message_id: null,
                provider_error: errorMessage,
                kit_merge_sync_status: 'failed',
                kit_merge_provider_error: errorMessage,
                campaign_ready: false,
                sent_at: null,
                last_attempted_at: attemptedAt,
              })
              .eq('id', recipient.rowId)
              .eq('send_status', 'handoff_pending')
          }
          throw sendError
        }
      }

      await this.updateBatchAggregateState(batch.id)
    } catch (error) {
      await supabase
        .from('newsletter_delivery_batches')
        .update({
          state: 'failed',
          metadata: {
            ...batch.metadata,
            last_error: error instanceof Error ? error.message : String(error),
          },
        })
        .eq('id', batch.id)
      throw error
    }
  }

  private async createBatch(
    newsletter: NewsletterRow,
    trigger: 'publish' | 'resend',
    audience: DeliveryAudienceSelection,
    audienceSummary: DeliveryAudienceSummary & { recipients: DeliveryAudienceRecipient[] },
    parentBatchId: string | null,
    templateRevisionId?: string | null,
  ): Promise<NewsletterDeliveryBatch> {
    const supabase = getSupabaseClient()
    const template = templateRevisionId === undefined ? await this.resolveActiveTemplate()
      : templateRevisionId === null ? undefined : await this.resolveTemplateRevision(templateRevisionId)

    const { data: batchRow, error: batchError } = await supabase
      .from('newsletter_delivery_batches')
      .insert({
        newsletter_id: newsletter.id,
        trigger,
        audience_mode: audience.mode,
        selected_class_ids: audience.classIds ?? [],
        selected_family_ids: audience.mode === 'family'
          ? (audience.familyId ? [audience.familyId] : [])
          : (audience.familyIds ?? []),
        parent_batch_id: parentBatchId,
        state: 'queued',
        metadata: { identity_session_hash: identityContext().sessionId },
        pinned_newsletter_revision_id: canonicalNewsletterRevision(newsletter.updated_at),
        pinned_template_id: template?.templateId ?? null,
        pinned_template_revision_id: template?.templateRevisionId ?? null,
        recipient_snapshot_captured_at: new Date().toISOString(),
        rules_version: 'v1',
        total_recipients: audienceSummary.recipients.length,
        eligible_recipients: audienceSummary.recipients.filter((recipient) => recipient.eligibilityStatus === 'eligible').length,
        invalid_recipients: audienceSummary.recipients.filter((recipient) => recipient.eligibilityStatus === 'ineligible').length,
      })
      .select('*')
      .single()
    if (batchError || !batchRow) {
      throw new Error(`Failed to create delivery batch: ${batchError?.message ?? 'unknown error'}`)
    }

    const recipientRows = audienceSummary.recipients.map((recipient) => ({
      batch_id: batchRow.id,
      family_id: recipient.familyId,
      parent_id: recipient.parentId,
      parent_email: recipient.parentEmail,
      guardian_email: null,
      journey_correlation_id: generateJourneyCorrelationId(),
      eligibility_status: recipient.eligibilityStatus,
      preparation_status: recipient.eligibilityStatus === 'eligible' ? 'pending' : 'skipped',
      send_status: recipient.eligibilityStatus === 'eligible' ? 'pending' : 'skipped',
      failure_reason: recipient.eligibilityStatus === 'eligible' ? null : recipient.eligibilityReason,
    }))

    if (recipientRows.length > 0) {
      const { error: recipientInsertError } = await supabase
        .from('newsletter_delivery_batch_recipients')
        .insert(recipientRows)
      if (recipientInsertError) {
        throw new Error(`Failed to create batch recipients: ${recipientInsertError.message}`)
      }
    }

    return mapBatchRow(batchRow)
  }

  async previewAudience(selection?: DeliveryAudienceSelection): Promise<DeliveryAudienceSummary> {
    const resolved = await this.resolveAudience(selection)
    return {
      selection: resolved.selection,
      eligibleRecipientCount: resolved.recipients.filter((recipient) => recipient.eligibilityStatus === 'eligible').length,
      exclusionReasons: resolved.recipients.reduce<Record<string, number>>((counts, recipient) => {
        if (recipient.eligibilityStatus === 'ineligible') {
          const reason = recipient.eligibilityReason ?? 'unknown'
          counts[reason] = (counts[reason] ?? 0) + 1
        }
        return counts
      }, {}),
      totalCandidates: resolved.totalCandidates,
      eligibleCount: resolved.eligibleCount,
      ineligibleCount: resolved.ineligibleCount,
      candidateFamilyIds: resolved.candidateFamilyIds,
      eligibleFamilyIds: resolved.eligibleFamilyIds,
      ineligibleFamilyIds: resolved.ineligibleFamilyIds,
    }
  }

  async createPublishBatch(request: PublishDeliveryRequest): Promise<NewsletterDeliveryBatch> {
    const supabase = getSupabaseClient()
    const { data: newsletter, error: newsletterError } = await supabase
      .from('newsletters')
      .select('*')
      .eq('id', request.newsletterId)
      .single()
    if (newsletterError || !newsletter) {
      throw new Error(`Failed to resolve newsletter for delivery: ${newsletterError?.message ?? 'not found'}`)
    }

    const audience = defaultAudienceSelection(request.audience)
    const resolvedAudience = await this.resolveAudience(audience)
    if (resolvedAudience.eligibleCount === 0) {
      throw new Error('No eligible parents in the selected delivery audience')
    }
    const batch = await this.createBatch(newsletter, 'publish', audience, resolvedAudience, null, request.templateRevisionId)
    await this.enqueueDeliveryJob(batch.id, 'prepare_batch')
    return this.fetchBatch(batch.id)
  }

  /**
   * A resend may originate from a batch created before directory ownership
   * moved to SMZ Auth. Convert only stable historical identifiers here; the
   * family graph and delivery contacts remain Auth-provided in resolveAudience.
   */
  private async resolveAuthFamilyIds(familyIds: string[]): Promise<string[]> {
    if (familyIds.length === 0) return []
    const directory = await currentDirectory()
    const authFamilyIds = new Set(directory.families.map((family) => family.id))
    const unresolved = familyIds.filter((familyId) => !authFamilyIds.has(familyId))
    if (unresolved.length === 0) return Array.from(new Set(familyIds))

    const { rows } = await query<{ legacy_id: string; auth_id: string | null }>(
      `SELECT legacy_id, auth_id
       FROM identity_reference_mappings
       WHERE entity_type = $1
         AND legacy_id = ANY($2::text[])
         AND auth_id IS NOT NULL`,
      ['family', unresolved],
    )
    const mappedIdsByLegacyId = new Map<string, string[]>()
    for (const row of rows) {
      if (!row.auth_id || !authFamilyIds.has(row.auth_id)) continue
      const mapped = mappedIdsByLegacyId.get(row.legacy_id) ?? []
      mapped.push(row.auth_id)
      mappedIdsByLegacyId.set(row.legacy_id, mapped)
    }
    for (const legacyId of unresolved) {
      const mapped = Array.from(new Set(mappedIdsByLegacyId.get(legacyId) ?? []))
      if (mapped.length !== 1) {
        throw new Error(`Historical family ${legacyId} cannot be resolved unambiguously to SMZ Auth`)
      }
    }
    return Array.from(new Set([
      ...familyIds.filter((familyId) => authFamilyIds.has(familyId)),
      ...unresolved.flatMap((legacyId) => mappedIdsByLegacyId.get(legacyId) ?? []),
    ]))
  }

  async createResendBatch(request: ResendDeliveryRequest): Promise<NewsletterDeliveryBatch> {
    const supabase = getSupabaseClient()
    const { data: parentBatch, error: parentError } = await supabase
      .from('newsletter_delivery_batches')
      .select('*')
      .eq('id', request.parentBatchId)
      .single()
    if (parentError || !parentBatch) {
      throw new Error(`Failed to load parent delivery batch: ${parentError?.message ?? 'not found'}`)
    }

    const { data: priorRecipients, error: priorRecipientError } = await supabase
      .from('newsletter_delivery_batch_recipients')
      .select('family_id')
      .eq('batch_id', request.parentBatchId)
      .eq('eligibility_status', 'eligible')
    if (priorRecipientError) {
      throw new Error(`Failed to load resend candidate recipients: ${priorRecipientError.message}`)
    }
    const priorCandidateFamilyIds = await this.resolveAuthFamilyIds(
      Array.from(new Set((priorRecipients ?? []).map((recipient) => recipient.family_id))),
    )
    const resolvedAudience = await this.resolveAudience(request.audience, {
      constrainedFamilyIds: priorCandidateFamilyIds,
    })

    const { data: newsletter, error: newsletterError } = await supabase
      .from('newsletters')
      .select('*')
      .eq('id', parentBatch.newsletter_id)
      .single()
    if (newsletterError || !newsletter) {
      throw new Error(`Failed to load newsletter for resend batch: ${newsletterError?.message ?? 'not found'}`)
    }

    const batch = await this.createBatch(
      newsletter,
      'resend',
      resolvedAudience.selection,
      resolvedAudience,
      parentBatch.id,
    )
    await this.enqueueDeliveryJob(batch.id, 'prepare_batch')
    return this.fetchBatch(batch.id)
  }

  async processQueuedBatch(batchId: string): Promise<NewsletterDeliveryBatch> {
    const supabase = getSupabaseClient()
    const { data: batchRow, error: batchError } = await supabase
      .from('newsletter_delivery_batches')
      .select('*')
      .eq('id', batchId)
      .single()
    if (batchError || !batchRow) {
      throw new Error(`Failed to load queued delivery batch: ${batchError?.message ?? 'not found'}`)
    }

    const { data: newsletter, error: newsletterError } = await supabase
      .from('newsletters')
      .select('*')
      .eq('id', batchRow.newsletter_id)
      .single()
    if (newsletterError || !newsletter) {
      throw new Error(`Failed to load newsletter for queued delivery batch: ${newsletterError?.message ?? 'not found'}`)
    }

    const batch = mapBatchRow(batchRow as NewsletterDeliveryBatchRow)
    if (batch.state === 'completed' || batch.state === 'completed_with_failures') return batch
    const hash=batch.metadata.identity_session_hash
    if(typeof hash!=='string') throw new Error('Delivery requires renewed administrator authorization')
    const identity=await deliveryIdentityForSessionHash(hash)
    await identity.contacts()
    await withIdentityDirectory(identity,()=>this.processBatch(batch, newsletter as NewsletterRow))
    return this.fetchBatch(batch.id)
  }

  async listBatchesForNewsletter(newsletterId: string): Promise<NewsletterDeliveryBatch[]> {
    const supabase = getSupabaseClient()
    const { data, error } = await supabase
      .from('newsletter_delivery_batches')
      .select('*')
      .eq('newsletter_id', newsletterId)
      .order('created_at', { ascending: false })
    if (error) {
      throw new Error(`Failed to load delivery batches: ${error.message}`)
    }
    return (data ?? []).map((row) => mapBatchRow(row as NewsletterDeliveryBatchRow))
  }

  async listBatchRecipients(batchId: string): Promise<NewsletterDeliveryRecipient[]> {
    const supabase = getSupabaseClient()
    const { data, error } = await supabase
      .from('newsletter_delivery_batch_recipients')
      .select('*')
      .eq('batch_id', batchId)
      .order('created_at', { ascending: true })
    if (error) {
      throw new Error(`Failed to load delivery batch recipients: ${error.message}`)
    }
    return (data ?? []).map((row) => mapRecipientRow(row as NewsletterDeliveryBatchRecipientRow))
  }

  async fetchBatch(batchId: string): Promise<NewsletterDeliveryBatch> {
    const supabase = getSupabaseClient()
    const { data, error } = await supabase
      .from('newsletter_delivery_batches')
      .select('*')
      .eq('id', batchId)
      .single()
    if (error || !data) {
      throw new Error(`Failed to load delivery batch: ${error?.message ?? 'not found'}`)
    }
    return mapBatchRow(data)
  }
}

export const newsletterDeliveryService = new NewsletterDeliveryService()
