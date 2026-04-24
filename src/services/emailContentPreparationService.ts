import { normalizeCanvaEmailHtml } from '@/services/canvaEmailImport'
import { validateEmailTemplate } from '@/services/emailTemplateTokens'
import {
  composePersonalizedEmails,
  computeRenderedHtmlFingerprint,
} from '@/services/personalizedEmailComposer'
import { EMAIL_HTML_STORAGE_SIGN_TTL_SECONDS, replaceStorageTokens } from '@/utils/contentParser'
import type {
  DeliveryHandoffContract,
  EmailContentPreparationJob,
  PrepareEmailContentInput,
  PreparationFinding,
  PreparationPinnedInputReferences,
  PreparationRecipientStatus,
  PreparedRecipientPreview,
  PreparedRecipientRecord,
} from '@/types/emailPreparation'

const TOKEN_VALUE_PATTERN = /^[a-zA-Z0-9_.]+$/

function toCanonicalString(value: string | null | undefined): string {
  return value?.trim() ?? ''
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value)
  }

  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableStringify(entry)).join(',')}]`
  }

  const entries = Object.entries(value as Record<string, unknown>).sort(([left], [right]) =>
    left.localeCompare(right),
  )

  return `{${entries
    .map(([key, entry]) => `${JSON.stringify(key)}:${stableStringify(entry)}`)
    .join(',')}}`
}

function hashString(input: string): string {
  let hash = 2166136261

  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }

  return `prep-${(hash >>> 0).toString(16).padStart(8, '0')}`
}

function toMalformedTokenFindings(
  value: string,
  field: 'subject' | 'body',
  guardianId: string,
): PreparationFinding[] {
  const findings: PreparationFinding[] = []
  const openCount = value.match(/\{\{/g)?.length ?? 0
  const closeCount = value.match(/\}\}/g)?.length ?? 0

  if (openCount !== closeCount) {
    findings.push({
      code: 'malformed_token_syntax',
      severity: 'error',
      guardianId,
      field,
      message: `Malformed token syntax in ${field}: unmatched token braces.`,
      details: { field, openCount, closeCount },
    })
  }

  for (const match of value.matchAll(/\{\{([^}]*)\}\}/g)) {
    const raw = match[1]?.trim() ?? ''
    if (raw.length === 0 || !TOKEN_VALUE_PATTERN.test(raw)) {
      findings.push({
        code: 'malformed_token_syntax',
        severity: 'error',
        guardianId,
        field,
        message: `Malformed token syntax in ${field}: '${raw || '(empty)'}'.`,
        details: { field, token: raw },
      })
    }
  }

  return findings
}

function createPinnedReferences(input: PrepareEmailContentInput, capturedAt: string): PreparationPinnedInputReferences {
  return {
    newsletterId: input.newsletter.newsletterId,
    newsletterRevisionId: input.newsletter.newsletterRevisionId,
    templateId: input.template?.templateId ?? null,
    templateRevisionId: input.template?.templateRevisionId ?? null,
    recipientSnapshotCapturedAt: capturedAt,
    rulesVersion: toCanonicalString(input.rulesVersion) || 'v1',
  }
}

export function computePreparationDeterministicHash(job: Omit<EmailContentPreparationJob, 'deterministicHash'>): string {
  const canonical = stableStringify(job)
  return hashString(canonical)
}

export function arePreparationOutputsDeterministic(
  left: EmailContentPreparationJob,
  right: EmailContentPreparationJob,
): boolean {
  return left.deterministicHash === right.deterministicHash
}

function templateHtmlForCanvaImport(template: {
  bodyTemplate: string
  blocks?: Array<{ bodyHtml?: string }>
}): string {
  const trimmed = template.bodyTemplate?.trim() ?? ''
  if (trimmed.length > 0) {
    return template.bodyTemplate
  }
  if (template.blocks && template.blocks.length > 0) {
    return template.blocks.map((block) => block.bodyHtml ?? '').join('\n')
  }
  return template.bodyTemplate ?? ''
}

function classifyStatus(findings: PreparationFinding[]): PreparationRecipientStatus {
  if (findings.some((finding) => finding.severity === 'error')) {
    return 'failed'
  }
  if (findings.length > 0) {
    return 'warning'
  }
  return 'ready'
}

function summarize(recipients: PreparedRecipientRecord[]): EmailContentPreparationJob['summary'] {
  const readyRecipients = recipients.filter((recipient) => recipient.status === 'ready').length
  const warningRecipients = recipients.filter((recipient) => recipient.status === 'warning').length
  const failedRecipients = recipients.filter((recipient) => recipient.status === 'failed').length
  const actionableErrors = recipients.flatMap((recipient) =>
    recipient.findings
      .filter((finding) => finding.severity === 'error')
      .map((finding, index) => ({
        guardianId: recipient.guardianId,
        detailRef: `guardian:${recipient.guardianId}:finding:${index}`,
        code: finding.code,
        message: finding.message,
        field: finding.field,
        details: finding.details,
      })),
  )

  return {
    totalRecipients: recipients.length,
    readyRecipients,
    warningRecipients,
    failedRecipients,
    actionableErrors,
  }
}

class EmailContentPreparationService {
  private readonly jobs = new Map<string, EmailContentPreparationJob>()

  async prepare(input: PrepareEmailContentInput): Promise<EmailContentPreparationJob> {
    const createdAt = input.startedAt ?? new Date().toISOString()
    const composition = composePersonalizedEmails({
      ...input,
      snapshotCapturedAt: input.snapshotCapturedAt ?? createdAt,
    })

    const payloadsWithResolvedStorage = await Promise.all(
      composition.payloads.map(async (payload) => {
        const raw = payload.renderedBody ?? ''
        if (!raw.includes('storage://')) {
          return payload
        }
        const resolved = await replaceStorageTokens(raw, EMAIL_HTML_STORAGE_SIGN_TTL_SECONDS)
        return {
          ...payload,
          renderedBody: resolved,
          renderedHtmlFingerprint: computeRenderedHtmlFingerprint(resolved),
        }
      }),
    )

    const pinnedInputs = createPinnedReferences(input, composition.snapshot.capturedAt)
    const warningByGuardian = new Map<string, PreparationFinding[]>()

    for (const warning of composition.warnings) {
      const findings = warningByGuardian.get(warning.guardianId) ?? []
      if (warning.code === 'missing_template_value') {
        findings.push({
          code: 'missing_required_value',
          severity: 'error',
          guardianId: warning.guardianId,
          message: warning.message,
          details: warning.details,
        })
      } else {
        findings.push({
          code: warning.code,
          severity: 'warning',
          guardianId: warning.guardianId,
          message: warning.message,
          details: warning.details,
        })
      }
      warningByGuardian.set(warning.guardianId, findings)
    }

    const templateValidation = validateEmailTemplate(
      input.template?.subjectTemplate ?? '',
      input.template?.bodyTemplate ?? '',
      input.template?.blocks,
    )
    const importValidation = input.template
      ? normalizeCanvaEmailHtml(templateHtmlForCanvaImport(input.template))
      : null

    const recipientRecords = payloadsWithResolvedStorage.map((payload) => {
      const findings: PreparationFinding[] = [...(warningByGuardian.get(payload.guardianId) ?? [])]

      for (const issue of templateValidation.issues) {
        if (issue.code === 'required_field_missing') {
          const field =
            issue.field === 'subject' || issue.field === 'body' ? issue.field : undefined
          findings.push({
            code: 'missing_required_section',
            severity: 'error',
            guardianId: payload.guardianId,
            field,
            message: issue.message,
            details: { field: issue.field },
          })
        } else if (issue.code === 'unsupported_token') {
          const field =
            issue.field === 'subject' || issue.field === 'body' ? issue.field : undefined
          findings.push({
            code: 'unsupported_token',
            severity: 'error',
            guardianId: payload.guardianId,
            field,
            message: issue.message,
            details: { field: issue.field, token: issue.token },
          })
        } else if (issue.code === 'unsupported_block_type') {
          findings.push({
            code: 'unsupported_token',
            severity: 'error',
            guardianId: payload.guardianId,
            message: issue.message,
            details: { blockIndex: issue.blockIndex, blockType: issue.blockType },
          })
        }
      }

      if (input.template) {
        findings.push(
          ...toMalformedTokenFindings(input.template.subjectTemplate, 'subject', payload.guardianId),
          ...toMalformedTokenFindings(input.template.bodyTemplate, 'body', payload.guardianId),
        )
      }

      if (importValidation?.hasBlockingIssues) {
        for (const issue of importValidation.issues) {
          findings.push({
            code: 'incompatible_template_html',
            severity: 'error',
            guardianId: payload.guardianId,
            field: 'body',
            message: issue.message,
            details: {
              code: issue.code,
              tagName: issue.tagName,
              attribute: issue.attribute,
              value: issue.value,
              templateId: input.template?.templateId ?? null,
              templateRevisionId: input.template?.templateRevisionId ?? null,
            },
          })
        }
      }

      if ((payload.renderedSubject ?? '').length === 0) {
        findings.push({
          code: 'missing_required_section',
          severity: 'error',
          guardianId: payload.guardianId,
          field: 'subject',
          message: 'Missing required section: subject.',
          details: { field: 'subject' },
        })
      }

      if ((payload.renderedBody ?? '').length === 0) {
        findings.push({
          code: 'missing_required_section',
          severity: 'error',
          guardianId: payload.guardianId,
          field: 'body',
          message: 'Missing required section: body.',
          details: { field: 'body' },
        })
      }

      return {
        guardianId: payload.guardianId,
        guardianEmail: payload.guardianEmail,
        payload,
        findings,
        status: classifyStatus(findings),
      }
    })

    const summary = summarize(recipientRecords)
    const draftJob: Omit<EmailContentPreparationJob, 'deterministicHash'> = {
      jobId: input.preparationJobId ?? hashString(stableStringify({ pinnedInputs, recipients: recipientRecords })),
      createdAt,
      retryOfJobId: input.retryOfJobId ?? null,
      pinnedInputs,
      recipients: recipientRecords,
      summary,
    }
    const job = {
      ...draftJob,
      deterministicHash: computePreparationDeterministicHash(draftJob),
    }
    this.jobs.set(job.jobId, job)

    return job
  }

  getJob(jobId: string): EmailContentPreparationJob | null {
    return this.jobs.get(jobId) ?? null
  }

  getRecipientPreview(jobId: string, guardianId: string): PreparedRecipientPreview {
    const job = this.jobs.get(jobId)
    if (!job) {
      throw new Error(`Preparation job not found: ${jobId}`)
    }

    const recipient = job.recipients.find((entry) => entry.guardianId === guardianId)
    if (!recipient) {
      throw new Error(`Recipient not found in preparation job: ${guardianId}`)
    }

    return {
      jobId,
      guardianId,
      subject: recipient.payload.renderedSubject ?? '',
      body: recipient.payload.renderedBody ?? '',
      findings: recipient.findings,
      status: recipient.status,
    }
  }

  getReviewSummary(jobId: string): EmailContentPreparationJob['summary'] {
    const job = this.jobs.get(jobId)
    if (!job) {
      throw new Error(`Preparation job not found: ${jobId}`)
    }
    return job.summary
  }

  createDeliveryHandoff(jobId: string): DeliveryHandoffContract {
    const job = this.jobs.get(jobId)
    if (!job) {
      throw new Error(`Preparation job not found: ${jobId}`)
    }

    const readyPayloads = job.recipients
      .filter((recipient) => recipient.status === 'ready')
      .map((recipient) => recipient.payload)
    const nonReadyRecipients = job.recipients
      .filter((recipient) => recipient.status === 'warning' || recipient.status === 'failed')

    return {
      jobId,
      deliverablePayloads: readyPayloads,
      readyPayloads,
      nonReadyRecipients,
      failedRecipients: job.recipients.filter((recipient) => recipient.status === 'failed'),
    }
  }

  async retryFailedRecipients(
    previousJobId: string,
    input: PrepareEmailContentInput,
  ): Promise<EmailContentPreparationJob> {
    const previous = this.jobs.get(previousJobId)
    if (!previous) {
      throw new Error(`Preparation job not found: ${previousJobId}`)
    }

    const failedRecipientIds = new Set(
      previous.recipients
        .filter((recipient) => recipient.status === 'failed')
        .map((recipient) => recipient.guardianId),
    )
    const retryGuardians = input.guardians.filter((guardian) => failedRecipientIds.has(guardian.guardianId))

    return this.prepare({
      ...input,
      guardians: retryGuardians,
      retryOfJobId: previousJobId,
    })
  }
}

export const emailContentPreparationService = new EmailContentPreparationService()
