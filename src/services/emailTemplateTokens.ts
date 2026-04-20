import type {
  EmailTemplateBlock,
  EmailTemplatePreviewResult,
  EmailTemplateValidationField,
  EmailTemplateValidationIssue,
  EmailTemplateValidationResult,
} from '@/types/emailTemplate'
import { getEmailBlockTypeDefinition, isEmailBlockType } from '@/services/emailTemplateBlocks'

export const EMAIL_TEMPLATE_TOKENS = [
  'guardian.id',
  'guardian.email',
  'family.id',
  'newsletter.id',
  'newsletter.revisionId',
  'classes.count',
  'classes.list',
] as const

export type GlobalToken = (typeof EMAIL_TEMPLATE_TOKENS)[number]

const TOKEN_PATTERN = /\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g
const GLOBAL_TOKENS = new Set<string>(EMAIL_TEMPLATE_TOKENS)

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

function resolveGlobalToken(token: GlobalToken, context: EmailTemplateRenderContext): string {
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

function isGlobalToken(token: string): token is GlobalToken {
  return GLOBAL_TOKENS.has(token)
}

/**
 * Validates a template revision's subject + body + (optional) typed-block list.
 *
 * - Subject and the legacy `bodyTemplate` validate against the global token scope.
 * - Each block's `bodyHtml` validates against `global ∪ blockType.innerScopeTokens`.
 * - When `blocks` is omitted (undefined), the legacy single-body validation
 *   behavior is preserved exactly.
 * - Empty `blocks: []` is allowed (legacy revisions backfilled with a single
 *   block; tests pass `undefined` to opt out of block validation).
 */
export function validateEmailTemplate(
  subjectTemplate: string,
  bodyTemplate: string,
  blocks?: EmailTemplateBlock[],
): EmailTemplateValidationResult {
  const issues: EmailTemplateValidationIssue[] = []

  if (subjectTemplate.length === 0) {
    issues.push({
      code: 'required_field_missing',
      field: 'subject',
      message: 'Subject is required.',
    })
  }

  const hasBlocks = Array.isArray(blocks) && blocks.length > 0

  if (!hasBlocks && bodyTemplate.length === 0) {
    issues.push({
      code: 'required_field_missing',
      field: 'body',
      message: 'Body is required.',
    })
  }

  for (const token of listTokens(subjectTemplate)) {
    if (!isGlobalToken(token)) {
      issues.push({
        code: 'unsupported_token',
        field: 'subject',
        token,
        message: `Unsupported token in subject: ${token}`,
      })
    }
  }

  if (!hasBlocks) {
    for (const token of listTokens(bodyTemplate)) {
      if (!isGlobalToken(token)) {
        issues.push({
          code: 'unsupported_token',
          field: 'body',
          token,
          message: `Unsupported token in body: ${token}`,
        })
      }
    }
  } else {
    blocks!.forEach((block, index) => {
      const fieldName: EmailTemplateValidationField = `block:${index}`
      if (!isEmailBlockType(block.type)) {
        issues.push({
          code: 'unsupported_block_type',
          field: fieldName,
          blockIndex: index,
          message: `Unsupported block type at index ${index}: ${String(block.type)}`,
        })
        return
      }
      const definition = getEmailBlockTypeDefinition(block.type)
      const allowedInnerTokens = new Set<string>([
        ...EMAIL_TEMPLATE_TOKENS,
        ...definition.innerScopeTokens,
      ])
      for (const token of listTokens(block.bodyHtml)) {
        if (!allowedInnerTokens.has(token)) {
          issues.push({
            code: 'unsupported_token',
            field: fieldName,
            blockIndex: index,
            blockType: block.type,
            token,
            message: `Unsupported token in block ${index} (${block.type}): ${token}`,
          })
        }
      }
    })
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

  const renderField = (
    field: 'subject' | 'body',
    template: string,
  ): string => {
    return template.replace(TOKEN_PATTERN, (_raw, tokenValue: string) => {
      const token = tokenValue?.trim() ?? ''
      if (!isGlobalToken(token)) {
        return ''
      }

      const resolved = resolveGlobalToken(token, context)
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

export const EMAIL_TEMPLATE_REQUIRED_FIELDS: Array<'subject' | 'body'> = ['subject', 'body']

/** Internal helper exposed for the block-walker renderer. */
export function expandTemplateString(
  template: string,
  scope: Record<string, string>,
): { html: string; missingTokens: string[] } {
  const missing: string[] = []
  const html = template.replace(TOKEN_PATTERN, (_raw, tokenValue: string) => {
    const token = tokenValue?.trim() ?? ''
    if (!Object.prototype.hasOwnProperty.call(scope, token)) {
      missing.push(token)
      return ''
    }
    const resolved = scope[token]
    if (!resolved) {
      missing.push(token)
    }
    return resolved
  })
  return { html, missingTokens: unique(missing) }
}

export function buildGlobalTokenScope(context: EmailTemplateRenderContext): Record<string, string> {
  return {
    'guardian.id': context.guardian?.id ?? '',
    'guardian.email': context.guardian?.email ?? '',
    'family.id': context.family?.id ?? '',
    'newsletter.id': context.newsletter.id,
    'newsletter.revisionId': context.newsletter.revisionId,
    'classes.count': String(context.classes.ids.length),
    'classes.list': context.classes.ids.join(', '),
  }
}
