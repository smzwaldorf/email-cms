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

export interface EmailTemplateRevision {
  id: string
  templateId: string
  revisionNumber: number
  subjectTemplate: string
  bodyTemplate: string
  createdAt: string
  createdBy?: string | null
}

export interface EmailTemplateValidationIssue {
  code: 'unsupported_token' | 'required_field_missing'
  field: 'subject' | 'body'
  message: string
  token?: string
}

export interface EmailTemplateValidationResult {
  valid: boolean
  issues: EmailTemplateValidationIssue[]
}

export interface EmailTemplatePreviewWarning {
  field: 'subject' | 'body'
  token: string
  message: string
}

export interface EmailTemplatePreviewResult {
  subject: string
  body: string
  warnings: EmailTemplatePreviewWarning[]
}

