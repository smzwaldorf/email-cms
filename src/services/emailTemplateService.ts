import { getSupabaseClient } from '@/lib/supabase'
import type {
  EmailTemplate,
  EmailTemplateBlock,
  EmailTemplatePreviewResult,
  EmailTemplateRevision,
  EmailTemplateValidationResult,
} from '@/types/emailTemplate'
import type { EmailTemplateRevisionRow, EmailTemplateRow } from '@/types/database'
import { normalizeCanvaEmailHtml } from '@/services/canvaEmailImport'
import {
  coerceEmailTemplateBlocks,
  createDefaultBlock,
} from '@/services/emailTemplateBlocks'
import {
  renderEmailTemplatePreview,
  validateEmailTemplate,
  type EmailTemplateRenderContext,
} from '@/services/emailTemplateTokens'
import {
  renderTemplateForRecipient,
  type RecipientArticle,
  type RecipientClass,
  type RecipientRenderContext,
} from '@/services/emailTemplateRenderer'

export class EmailTemplateServiceError extends Error {
  constructor(
    message: string,
    public code: string = 'EMAIL_TEMPLATE_ERROR',
    public originalError?: unknown,
  ) {
    super(message)
    this.name = 'EmailTemplateServiceError'
  }
}

/** Sample articles / classes / weekly items so block-walker previews show repeater output. */
export const DEFAULT_EMAIL_TEMPLATE_PREVIEW_SAMPLES: {
  sharedArticles: RecipientArticle[]
  classes: RecipientClass[]
  weeklyItems: RecipientArticle[]
} = {
  sharedArticles: [
    {
      id: 'preview-sa-1',
      title: 'Demo shared article',
      excerpt: 'Sample excerpt for preview.',
      url: 'https://example.com/a1',
      imageUrl: null,
    },
  ],
  classes: [
    {
      id: 'preview-class-a',
      code: 'A1',
      name: 'Grade 1A',
      articles: [
        {
          id: 'preview-ca-1',
          title: 'Demo class article',
          excerpt: 'Class excerpt for preview.',
          url: 'https://example.com/c1',
          imageUrl: null,
        },
      ],
    },
  ],
  weeklyItems: [
    {
      id: 'preview-w-1',
      title: 'Weekly item',
      excerpt: 'Weekly excerpt.',
      url: 'https://example.com/w1',
      sourceTag: 'weekly',
    },
  ],
}

function mergePreviewSampleData(sampleData?: {
  sharedArticles?: RecipientArticle[]
  classes?: RecipientClass[]
  weeklyItems?: RecipientArticle[]
}): {
  sharedArticles: RecipientArticle[]
  classes: RecipientClass[]
  weeklyItems: RecipientArticle[]
} {
  return {
    sharedArticles: sampleData?.sharedArticles ?? DEFAULT_EMAIL_TEMPLATE_PREVIEW_SAMPLES.sharedArticles,
    classes: sampleData?.classes ?? DEFAULT_EMAIL_TEMPLATE_PREVIEW_SAMPLES.classes,
    weeklyItems: sampleData?.weeklyItems ?? DEFAULT_EMAIL_TEMPLATE_PREVIEW_SAMPLES.weeklyItems,
  }
}

function mapTemplateRow(row: EmailTemplateRow): EmailTemplate {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? null,
    state: row.state,
    currentRevisionId: row.current_revision_id ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deactivatedAt: row.deactivated_at ?? null,
  }
}

function mapTemplateRevisionRow(row: EmailTemplateRevisionRow): EmailTemplateRevision {
  const coercedBlocks = coerceEmailTemplateBlocks(row.blocks)
  // Legacy revisions saved before the block backfill ran (or test fixtures
  // that omit `blocks`) materialize as a single `custom-html` block whose
  // `bodyHtml` is the legacy body_template.
  const blocks: EmailTemplateBlock[] =
    coercedBlocks.length > 0
      ? coercedBlocks
      : [
          {
            ...createDefaultBlock('custom-html', 0),
            bodyHtml: row.body_template ?? '',
          },
        ]
  return {
    id: row.id,
    templateId: row.template_id,
    revisionNumber: row.revision_number,
    subjectTemplate: row.subject_template,
    bodyTemplate: row.body_template,
    blocks,
    createdAt: row.created_at,
    createdBy: row.created_by ?? null,
  }
}

