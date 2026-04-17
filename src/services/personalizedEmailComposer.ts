import type {
  ComposePersonalizedEmailInput,
  ComposePersonalizedEmailResult,
  PersonalizationClassBlock,
  PersonalizationInputBlock,
  PersonalizationInputChild,
  PersonalizationInputClass,
  PersonalizationInputGuardian,
  PersonalizationWarning,
  PersonalizedEmailResolvedBlock,
} from '@/types/personalization'
import { renderEmailTemplatePreview } from '@/services/emailTemplateTokens'

const DEFAULT_RULES_VERSION = 'v1'

function toCanonicalString(value: string | null | undefined): string {
  return value?.trim() ?? ''
}

function dedupeStrings(values: string[]): string[] {
  return Array.from(new Set(values.filter((value) => value.length > 0)))
}

function compareBlockOrder(
  left: Pick<PersonalizationInputBlock, 'editorialOrder' | 'blockId'>,
  right: Pick<PersonalizationInputBlock, 'editorialOrder' | 'blockId'>,
): number {
  if (left.editorialOrder !== right.editorialOrder) {
    return left.editorialOrder - right.editorialOrder
  }

  return left.blockId.localeCompare(right.blockId)
}

function sortedSharedBlocks(blocks: PersonalizationInputBlock[]): PersonalizationInputBlock[] {
  return [...blocks].sort(compareBlockOrder)
}

function classSortValue(klass: PersonalizationInputClass): string {
  const canonical = toCanonicalString(klass.canonicalSortKey)
  if (canonical.length > 0) {
    return canonical
  }

  return klass.id
}

function sortClasses(classes: PersonalizationInputClass[]): PersonalizationInputClass[] {
  return [...classes].sort((left, right) => {
    const leftSort = classSortValue(left)
    const rightSort = classSortValue(right)
    const sortCompare = leftSort.localeCompare(rightSort)

    if (sortCompare !== 0) {
      return sortCompare
    }

    return left.id.localeCompare(right.id)
  })
}

function resolveBlockKey(block: PersonalizationInputBlock): string {
  const explicitKey = toCanonicalString(block.personalizationKey)
  if (explicitKey.length > 0) {
    return explicitKey
  }

  // Stable fallback key derived from source block identity.
  return `block:${block.blockId}`
}

