import { getSupabaseClient } from '@/lib/supabase'
import { emailContentPreparationService } from '@/services/emailContentPreparationService'
import { enqueueSyncJob } from '@/services/emailPlatform/runtime'
import { coerceEmailTemplateBlocks } from '@/services/emailTemplateBlocks'
import { composePersonalizedEmails } from '@/services/personalizedEmailComposer'
import { EMAIL_HTML_STORAGE_SIGN_TTL_SECONDS, replaceStorageTokens } from '@/utils/contentParser'
import type {
  DeliveryAudienceRecipient,
  DeliveryAudienceSelection,
  DeliveryAudienceSummary,
  NewsletterDeliveryBatch,
  NewsletterDeliveryRecipient,
  PublishDeliveryRequest,
  ResendDeliveryRequest,
} from '@/types/emailDelivery'
import type {
  NewsletterDeliveryBatchRecipientRow,
  NewsletterDeliveryBatchRow,
  NewsletterRow,
} from '@/types/database'
import type { PreparationFinding } from '@/types/emailPreparation'
import type {
  PersonalizationInputClass,
  PersonalizationInputGuardian,
  PersonalizationInputNewsletter,
  PersonalizationInputTemplate,
  PersonalizationWarning,
} from '@/types/personalization'

interface FamilyWithEnrollments {
  id: string
  is_active: boolean
  classIds: string[]
}

export interface RecipientEligibilityInput {
  is_active: boolean
  classIds: string[]
}

interface NewsletterArticleJoinRow {
  article_order: number
  targeting_mode?: 'shared' | 'targeted' | null
  target_class_ids?: string[] | null
  articles?: {
    id: string
    title?: string | null
    content: string
  } | Array<{
    id: string
    title?: string | null
    content: string
  }> | null
}

interface FamilyEnrollmentJoinRow {
  family_id: string
  student_id: string
  class_id: string
  students?: { name?: string | null; is_active?: boolean } | Array<{ name?: string | null; is_active?: boolean }> | null
  classes?: { class_name?: string | null; class_code?: string | null; is_active?: boolean } | Array<{ class_name?: string | null; class_code?: string | null; is_active?: boolean }> | null
}

interface FamilyParentEnrollmentRow {
  family_id: string
  parent_id: string
}

interface ParentUserEmailRow {
  id: string
  email: string
}

function asArrayValue<T>(value: T | T[] | null | undefined): T[] {
  if (value == null) return []
  return Array.isArray(value) ? value : [value]
}