function buildBlocksPayload(input: {
  blocks?: EmailTemplateBlock[]
  bodyTemplate: string
}): EmailTemplateBlock[] {
  if (Array.isArray(input.blocks) && input.blocks.length > 0) {
    return input.blocks.map((block, index) => ({
      type: block.type,
      order: typeof block.order === 'number' ? block.order : index,
      visible: block.visible !== false,
      bodyHtml: block.bodyHtml ?? '',
      config: block.config && typeof block.config === 'object' ? block.config : {},
    }))
  }
  return [
    {
      ...createDefaultBlock('custom-html', 0),
      bodyHtml: input.bodyTemplate,
    },
  ]
}

class EmailTemplateService {
  normalizeImportedBodyHtml(rawHtml: string) {
    return normalizeCanvaEmailHtml(rawHtml)
  }

  private resolveBodyTemplateInput(input: {
    bodyTemplate: string
    importedBodyHtml?: string | null
  }): string {
    if (!input.importedBodyHtml) {
      return input.bodyTemplate
    }

    const importResult = this.normalizeImportedBodyHtml(input.importedBodyHtml)
    if (importResult.hasBlockingIssues) {
      const detail = importResult.issues.map((issue) => issue.message).join(' ')
      throw new EmailTemplateServiceError(
        `Cannot save imported HTML template: ${detail}`,
        'EMAIL_TEMPLATE_IMPORT_VALIDATION_ERROR',
        importResult.issues,
      )
    }

    return importResult.normalizedHtml
  }

  private assertTemplateValidation(
    validation: EmailTemplateValidationResult,
    operation: 'create' | 'save',
  ): void {
    if (validation.valid) {
      return
    }

    const detail = validation.issues.map((issue) => issue.message).join(' ')
    throw new EmailTemplateServiceError(
      `Cannot ${operation} template: ${detail}`,
      'EMAIL_TEMPLATE_VALIDATION_ERROR',
      validation.issues,
    )
  }

  private async fetchMaxRevisionNumber(templateId: string): Promise<number> {
    const supabase = getSupabaseClient()
    const { data, error } = await supabase
      .from('email_template_revisions')
      .select('revision_number')
      .eq('template_id', templateId)
      .order('revision_number', { ascending: false })
      .limit(1)

    if (error) {
      throw new EmailTemplateServiceError(
        `Failed to read template revisions: ${error.message}`,
        'EMAIL_TEMPLATE_FETCH_REVISION_ERROR',
        error,
      )
    }

    const maxRevision = (data as Array<{ revision_number: number }> | null)?.[0]?.revision_number ?? 0
    return maxRevision
  }

  async listTemplates(): Promise<EmailTemplate[]> {
    const supabase = getSupabaseClient()
    const { data, error } = await supabase
      .from('email_templates')
      .select('*')
      .order('updated_at', { ascending: false })

    if (error) {
      throw new EmailTemplateServiceError(
        `Failed to list email templates: ${error.message}`,
        'EMAIL_TEMPLATE_LIST_ERROR',
        error,
      )
    }

    return ((data ?? []) as EmailTemplateRow[]).map(mapTemplateRow)
  }

