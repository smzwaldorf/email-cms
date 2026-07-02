import type { PreparationPinnedInputReferences } from '@/types/emailPreparation'

export type NewsletterEmailReaderJourneyStep =
  | 'write_newsletter'
  | 'publish_newsletter'
  | 'send_email'
  | 'collect_email_analytics'
  | 'process_article_click'
  | 'authenticate_user'
  | 'redirect_to_article'

export const NEWSLETTER_EMAIL_READER_JOURNEY_STEPS: NewsletterEmailReaderJourneyStep[] = [
  'write_newsletter',
  'publish_newsletter',
  'send_email',
  'collect_email_analytics',
  'process_article_click',
  'authenticate_user',
  'redirect_to_article',
]

/**
 * Cross-service handoff payload shared across publish/preparation/delivery/analytics/auth/reader.
 * This contract keeps delivery and analytics deterministic and auditable.
 */
export interface NewsletterJourneyHandoffPayload {
  newsletterId: string
  newsletterRevisionId: string
  articleId: string | null
  articleShortId: string | null
  journeyCorrelationId: string
  recipientFamilyId: string
  recipientParentId: string | null
  recipientParentEmail: string | null
  pinnedInputs: PreparationPinnedInputReferences
}
