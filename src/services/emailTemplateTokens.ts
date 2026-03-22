import type {
  EmailTemplatePreviewResult,
  EmailTemplateValidationIssue,
  EmailTemplateValidationResult,
} from '@/types/emailTemplate'

export const EMAIL_TEMPLATE_TOKENS = [
  'guardian.id',
  'guardian.email',
  'family.id',
  'newsletter.id',
  'newsletter.revisionId',
  'classes.count',
  'classes.list',
] as const

type AllowedToken = (typeof EMAIL_TEMPLATE_TOKENS)[number]
type TemplateField = 'subject' | 'body'

const TOKEN_PATTERN = /\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g
const REQUIRED_FIELDS: TemplateField[] = ['subject', 'body']
const ALLOWED_SET = new Set<string>(EMAIL_TEMPLATE_TOKENS)

export interface EmailTemplateRenderContext {
  guardian?: {
    id?: string
    email?: string
  }
  family?: {
    id?: string | null
  }
  newsletter: {
    id: string
    revisionId: string
  }
  classes: {
    ids: string[]
  }
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values))
}

function listTokens(template: string): string[] {
  const tokens: string[] = []
  for (const match of template.matchAll(TOKEN_PATTERN)) {
    if (match[1]) {
      tokens.push(match[1])
    }
  }
  return unique(tokens)
}

function isAllowedToken(token: string): token is AllowedToken {
  return ALLOWED_SET.has(token)
}

function resolveToken(token: AllowedToken, context: EmailTemplateRenderContext): string {
  switch (token) {
    case 'guardian.id':
      return context.guardian?.id ?? ''
    case 'guardian.email':
      return context.guardian?.email ?? ''
    case 'family.id':
      return context.family?.id ?? ''
    case 'newsletter.id':
      return context.newsletter.id
    case 'newsletter.revisionId':
      return context.newsletter.revisionId
    case 'classes.count':
      return String(context.classes.ids.length)
    case 'classes.list':
      return context.classes.ids.join(', ')
  }
}

export function validateEmailTemplate(
  subjectTemplate: string,
  bodyTemplate: string,
): EmailTemplateValidationResult {
  const issues: EmailTemplateValidationIssue[] = []
  // Preserve template content exactly as entered; do not trim HTML/template text.
  if (subjectTemplate.length === 0) {
    issues.push({
      code: 'required_field_missing',
      field: 'subject',
      message: 'Subject is required.',
    })
  }

  if (bodyTemplate.length === 0) {
    issues.push({
      code: 'required_field_missing',
      field: 'body',
      message: 'Body is required.',
    })
  }

  const fields: Array<{ field: TemplateField; value: string }> = [
    { field: 'subject', value: subjectTemplate },
    { field: 'body', value: bodyTemplate },
  ]

  for (const field of fields) {
    for (const token of listTokens(field.value)) {
      if (!isAllowedToken(token)) {
        issues.push({
          code: 'unsupported_token',
          field: field.field,
          token,
          message: `Unsupported token: ${token}`,
        })
      }
    }
  }

  return {
    valid: issues.length === 0,
    issues,
  }
}

export function renderEmailTemplatePreview(
  subjectTemplate: string,
  bodyTemplate: string,
  context: EmailTemplateRenderContext,
): EmailTemplatePreviewResult {
  const warnings: EmailTemplatePreviewResult['warnings'] = []

  const renderField = (field: TemplateField, template: string): string => {
    return template.replace(TOKEN_PATTERN, (_raw, tokenValue: string) => {
      const token = tokenValue?.trim() ?? ''
      if (!isAllowedToken(token)) {
        return ''
      }

      const resolved = resolveToken(token, context)
      if (!resolved) {
        warnings.push({
          field,
          token,
          message: `Missing value for token: ${token}`,
        })
      }

      return resolved
    })
  }

  return {
    subject: renderField('subject', subjectTemplate),
    body: renderField('body', bodyTemplate),
    warnings,
  }
}

export const EMAIL_TEMPLATE_REQUIRED_FIELDS = REQUIRED_FIELDS