  async createTemplate(input: {
    name: string
    description?: string | null
    subjectTemplate: string
    bodyTemplate: string
    blocks?: EmailTemplateBlock[]
    importedBodyHtml?: string | null
  }): Promise<{ template: EmailTemplate; revision: EmailTemplateRevision; validation: EmailTemplateValidationResult }> {
    const resolvedBodyTemplate = this.resolveBodyTemplateInput(input)
    const blocksPayload = buildBlocksPayload({ blocks: input.blocks, bodyTemplate: resolvedBodyTemplate })
    const validation = validateEmailTemplate(input.subjectTemplate, resolvedBodyTemplate, blocksPayload)
    this.assertTemplateValidation(validation, 'create')
    const supabase = getSupabaseClient()

    const { data: templateRow, error: templateError } = await supabase
      .from('email_templates')
      .insert({
        name: input.name.trim(),
        description: input.description?.trim() || null,
        // state defaults to 'draft' at the DB level. Admins promote a template
        // explicitly via setActiveTemplate; we no longer auto-activate on
        // create/save so the user's "in use" choice is preserved.
      })
      .select('*')
      .single()

    if (templateError || !templateRow) {
      throw new EmailTemplateServiceError(
        `Failed to create template: ${templateError?.message ?? 'unknown error'}`,
        'EMAIL_TEMPLATE_CREATE_ERROR',
        templateError,
      )
    }

    const { data: revisionRow, error: revisionError } = await supabase
      .from('email_template_revisions')
      .insert({
        template_id: templateRow.id,
        revision_number: 1,
        subject_template: input.subjectTemplate,
        body_template: resolvedBodyTemplate,
        blocks: blocksPayload,
      })
      .select('*')
      .single()

    if (revisionError || !revisionRow) {
      throw new EmailTemplateServiceError(
        `Failed to create template revision: ${revisionError?.message ?? 'unknown error'}`,
        'EMAIL_TEMPLATE_CREATE_ERROR',
        revisionError,
      )
    }

    const { data: updatedTemplate, error: updateError } = await supabase
      .from('email_templates')
      .update({
        current_revision_id: revisionRow.id,
      })
      .eq('id', templateRow.id)
      .select('*')
      .single()

    if (updateError || !updatedTemplate) {
      throw new EmailTemplateServiceError(
        `Failed to set template revision: ${updateError?.message ?? 'unknown error'}`,
        'EMAIL_TEMPLATE_CREATE_ERROR',
        updateError,
      )
    }

    return {
      template: mapTemplateRow(updatedTemplate as EmailTemplateRow),
      revision: mapTemplateRevisionRow(revisionRow as EmailTemplateRevisionRow),
      validation,
    }
  }

  async updateTemplateRevision(
    templateId: string,
    input: {
      name?: string
      description?: string | null
      subjectTemplate: string
      bodyTemplate: string
      blocks?: EmailTemplateBlock[]
      importedBodyHtml?: string | null
    },
  ): Promise<{ template: EmailTemplate; revision: EmailTemplateRevision; validation: EmailTemplateValidationResult }> {
    const resolvedBodyTemplate = this.resolveBodyTemplateInput(input)
    const blocksPayload = buildBlocksPayload({ blocks: input.blocks, bodyTemplate: resolvedBodyTemplate })
    const validation = validateEmailTemplate(input.subjectTemplate, resolvedBodyTemplate, blocksPayload)
    this.assertTemplateValidation(validation, 'save')
    const supabase = getSupabaseClient()
    const maxRevision = await this.fetchMaxRevisionNumber(templateId)

    const { data: revisionRow, error: revisionError } = await supabase
      .from('email_template_revisions')
      .insert({
        template_id: templateId,
        revision_number: maxRevision + 1,
        subject_template: input.subjectTemplate,
        body_template: resolvedBodyTemplate,
        blocks: blocksPayload,
      })
      .select('*')
      .single()

    if (revisionError || !revisionRow) {
      throw new EmailTemplateServiceError(
        `Failed to create template revision: ${revisionError?.message ?? 'unknown error'}`,
        'EMAIL_TEMPLATE_UPDATE_ERROR',
        revisionError,
      )
    }

    const payload: Record<string, unknown> = {
      current_revision_id: revisionRow.id,
      // Intentionally do not touch `state` here: editing a draft or inactive
      // template should not silently promote it to the publishing default.
      // Use setActiveTemplate(id) to change which template is "in use".
    }
    if (input.name !== undefined) {
      payload.name = input.name.trim()
    }
    if (input.description !== undefined) {
      payload.description = input.description?.trim() || null
    }

    const { data: templateRow, error: templateError } = await supabase
      .from('email_templates')
      .update(payload)
      .eq('id', templateId)
      .select('*')
      .single()

    if (templateError || !templateRow) {
      throw new EmailTemplateServiceError(
        `Failed to update template: ${templateError?.message ?? 'unknown error'}`,
        'EMAIL_TEMPLATE_UPDATE_ERROR',
        templateError,
      )
    }

    return {
      template: mapTemplateRow(templateRow as EmailTemplateRow),
      revision: mapTemplateRevisionRow(revisionRow as EmailTemplateRevisionRow),
      validation,
    }
  }