function toResolvedBlock(
  block: PersonalizationInputBlock,
  key: string,
  classId?: string,
): PersonalizedEmailResolvedBlock {
  return {
    blockId: block.blockId,
    title: block.title,
    content: block.content,
    editorialOrder: block.editorialOrder,
    personalizationKey: key,
    classId,
  }
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function renderBlocksHtml(blocks: PersonalizedEmailResolvedBlock[]): string {
  if (blocks.length === 0) {
    return ''
  }
  return blocks
    .map((block) => {
      const titleHtml = block.title ? `<h2>${escapeHtml(block.title)}</h2>` : ''
      return `<section>${titleHtml}${block.content}</section>`
    })
    .join('\n')
}

function renderArticleSummaryHtml(blocks: PersonalizedEmailResolvedBlock[]): string {
  if (blocks.length === 0) {
    return ''
  }

  const items = blocks
    .map((block, index) => {
      const title = toCanonicalString(block.title) || `Article ${index + 1}`
      return `<li>${escapeHtml(title)}</li>`
    })
    .join('')

  return `<section><h2>Articles in this newsletter</h2><ul>${items}</ul></section>`
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

  return `p13n-${(hash >>> 0).toString(16).padStart(8, '0')}`
}

function captureSnapshot(
  guardians: PersonalizationInputGuardian[],
  capturedAt: string,
): ComposePersonalizedEmailResult['snapshot'] {
  return {
    capturedAt,
    guardians: guardians.map((guardian) => ({
      guardianId: guardian.guardianId,
      guardianEmail: guardian.guardianEmail,
      familyId: guardian.familyId ?? null,
      children: guardian.children.map((child) => ({
        studentId: child.studentId,
        studentName: child.studentName ?? null,
        classId: child.classId,
      })),
    })),
  }
}

function buildInputFingerprint(input: {
  rulesVersion: string
  newsletterId: string
  newsletterRevisionId: string
  guardianId: string
  children: PersonalizationInputChild[]
}): string {
  const canonical = stableStringify({
    rulesVersion: input.rulesVersion,
    newsletterId: input.newsletterId,
    newsletterRevisionId: input.newsletterRevisionId,
    guardianId: input.guardianId,
    memberships: [...input.children]
      .map((child) => ({
        studentId: child.studentId,
        classId: child.classId,
      }))
      .sort((left, right) => {
        const studentCompare = left.studentId.localeCompare(right.studentId)
        if (studentCompare !== 0) {
          return studentCompare
        }

        return left.classId.localeCompare(right.classId)
      }),
  })

  return hashString(canonical)
}

export function composePersonalizedEmails(
  input: ComposePersonalizedEmailInput,
): ComposePersonalizedEmailResult {
  const warnings: PersonalizationWarning[] = []
  const capturedAt = input.snapshotCapturedAt ?? new Date().toISOString()
  const rulesVersion = toCanonicalString(input.rulesVersion) || DEFAULT_RULES_VERSION
  const snapshot = captureSnapshot(input.guardians, capturedAt)
  const classesById = new Map(input.classes.map((klass) => [klass.id, klass]))
  const sharedBlocks = sortedSharedBlocks(input.newsletter.sharedBlocks)
  const payloads: ComposePersonalizedEmailResult['payloads'] = []

  for (const guardian of snapshot.guardians) {
    const classIdsFromChildren = dedupeStrings(
      guardian.children.map((child) => toCanonicalString(child.classId)),
    )
    const resolvedClasses = classIdsFromChildren
      .map((classId) => classesById.get(classId))
      .filter((klass): klass is PersonalizationInputClass => klass != null)
    const missingClassIds = classIdsFromChildren.filter((classId) => !classesById.has(classId))
    const invalidChildren = guardian.children.filter(
      (child) => toCanonicalString(child.classId).length === 0,
    )

    for (const classId of missingClassIds) {
      warnings.push({
        code: 'missing_class_mapping',
        guardianId: guardian.guardianId,
        message: `Class mapping is missing for class '${classId}'.`,
        details: { classId },
      })
    }

    if (invalidChildren.length > 0) {
      warnings.push({
        code: 'inconsistent_membership',
        guardianId: guardian.guardianId,
        message: 'One or more child membership rows are missing class identifiers.',
        details: {
          studentIds: invalidChildren.map((child) => child.studentId),
        },
      })
    }

    const canonicalClasses = sortClasses(resolvedClasses)
    const eligibleClassIds = canonicalClasses.map((klass) => klass.id)
    const classBlockGroups = new Map<string, PersonalizationClassBlock[]>()

    for (const classId of eligibleClassIds) {
      classBlockGroups.set(classId, [])
    }

    for (const block of input.newsletter.classBlocks) {
      if (toCanonicalString(block.classId).length === 0) {
        warnings.push({
          code: 'unknown_target_class',
          guardianId: guardian.guardianId,
          message: `Class block '${block.blockId}' is missing a target class.`,
          details: { blockId: block.blockId },
        })
        continue
      }

      if (!classesById.has(block.classId)) {
        warnings.push({
          code: 'unknown_target_class',
          guardianId: guardian.guardianId,
          message: `Class block '${block.blockId}' targets unknown class '${block.classId}'.`,
          details: { blockId: block.blockId, classId: block.classId },
        })
        continue
      }

      const classBlocks = classBlockGroups.get(block.classId)
      if (classBlocks) {
        classBlocks.push(block)
      }
    }

    const resolvedClassBlocks: PersonalizedEmailResolvedBlock[] = []
    const seenClassKeys = new Set<string>()

    for (const classId of eligibleClassIds) {
      const classBlocks = [...(classBlockGroups.get(classId) ?? [])].sort(compareBlockOrder)
      for (const block of classBlocks) {
        const key = resolveBlockKey(block)
        if (seenClassKeys.has(key)) {
          continue
        }

        seenClassKeys.add(key)
        resolvedClassBlocks.push(toResolvedBlock(block, key, classId))
      }
    }

    const fallback = resolvedClassBlocks.length === 0 ? 'no_eligible_class_blocks' : 'none'
    const resolvedSharedBlocks = sharedBlocks.map((block) =>
      toResolvedBlock(block, resolveBlockKey(block)),
    )
    let renderedSubject: string | undefined
    let renderedBody: string | undefined
    let templateId: string | undefined
    let templateRevisionId: string | undefined

    if (input.template) {
      const preview = renderEmailTemplatePreview(
        input.template.subjectTemplate,
        input.template.bodyTemplate,
        {
          guardian: {
            id: guardian.guardianId,
            email: guardian.guardianEmail,
          },
          family: {
            id: guardian.familyId ?? null,
          },
          newsletter: {
            id: input.newsletter.newsletterId,
            revisionId: input.newsletter.newsletterRevisionId,
          },
          classes: {
            ids: eligibleClassIds,
          },
        },
      )
      renderedSubject = preview.subject
      renderedBody = preview.body
      templateId = input.template.templateId
      templateRevisionId = input.template.templateRevisionId

      for (const warning of preview.warnings) {
        warnings.push({
          code: 'missing_template_value',
          guardianId: guardian.guardianId,
          message: warning.message,
          details: {
            token: warning.token,
            field: warning.field,
            templateId,
            templateRevisionId,
          },
        })
      }
    }

    const orderedNewsletterBlocks = [...resolvedSharedBlocks, ...resolvedClassBlocks].sort(compareBlockOrder)
    const newsletterSummaryHtml = renderArticleSummaryHtml(orderedNewsletterBlocks)
    const newsletterContentHtml = renderBlocksHtml(orderedNewsletterBlocks)
    const composedNewsletterHtml = [newsletterSummaryHtml, newsletterContentHtml].filter(Boolean).join('\n')
    const baseBody = toCanonicalString(renderedBody)
    if (composedNewsletterHtml) {
      renderedBody = baseBody
        ? `${baseBody}\n<hr />\n${composedNewsletterHtml}`
        : composedNewsletterHtml
    }
    const fallbackTitle = toCanonicalString(input.newsletter.title) || `Newsletter ${input.newsletter.newsletterId}`
    if (!toCanonicalString(renderedSubject)) {
      renderedSubject = fallbackTitle
    }

    payloads.push({
      guardianId: guardian.guardianId,
      guardianEmail: guardian.guardianEmail,
      familyId: guardian.familyId ?? null,
      newsletterId: input.newsletter.newsletterId,
      newsletterRevisionId: input.newsletter.newsletterRevisionId,
      rules_version: rulesVersion,
      input_fingerprint: buildInputFingerprint({
        rulesVersion,
        newsletterId: input.newsletter.newsletterId,
        newsletterRevisionId: input.newsletter.newsletterRevisionId,
        guardianId: guardian.guardianId,
        children: guardian.children,
      }),
      sharedBlocks: resolvedSharedBlocks,
      classBlocks: resolvedClassBlocks,
      resolvedClassIds: eligibleClassIds,
      classFallback: fallback,
      templateId,
      templateRevisionId,
      renderedSubject,
      renderedBody,
    })
  }

  return {
    rulesVersion,
    snapshot,
    payloads,
    warnings,
  }
}
