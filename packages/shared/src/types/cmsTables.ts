import type { SqlTables } from './sqlRows'
import type {
  NewsletterRow, ArticleRow, NewsletterArticleRow, ClassRow, UserRoleRow, FamilyRow,
  FamilyEnrollmentRow, StudentRow, ChildClassEnrollmentRow, TeacherClassAssignmentRow,
  ArticleAuditLogRow, EmailPlatformSubscriberMappingRow, EmailPlatformSyncJobRow,
  EmailPlatformWebhookEventRow, EmailPlatformSubscriptionAuditRow, NewsletterDeliveryBatchRow,
  NewsletterDeliveryBatchRecipientRow,
} from './database'

/** Existing CMS service row contracts; SQL-only tables retain generated column types. */
type ServiceRows = {
  newsletters: NewsletterRow
  articles: ArticleRow
  newsletter_articles: NewsletterArticleRow
  classes: ClassRow
  user_roles: UserRoleRow
  families: FamilyRow
  family_enrollment: FamilyEnrollmentRow
  students: StudentRow
  student_class_enrollment: ChildClassEnrollmentRow
  teacher_class_assignment: TeacherClassAssignmentRow
  article_audit_log: ArticleAuditLogRow
  email_platform_subscriber_mappings: EmailPlatformSubscriberMappingRow
  email_platform_sync_jobs: EmailPlatformSyncJobRow
  email_platform_webhook_events: EmailPlatformWebhookEventRow
  email_platform_subscription_audit: EmailPlatformSubscriptionAuditRow
  newsletter_delivery_batches: NewsletterDeliveryBatchRow
  newsletter_delivery_batch_recipients: NewsletterDeliveryBatchRecipientRow
}
export type CmsTableRows = Omit<SqlTables, keyof ServiceRows> & ServiceRows