  async duplicateTemplate(templateId: string, nameOverride?: string): Promise<{ template: EmailTemplate; revision: EmailTemplateRevision }> {
    const source = await this.getCurrentRevision(templateId)

    const created = await this.createTemplate({
      name: nameOverride?.trim() || `${source.template.name} (copy)`,
      description: source.template.description ?? null,
      subjectTemplate: source.revision.subjectTemplate,
      bodyTemplate: source.revision.bodyTemplate,
      blocks: source.revision.blocks.map((block) => ({
        type: block.type,
        order: block.order,
        visible: block.visible,
        bodyHtml: block.bodyHtml,
        config: { ...block.config },
      })),
    })

    return {
      template: created.template,
      revision: created.revision,
    }
  }

  async deleteTemplate(templateId: string): Promise<void> {
    const supabase = getSupabaseClient()
    const { error } = await supabase
      .from('email_templates')
      .delete()
      .eq('id', templateId)

    if (error) {
      throw new EmailTemplateServiceError(
        `Failed to delete template: ${error.message}`,
        'EMAIL_TEMPLATE_DELETE_ERROR',
        error,
      )
    }
  }

  /**
   * Promote a template to the singleton "active" slot used by
   * `newsletterDeliveryService.resolveActiveTemplate()` when publishing a
   * newsletter. Demotes any currently-active template to `inactive` first so
   * the partial unique index `email_templates_single_active_idx` (see
   * migration 20260423000000) is satisfied.
   *
   * Requires the template to have at least one saved revision; without one,
   * publishing would resolve to a template with no body to render.
   */
  async setActiveTemplate(templateId: string): Promise<EmailTemplate> {
    const supabase = getSupabaseClient()

    const { data: targetRow, error: targetError } = await supabase
      .from('email_templates')
      .select('*')
      .eq('id', templateId)
      .single()

    if (targetError || !targetRow) {
      throw new EmailTemplateServiceError(
        `Template not found: ${templateId}`,
        'EMAIL_TEMPLATE_NOT_FOUND',
        targetError,
      )
    }

    if (!(targetRow as EmailTemplateRow).current_revision_id) {
      throw new EmailTemplateServiceError(
        'Template has no saved revision yet. Save the template before marking it as active.',
        'EMAIL_TEMPLATE_NO_REVISION',
      )
    }

    if ((targetRow as EmailTemplateRow).state === 'active') {
      return mapTemplateRow(targetRow as EmailTemplateRow)
    }

    // Demote first, promote second. Order matters: the partial unique index on
    // (state) WHERE state='active' would reject a second active row, so we
    // never have two actives in flight, even briefly.
    const { error: demoteError } = await supabase
      .from('email_templates')
      .update({ state: 'inactive' })
      .eq('state', 'active')
      .neq('id', templateId)

    if (demoteError) {
      throw new EmailTemplateServiceError(
        `Failed to demote previous active template: ${demoteError.message}`,
        'EMAIL_TEMPLATE_SET_ACTIVE_ERROR',
        demoteError,
      )
    }

    const { data: updatedRow, error: promoteError } = await supabase
      .from('email_templates')
      .update({ state: 'active' })
      .eq('id', templateId)
      .select('*')
      .single()

    if (promoteError || !updatedRow) {
      throw new EmailTemplateServiceError(
        `Failed to mark template as active: ${promoteError?.message ?? 'unknown error'}`,
        'EMAIL_TEMPLATE_SET_ACTIVE_ERROR',
        promoteError,
      )
    }

    return mapTemplateRow(updatedRow as EmailTemplateRow)
  }

