import {
  EmailPlatformRecipientPayload,
  EmailPlatformRecipientRecord,
  NewsletterSubscriptionStatus,
  ParentType,
} from '../../types/emailPlatform.ts'
import type { KitNewsletterMergeFieldKeys } from '../../types/kitMergeProperties.ts'

const STABLE_CUSTOM_FIELD_KEYS = {
  externalIdentityKey: 'external_identity_key',
  childClasses: 'child_classes',
  childNames: 'child_names',
  parentType: 'parent_type',
} as const

function normalizeUnique(values: string[]): string[] {
  return Array.from(
    new Set(
      values
        .map((value) => value.trim())
        .filter(Boolean),
    ),
  ).sort((left, right) => left.localeCompare(right))
}

function deriveParentType(relationships: string[]): ParentType {
  const normalizedRelationships = normalizeUnique(
    relationships.map((relationship) => relationship.toLowerCase()),
  )
  const parentTypes = normalizedRelationships.filter((relationship): relationship is Exclude<ParentType, 'mixed'> =>
    relationship === 'father' || relationship === 'mother' || relationship === 'guardian',
  )

  if (parentTypes.length === 0) {
    return 'guardian'
  }

  if (parentTypes.length === 1) {
    return parentTypes[0]
  }

  return 'mixed'
}

function deriveSubscriberState(
  subscriptionStatus: NewsletterSubscriptionStatus,
): EmailPlatformRecipientPayload['state'] {
  switch (subscriptionStatus) {
    case 'unsubscribed':
      return 'cancelled'
    case 'bounced':
      return 'bounced'
    case 'complained':
      return 'complained'
    default:
      return 'active'
  }
}

function deriveFirstName(familyName: string | null | undefined): string | undefined {
  const trimmedFamilyName = familyName?.trim()
  return trimmedFamilyName ? trimmedFamilyName : undefined
}

export function normalizeKitFieldSegment(value: string): string {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/_{2,}/g, '_')

  return normalized || 'unknown'
}

export function buildNewsletterMergeFieldNamespace(input: {
  deliveryBatchId?: string | null
  campaignId?: string | null
  newsletterId: string
}): string {
  const source = input.deliveryBatchId ?? input.campaignId ?? input.newsletterId
  return `newsletter_${normalizeKitFieldSegment(source)}`
}

export function buildNewsletterMergeFieldKeys(input: {
  deliveryBatchId?: string | null
  campaignId?: string | null
  newsletterId: string
}): KitNewsletterMergeFieldKeys {
  const namespace = buildNewsletterMergeFieldNamespace(input)

  return {
    classArticleExcerpts: `${namespace}_class_article_excerpts`,
    classArticleCount: `${namespace}_class_article_count`,
    payloadFingerprint: `${namespace}_payload_fingerprint`,
  }
}

export function mapRecipientToKitPayload(
  recipient: EmailPlatformRecipientRecord,
  options: { classTagPrefix: string },
): EmailPlatformRecipientPayload {
  const childClasses = normalizeUnique(recipient.children.map((child) => child.className))
  const childNames = normalizeUnique(recipient.children.map((child) => child.name))
  const classTagNames = normalizeUnique(
    recipient.children.map((child) => `${options.classTagPrefix}${child.classCode}`),
  )
  const familyTagName = `family:${recipient.familyId}`
  const parentType = deriveParentType(recipient.parentRelationships)

  return {
    externalIdentityKey: `family:${recipient.familyId}`,
    emailAddress: (recipient.primaryEmail ?? '').trim().toLowerCase(),
    firstName: deriveFirstName(recipient.familyName),
    state: deriveSubscriberState(recipient.subscriptionStatus),
    parentType,
    childClasses,
    childNames,
    customFields: {
      [STABLE_CUSTOM_FIELD_KEYS.externalIdentityKey]: `family:${recipient.familyId}`,
      [STABLE_CUSTOM_FIELD_KEYS.childClasses]: childClasses.join(', '),
      [STABLE_CUSTOM_FIELD_KEYS.childNames]: childNames.join(', '),
      [STABLE_CUSTOM_FIELD_KEYS.parentType]: parentType,
    },
    tagNames: normalizeUnique([familyTagName, ...classTagNames]),
  }
}
