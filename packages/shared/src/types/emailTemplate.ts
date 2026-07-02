export type EmailTemplateLifecycleState = 'draft' | 'active' | 'inactive'

export interface EmailTemplate {
  id: string
  name: string
  description?: string | null
  state: EmailTemplateLifecycleState
  currentRevisionId: string | null
  createdAt: string
  updatedAt: string
  deactivatedAt?: string | null
}

export type EmailBlockType =
  | 'header'
  | 'shared-article-feature'
  | 'class-article-feature'
  | 'weekly-summary-list'
  | 'section-divider'
  | 'about'
  | 'footer'
  | 'custom-html'

export type EmailTemplateBlockConfig = Record<string, unknown>

export interface EmailTemplateBlock {
  type: EmailBlockType
  order: number
  visible: boolean
  bodyHtml: string
  config: EmailTemplateBlockConfig
}

export interface EmailTemplateRevision {
  id: string
  templateId: string
  revisionNumber: number
  subjectTemplate: string
  bodyTemplate: string
  blocks: EmailTemplateBlock[]
  createdAt: string
  createdBy?: string | null
}

export type EmailTemplateValidationField = 'subject' | 'body' | `block:${number}`

export interface EmailTemplateValidationIssue {
  code: 'unsupported_token' | 'required_field_missing' | 'unsupported_block_type'
  field: EmailTemplateValidationField
  message: string
  token?: string
  blockIndex?: number
  blockType?: EmailBlockType
}

export interface EmailTemplateValidationResult {
  valid: boolean
  issues: EmailTemplateValidationIssue[]
}

export interface EmailTemplatePreviewWarning {
  field: EmailTemplateValidationField
  token: string
  message: string
  blockIndex?: number
  blockType?: EmailBlockType
}

export interface EmailTemplatePreviewResult {
  subject: string
  body: string
  warnings: EmailTemplatePreviewWarning[]
}