  async getCurrentRevision(templateId: string): Promise<{ template: EmailTemplate; revision: EmailTemplateRevision }> {
    const supabase = getSupabaseClient()
    const { data: templateRow, error: templateError } = await supabase
      .from('email_templates')
      .select('*')
      .eq('id', templateId)
      .single()

    if (templateError || !templateRow) {
      throw new EmailTemplateServiceError(
        `Template not found: ${templateId}`,
        'EMAIL_TEMPLATE_NOT_FOUND',
        templateError,
      )
    }

    const revisionId = (templateRow as EmailTemplateRow).current_revision_id
    if (!revisionId) {
      throw new EmailTemplateServiceError(
        `Template has no current revision: ${templateId}`,
        'EMAIL_TEMPLATE_REVISION_NOT_FOUND',
      )
    }

    const revision = await this.getRevisionById(revisionId)
    return {
      template: mapTemplateRow(templateRow as EmailTemplateRow),
      revision,
    }
  }

  async getRevisionById(revisionId: string): Promise<EmailTemplateRevision> {
    const supabase = getSupabaseClient()
    const { data, error } = await supabase
      .from('email_template_revisions')
      .select('*')
      .eq('id', revisionId)
      .single()

    if (error || !data) {
      throw new EmailTemplateServiceError(
        `Template revision not found: ${revisionId}`,
        'EMAIL_TEMPLATE_REVISION_NOT_FOUND',
        error,
      )
    }

    return mapTemplateRevisionRow(data as EmailTemplateRevisionRow)
  }

  previewRevision(
    revision: Pick<EmailTemplateRevision, 'subjectTemplate' | 'bodyTemplate'> & {
      blocks?: EmailTemplateBlock[]
    },
    context: EmailTemplateRenderContext,
    sampleData?: {
      sharedArticles?: RecipientArticle[]
      classes?: RecipientClass[]
      weeklyItems?: RecipientArticle[]
    },
  ): EmailTemplatePreviewResult {
    const subjectPreview = renderEmailTemplatePreview(revision.subjectTemplate, '', context)
    const blocks = Array.isArray(revision.blocks) ? revision.blocks : []
    if (blocks.length === 0) {
      const bodyPreview = renderEmailTemplatePreview('', revision.bodyTemplate, context)
      return {
        subject: subjectPreview.subject,
        body: bodyPreview.body,
        warnings: [
          ...subjectPreview.warnings,
          ...bodyPreview.warnings,
        ],
      }
    }
    const merged = mergePreviewSampleData(sampleData)
    const recipientContext: RecipientRenderContext = {
      templateContext: context,
      sharedArticles: merged.sharedArticles,
      classes: merged.classes,
      weeklyItems: merged.weeklyItems,
    }
    const walker = renderTemplateForRecipient(blocks, recipientContext, {
      subjectForDocumentTitle: subjectPreview.subject,
      wrapInDocumentShell: true,
    })
    return {
      subject: subjectPreview.subject,
      body: walker.html,
      warnings: [
        ...subjectPreview.warnings,
        ...walker.missingTokens.map((token) => ({
          field: 'body' as const,
          token,
          message: `Missing value for token: ${token}`,
        })),
      ],
    }
  }

  /**
   * Render a single block with the same sample data as `previewRevision`, without the outer
   * document shell (fragment only), for admin “preview this block” UX.
   */
  previewBlock(
    block: EmailTemplateBlock,
    context: EmailTemplateRenderContext,
    sampleData?: {
      sharedArticles?: RecipientArticle[]
      classes?: RecipientClass[]
      weeklyItems?: RecipientArticle[]
    },
  ): EmailTemplatePreviewResult {
    const merged = mergePreviewSampleData(sampleData)
    const recipientContext: RecipientRenderContext = {
      templateContext: context,
      sharedArticles: merged.sharedArticles,
      classes: merged.classes,
      weeklyItems: merged.weeklyItems,
    }
    const walker = renderTemplateForRecipient([block], recipientContext, {
      subjectForDocumentTitle: '',
      wrapInDocumentShell: false,
    })
    return {
      subject: '',
      body: walker.html,
      warnings: [
        ...walker.missingTokens.map((token) => ({
          field: 'body' as const,
          token,
          message: `Missing value for token: ${token}`,
        })),
      ],
    }
  }
}

export const emailTemplateService = new EmailTemplateService()

