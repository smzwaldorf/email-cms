export type PersonalizationRuleVersion = string

export type PersonalizationWarningCode =
  | 'missing_class_mapping'
  | 'inconsistent_membership'
  | 'unknown_target_class'
  | 'missing_template_value'

export interface PersonalizationInputClass {
  id: string
  classCode?: string | null
  className?: string | null
  canonicalSortKey?: string | null
}

export interface PersonalizationInputChild {
  studentId: string
  studentName?: string | null
  classId: string
}

export interface PersonalizationInputGuardian {
  guardianId: string
  guardianEmail: string
  firstName?: string | null
  lastName?: string | null
  parentType?: 'father' | 'mother' | 'guardian' | 'mixed' | null
  familyId?: string | null
  children: PersonalizationInputChild[]
}

export interface PersonalizationInputBlock {
  blockId: string
  title?: string | null
  content: string
  editorialOrder: number
  personalizationKey?: string | null
}

export interface PersonalizationClassBlock extends PersonalizationInputBlock {
  classId: string
}

export interface PersonalizationInputNewsletter {
  newsletterId: string
  newsletterRevisionId: string
  title?: string | null
  sharedBlocks: PersonalizationInputBlock[]
  classBlocks: PersonalizationClassBlock[]
}

import type { EmailTemplateBlock } from '@/types/emailTemplate'

export interface PersonalizationInputTemplate {
  templateId: string
  templateRevisionId: string
  subjectTemplate: string
  bodyTemplate: string
  /**
   * Pinned ordered block list snapshot for this template revision. When
   * non-empty, the composer renders per-recipient HTML by walking these
   * blocks. When omitted or empty, the composer falls back to the legacy
   * `subjectTemplate` / `bodyTemplate` render path.
   */
  blocks?: EmailTemplateBlock[]
}

export interface PersonalizationSnapshot {
  capturedAt: string
  guardians: PersonalizationInputGuardian[]
}

export interface PersonalizedEmailResolvedBlock {
  blockId: string
  title?: string | null
  content: string
  editorialOrder: number
  personalizationKey: string
  classId?: string
}

export interface PersonalizedEmailPayload {
  guardianId: string
  guardianEmail: string
  familyId?: string | null
  newsletterId: string
  newsletterRevisionId: string
  rules_version: PersonalizationRuleVersion
  input_fingerprint: string
  sharedBlocks: PersonalizedEmailResolvedBlock[]
  classBlocks: PersonalizedEmailResolvedBlock[]
  resolvedClassIds: string[]
  classFallback: 'none' | 'no_eligible_class_blocks'
  templateId?: string
  templateRevisionId?: string
  renderedSubject?: string
  renderedBody?: string
  /**
   * Stable fingerprint of `renderedBody` so a downstream service (e.g. the
   * Kit edge function) can verify the HTML it sends matches the HTML the
   * composer produced for this recipient. Computed when `renderedBody` is set.
   */
  renderedHtmlFingerprint?: string
}

export interface PersonalizationWarning {
  code: PersonalizationWarningCode
  guardianId: string
  message: string
  details?: Record<string, unknown>
}

export interface ComposePersonalizedEmailInput {
  rulesVersion: PersonalizationRuleVersion
  newsletter: PersonalizationInputNewsletter
  template?: PersonalizationInputTemplate
  classes: PersonalizationInputClass[]
  guardians: PersonalizationInputGuardian[]
  snapshotCapturedAt?: string
}

export interface ComposePersonalizedEmailResult {
  rulesVersion: PersonalizationRuleVersion
  snapshot: PersonalizationSnapshot
  payloads: PersonalizedEmailPayload[]
  warnings: PersonalizationWarning[]
}
