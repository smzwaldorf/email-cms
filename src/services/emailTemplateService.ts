import { getSupabaseClient } from '@/lib/supabase'
import type {
  EmailTemplate,
  EmailTemplatePreviewResult,
  EmailTemplateRevision,
  EmailTemplateValidationResult,
} from '@/types/emailTemplate'
import type { EmailTemplateRevisionRow, EmailTemplateRow } from '@/types/database'
import {
  renderEmailTemplatePreview,
  validateEmailTemplate,
  type EmailTemplateRenderContext,
} from '@/services/emailTemplateTokens'

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
  return {
    id: row.id,
    templateId: row.template_id,
    revisionNumber: row.revision_number,
    subjectTemplate: row.subject_template,
    bodyTemplate: row.body_template,
    createdAt: row.created_at,
    createdBy: row.created_by ?? null,
  }
}

class EmailTemplateService {
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
  }): Promise<{ template: EmailTemplate; revision: EmailTemplateRevision; validation: EmailTemplateValidationResult }> {
    const validation = validateEmailTemplate(input.subjectTemplate, input.bodyTemplate)
    this.assertTemplateValidation(validation, 'create')
    const supabase = getSupabaseClient()

    const { data: templateRow, error: templateError } = await supabase
      .from('email_templates')
      .insert({
        name: input.name.trim(),
        description: input.description?.trim() || null,
        state: 'active',
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
        body_template: input.bodyTemplate,
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
    },
  ): Promise<{ template: EmailTemplate; revision: EmailTemplateRevision; validation: EmailTemplateValidationResult }> {
    const validation = validateEmailTemplate(input.subjectTemplate, input.bodyTemplate)
    this.assertTemplateValidation(validation, 'save')
    const supabase = getSupabaseClient()
    const maxRevision = await this.fetchMaxRevisionNumber(templateId)

    const { data: revisionRow, error: revisionError } = await supabase
      .from('email_template_revisions')
      .insert({
        template_id: templateId,
        revision_number: maxRevision + 1,
        subject_template: input.subjectTemplate,
        body_template: input.bodyTemplate,
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
      state: 'active',
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
    revision: Pick<EmailTemplateRevision, 'subjectTemplate' | 'bodyTemplate'>,
    context: EmailTemplateRenderContext,
  ): EmailTemplatePreviewResult {
    return renderEmailTemplatePreview(revision.subjectTemplate, revision.bodyTemplate, context)
  }
}

export const emailTemplateService = new EmailTemplateService()

