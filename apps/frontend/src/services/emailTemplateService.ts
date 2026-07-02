import { adminRpc } from '@/services/backendApi'
import { normalizeCanvaEmailHtml } from '@/services/canvaEmailImport'
import {
  renderTemplateForRecipient,
  type RecipientArticle,
  type RecipientClass,
  type RecipientRenderContext,
} from '@/services/emailTemplateRenderer'
import {
  renderEmailTemplatePreview,
  type EmailTemplateRenderContext,
} from '@/services/emailTemplateTokens'
import type {
  EmailTemplate,
  EmailTemplateBlock,
  EmailTemplatePreviewResult,
  EmailTemplateRevision,
  EmailTemplateValidationResult,
} from '@/types/emailTemplate'
import type { FileEmailTemplateSyncInput } from '@/types/fileEmailTemplate'

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

class EmailTemplateService {
  normalizeImportedBodyHtml(rawHtml: string) {
    return normalizeCanvaEmailHtml(rawHtml)
  }

  listTemplates(): Promise<EmailTemplate[]> {
    return adminRpc<EmailTemplate[]>('emailTemplate', 'listTemplates')
  }

  createTemplate(input: {
    name: string
    description?: string | null
    subjectTemplate: string
    bodyTemplate: string
    blocks?: EmailTemplateBlock[]
    importedBodyHtml?: string | null
  }): Promise<{ template: EmailTemplate; revision: EmailTemplateRevision; validation: EmailTemplateValidationResult }> {
    return adminRpc('emailTemplate', 'createTemplate', [input])
  }

  updateTemplateRevision(
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
    return adminRpc('emailTemplate', 'updateTemplateRevision', [templateId, input])
  }

  syncFileTemplate(input: FileEmailTemplateSyncInput): Promise<{
    template: EmailTemplate
    revision: EmailTemplateRevision
    validation: EmailTemplateValidationResult
  }> {
    return adminRpc('emailTemplate', 'syncFileTemplate', [input])
  }

  duplicateTemplate(templateId: string, nameOverride?: string): Promise<{ template: EmailTemplate; revision: EmailTemplateRevision }> {
    return adminRpc('emailTemplate', 'duplicateTemplate', [templateId, nameOverride])
  }

  deleteTemplate(templateId: string): Promise<void> {
    return adminRpc('emailTemplate', 'deleteTemplate', [templateId])
  }

  setActiveTemplate(templateId: string): Promise<EmailTemplate> {
    return adminRpc('emailTemplate', 'setActiveTemplate', [templateId])
  }

  getCurrentRevision(templateId: string): Promise<{ template: EmailTemplate; revision: EmailTemplateRevision }> {
    return adminRpc('emailTemplate', 'getCurrentRevision', [templateId])
  }

  getRevisionById(revisionId: string): Promise<EmailTemplateRevision> {
    return adminRpc('emailTemplate', 'getRevisionById', [revisionId])
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
