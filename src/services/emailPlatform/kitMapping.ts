import {
  EmailPlatformRecipientPayload,
  EmailPlatformRecipientRecord,
  NewsletterSubscriptionStatus,
  ParentType,
} from '../../types/emailPlatform.ts'

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
  _subscriptionStatus: NewsletterSubscriptionStatus,
): EmailPlatformRecipientPayload['state'] {
  // Enforce active state for all CMS-driven subscriber upserts.
  return 'active'
}

function deriveFirstName(familyName: string | null | undefined): string | undefined {
  const trimmedFamilyName = familyName?.trim()
  return trimmedFamilyName ? trimmedFamilyName : undefined
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
      external_identity_key: `family:${recipient.familyId}`,
      child_classes: childClasses.join(', '),
      child_names: childNames.join(', '),
      parent_type: parentType,
    },
    tagNames: normalizeUnique([familyTagName, ...classTagNames]),
  }
}