function generateJourneyCorrelationId(): string {
  return `journey-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
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
    pinnedNewsletterRevisionId: row.pinned_newsletter_revision_id,
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
    lastAttemptedAt: row.last_attempted_at ?? null,
    sentAt: row.sent_at ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

class NewsletterDeliveryService {
  private async sendPreparedBatchViaKit(input: {
    batchId: string
    newsletterId: string
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
    sentRecipientIds: string[]
    failedRecipients: Array<{ recipientId: string; error: string }>
  }> {
    const supabase = getSupabaseClient()
    const { data, error } = await supabase.functions.invoke('kit-send-newsletter', {
      body: {
        batchId: input.batchId,
        newsletterId: input.newsletterId,
        recipients: input.recipients,
      },
    })

    if (error) {
      throw new Error(`Kit send invoke failed: ${error.message}`)
    }

    return {
      providerMessageId: (data as { providerMessageId?: string | null } | null)?.providerMessageId ?? null,
      sentRecipientIds: (data as { sentRecipientIds?: string[] } | null)?.sentRecipientIds ?? [],
      failedRecipients: (data as { failedRecipients?: Array<{ recipientId: string; error: string }> } | null)?.failedRecipients ?? [],
    }
  }

  private async loadFamiliesWithEnrollments(candidateFamilyIds?: string[]): Promise<FamilyWithEnrollments[]> {
    const supabase = getSupabaseClient()

    let familyQuery = supabase
      .from('families')
      .select('id, is_active')
    if (candidateFamilyIds && candidateFamilyIds.length > 0) {
      familyQuery = familyQuery.in('id', candidateFamilyIds)
    }
    const { data: families, error: familyError } = await familyQuery
    if (familyError) {
      throw new Error(`Failed to load families for delivery: ${familyError.message}`)
    }

    const familyIds = (families ?? []).map((family) => family.id)
    if (familyIds.length === 0) {
      return []
    }

    const { data: enrollments, error: enrollmentError } = await supabase
      .from('student_class_enrollment')
      .select('family_id, class_id')
      .in('family_id', familyIds)
      .is('graduated_at', null)
    if (enrollmentError) {
      throw new Error(`Failed to load family enrollments for delivery: ${enrollmentError.message}`)
    }

    const classIdsByFamily = new Map<string, Set<string>>()
    for (const enrollment of enrollments ?? []) {
      const existing = classIdsByFamily.get(enrollment.family_id) ?? new Set<string>()
      existing.add(enrollment.class_id)
      classIdsByFamily.set(enrollment.family_id, existing)
    }

    return (families ?? []).map((family) => ({
      id: family.id,
      is_active: family.is_active ?? true,
      classIds: Array.from(classIdsByFamily.get(family.id) ?? []),
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

    const candidateFamilyIdList = candidates.map((family) => family.id)
    const { data: parentEnrollments, error: parentEnrollmentError } = candidateFamilyIdList.length > 0
      ? await getSupabaseClient()
        .from('family_enrollment')
        .select('family_id, parent_id')
        .in('family_id', candidateFamilyIdList)
        .not('parent_id', 'is', null)
      : { data: [], error: null }
    if (parentEnrollmentError) {
      throw new Error(`Failed to load parent enrollments for delivery: ${parentEnrollmentError.message}`)
    }

    const parentIds = Array.from(
      new Set((parentEnrollments ?? []).map((row) => (row as FamilyParentEnrollmentRow).parent_id)),
    )
    const { data: parentUsers, error: parentUserError } = parentIds.length > 0
      ? await getSupabaseClient()
        .from('user_roles')
        .select('id, email')
        .in('id', parentIds)
      : { data: [], error: null }
    if (parentUserError) {
      throw new Error(`Failed to load parent emails for delivery: ${parentUserError.message}`)
    }

    const parentEmailById = new Map(
      (parentUsers ?? []).map((row) => [(row as ParentUserEmailRow).id, (row as ParentUserEmailRow).email]),
    )
    const parentIdsByFamily = new Map<string, string[]>()
    for (const enrollment of (parentEnrollments ?? []) as FamilyParentEnrollmentRow[]) {
      const existing = parentIdsByFamily.get(enrollment.family_id) ?? []
      existing.push(enrollment.parent_id)
      parentIdsByFamily.set(enrollment.family_id, existing)
    }

    const recipients = candidates.flatMap<DeliveryAudienceRecipient>((family) => {
      const eligibility = validateRecipientEligibility(family)
      const base = {
        familyId: family.id,
        classIds: family.classIds,
        isActive: family.is_active,
        subscriptionStatus: 'subscribed' as const,
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
      totalCandidates: recipients.length,
      eligibleCount: eligibleFamilyIds.length,
      ineligibleCount: ineligibleFamilyIds.length,
      candidateFamilyIds: recipients.map((recipient) => recipient.familyId),
      eligibleFamilyIds,
      ineligibleFamilyIds,
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
   * recipient would receive at send time.
   */
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
    const supabase = getSupabaseClient()
    const [{ data: newsletter, error: newsletterError }, { data: parentEnrollments, error: parentsError }] = await Promise.all([
      supabase.from('newsletters').select('*').eq('id', args.newsletterId).maybeSingle(),
      supabase
        .from('family_enrollment')
        .select('parent_id, family_id')
        .eq('family_id', args.familyId)
        .not('parent_id', 'is', null)
        .limit(1),
    ])
    if (newsletterError || !newsletter) {
      throw new Error(`Failed to load newsletter for preview: ${newsletterError?.message ?? 'not found'}`)
    }
    if (parentsError) {
      throw new Error(`Failed to load family parents: ${parentsError.message}`)
    }
    const parentEnrollment = (parentEnrollments ?? [])[0] as { parent_id: string } | undefined
    let parentEmail: string | null = null
    if (parentEnrollment?.parent_id) {
      const { data: parentUser, error: parentUserError } = await supabase
        .from('user_roles')
        .select('email')
        .eq('id', parentEnrollment.parent_id)
        .maybeSingle()
      if (parentUserError) {
        throw new Error(`Failed to load parent email: ${parentUserError.message}`)
      }
      parentEmail = (parentUser as { email?: string | null } | null)?.email ?? null
    }

    const template = args.templateId
      ? await this.resolveTemplateInputForPreview(args.templateId)
      : await this.resolveActiveTemplate()
    const personalizationNewsletter = await this.buildNewsletterPersonalizationInput(newsletter as NewsletterRow)
    const recipientRow: NewsletterDeliveryBatchRecipientRow = {
      id: `preview-${args.familyId}`,
      family_id: args.familyId,
      parent_id: parentEnrollment?.parent_id ?? null,
      parent_email: parentEmail,
      guardian_email: null,
      journey_correlation_id: 'preview',
      eligibility_status: 'eligible',
      preparation_status: 'pending',
      send_status: 'pending',
      failure_reason: null,
      provider_message_id: null,
      provider_error: null,
      sent_at: null,
      last_attempted_at: null,
      batch_id: 'preview',
      eligibility_reason: null,
      prepared_payload: null,
      preparation_findings: null,
    } as unknown as NewsletterDeliveryBatchRecipientRow

    const { guardians, classes } = await this.loadGuardianInputs([recipientRow])
    const composition = composePersonalizedEmails({
      rulesVersion: 'v1',
      newsletter: personalizationNewsletter,
      template,
      classes,
      guardians,
    })
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
      .select('article_order, targeting_mode, target_class_ids, articles!inner(id, title, content)')
      .eq('newsletter_id', newsletter.id)
      .order('article_order', { ascending: true })

    if (error) {
      throw new Error(`Failed to load newsletter composition for delivery: ${error.message}`)
    }

    const sharedBlocks: PersonalizationInputNewsletter['sharedBlocks'] = []
    const classBlocks: PersonalizationInputNewsletter['classBlocks'] = []
    for (const row of (data ?? []) as unknown as NewsletterArticleJoinRow[]) {
      const article = asArrayValue(row.articles)[0]
      if (!article) continue
      const block = {
        blockId: article.id,
        title: article.title ?? null,
        content: article.content,
        editorialOrder: row.article_order,
        personalizationKey: `article:${article.id}`,
      }
      const targetClassIds = row.targeting_mode === 'targeted' ? row.target_class_ids ?? [] : []
      if (targetClassIds.length === 0) {
        sharedBlocks.push(block)
        continue
      }
      for (const classId of targetClassIds) {
        classBlocks.push({ ...block, classId })
      }
    }

    return {
      newsletterId: newsletter.id,
      newsletterRevisionId: newsletter.updated_at,
      title: newsletter.title ?? null,
      sharedBlocks,
      classBlocks,
    }
  }

  private async loadGuardianInputs(recipientRows: NewsletterDeliveryBatchRecipientRow[]): Promise<{
    guardians: PersonalizationInputGuardian[]
    classes: PersonalizationInputClass[]
  }> {
    const supabase = getSupabaseClient()
    if (recipientRows.length === 0) {
      return { guardians: [], classes: [] }
    }
    const familyIds = Array.from(new Set(recipientRows.map((row) => row.family_id)))

    const [{ data: enrollments, error: enrollmentError }, { data: classes, error: classesError }] = await Promise.all([
      supabase
        .from('student_class_enrollment')
        .select('family_id, student_id, class_id, students(name, is_active), classes(class_name, class_code, is_active)')
        .in('family_id', familyIds)
        .is('graduated_at', null),
      supabase
        .from('classes')
        .select('id, class_code, class_name')
        .eq('is_active', true),
    ])

    if (enrollmentError) {
      throw new Error(`Failed to load batch enrollments: ${enrollmentError.message}`)
    }
    if (classesError) {
      throw new Error(`Failed to load class catalog for batch: ${classesError.message}`)
    }

    const enrollmentByFamily = new Map<string, FamilyEnrollmentJoinRow[]>()
    for (const enrollment of (enrollments ?? []) as FamilyEnrollmentJoinRow[]) {
      const student = asArrayValue(enrollment.students)[0]
      const klass = asArrayValue(enrollment.classes)[0]
      if (student?.is_active === false || klass?.is_active === false) {
        continue
      }
      const existing = enrollmentByFamily.get(enrollment.family_id) ?? []
      existing.push(enrollment)
      enrollmentByFamily.set(enrollment.family_id, existing)
    }

    const guardians: PersonalizationInputGuardian[] = recipientRows
      .filter((row) => !!row.parent_email)
      .map((row) => {
        const familyEnrollments = enrollmentByFamily.get(row.family_id) ?? []
        return {
          guardianId: row.id,
          guardianEmail: row.parent_email as string,
          familyId: row.family_id,
          children: familyEnrollments.map((enrollment) => ({
            studentId: enrollment.student_id,
            studentName: asArrayValue(enrollment.students)[0]?.name ?? null,
            classId: enrollment.class_id,
          })),
        }
      })

    const inputClasses: PersonalizationInputClass[] = (classes ?? []).map((klass) => ({
      id: klass.id,
      classCode: klass.class_code,
      className: klass.class_name,
      canonicalSortKey: klass.class_code,
    }))

    return { guardians, classes: inputClasses }
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
      const familyIds = Array.from(new Set(eligibleRecipientRows.map((recipient) => recipient.family_id)))
      for (const familyId of familyIds) {
        await enqueueSyncJob(supabase, {
          familyId,
          mappingId: null,
          jobType: 'upsert_subscriber',
          enqueueReason: 'newsletter_delivery_batch',
          payload: {
            source: 'newsletter_delivery_batch',
            batch_id: batch.id,
            family_id: familyId,
          },
        })
      }

      const { guardians, classes } = await this.loadGuardianInputs(eligibleRecipientRows)
      const template = await this.resolveActiveTemplate()
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
        if (!row) {
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
            sent_at: null,
          }
        } else {
          readyRecipientsToSend.push({
            rowId: row.id,
            familyId: row.family_id,
            parentEmail: row.parent_email ?? null,
            journeyCorrelationId: row.journey_correlation_id,
            subject: prepared.payload.renderedSubject ?? '',
            htmlContent: prepared.payload.renderedBody ?? '',
          })
          updates = {
            ...baseUpdates,
            send_status: 'pending',
            failure_reason: null,
            provider_message_id: null,
            provider_error: null,
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
          const sendResult = await this.sendPreparedBatchViaKit({
            batchId: batch.id,
            newsletterId: newsletter.id,
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
                provider_message_id: isSent ? sendResult.providerMessageId : null,
                provider_error: isSent ? null : recipientFailure,
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
                send_status: 'failed',
                failure_reason: errorMessage,
                provider_message_id: null,
                provider_error: errorMessage,
                sent_at: null,
                last_attempted_at: attemptedAt,
              })
              .eq('id', recipient.rowId)
          }
        }
      }

      await this.updateBatchAggregateState(batch.id)
    } catch (error) {
      await supabase
        .from('newsletter_delivery_batches')
        .update({
          state: 'failed',
          metadata: {
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
  ): Promise<NewsletterDeliveryBatch> {
    const supabase = getSupabaseClient()
    const template = await this.resolveActiveTemplate()

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
        pinned_newsletter_revision_id: newsletter.updated_at,
        pinned_template_id: template?.templateId ?? null,
        pinned_template_revision_id: template?.templateRevisionId ?? null,
        recipient_snapshot_captured_at: new Date().toISOString(),
        rules_version: 'v1',
        total_recipients: audienceSummary.totalCandidates,
        eligible_recipients: audienceSummary.eligibleCount,
        invalid_recipients: audienceSummary.ineligibleCount,
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
    const batch = await this.createBatch(newsletter, 'publish', audience, resolvedAudience, null)
    await this.processBatch(batch, newsletter)
    return this.fetchBatch(batch.id)
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
    const priorCandidateFamilyIds = Array.from(new Set((priorRecipients ?? []).map((recipient) => recipient.family_id)))
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
    await this.processBatch(batch, newsletter)
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
