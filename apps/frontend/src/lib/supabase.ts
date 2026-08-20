import { from, type HttpQueryBuilder } from '@/lib/dataQuery'
import { getAccessTokenOrNull, getStoredAuthUser, setAccessToken, setStoredAuthUser } from '@/services/backendClient'
import type {
  ArticleAuditLogRow,
  ArticleRow,
  ChildClassEnrollmentRow,
  ClassRow,
  EmailPlatformSubscriberMappingRow,
  EmailPlatformSubscriptionAuditRow,
  EmailPlatformSyncJobRow,
  EmailPlatformWebhookEventRow,
  FamilyEnrollmentRow,
  FamilyRow,
  NewsletterDeliveryBatchRecipientRow,
  NewsletterDeliveryBatchRow,
  NewsletterArticleRow,
  NewsletterRow,
  StudentRow,
  TeacherClassAssignmentRow,
  UserRoleRow,
} from '@/types/database'

type UntypedTableRow = Record<string, unknown>

export interface AuthUser {
  id: string
  email: string | null
}

export interface AuthSession {
  access_token: string
  refresh_token?: string
  expires_in?: number
  user: AuthUser
}

export interface PostgrestError {
  message: string
  code?: string
}

function authNotMigrated(): never {
  throw new Error('Auth is not migrated yet. OCID will replace Supabase Auth.')
}

const storageStub = {
  from(_bucket: string) {
    return {
      async upload(..._args: unknown[]) {
        return { data: null, error: { message: 'Storage is not using Supabase. Use the mock/local provider.' } }
      },
      async download(..._args: unknown[]) {
        return { data: null as Blob | null, error: { message: 'Storage is not using Supabase.' } }
      },
      async remove(..._args: unknown[]) {
        return { data: null, error: { message: 'Storage is not using Supabase.' } }
      },
      async list(..._args: unknown[]) {
        return {
          data: [] as Array<{ name: string; metadata?: { size?: number }; created_at?: string; updated_at?: string }>,
          error: null,
        }
      },
      async createSignedUrl(..._args: unknown[]) {
        return { data: { signedUrl: '' }, error: { message: 'Storage is not using Supabase.' } }
      },
      getPublicUrl(path: string) {
        return { data: { publicUrl: path } }
      },
    }
  },
}

export interface PostgresClient {
  from: {
    <T extends keyof DatabaseTables>(tableName: T): HttpQueryBuilder<DatabaseTables[T]>
    <T = Record<string, unknown>>(tableName: string): HttpQueryBuilder<T>
  }
  auth: {
    getSession(): Promise<{ data: { session: AuthSession | null }; error: null }>
    getUser(): Promise<{ data: { user: AuthUser | null }; error: { message: string } | null }>
    refreshSession(): Promise<{ data: { session: AuthSession | null }; error: { message: string } }>
    signInWithPassword(_input: unknown): Promise<{ data: { user: AuthUser | null }; error: { message: string } }>
    signInWithOAuth(_input: unknown): Promise<{ data: unknown; error: { message: string } }>
    signInWithOtp(_input: unknown): Promise<{ data: unknown; error: { message: string } }>
    verifyOtp(_input: unknown): Promise<{ data: { user: AuthUser | null }; error: { message: string } }>
    signOut(): Promise<{ error: null }>
    onAuthStateChange(_callback: (event: string, session: AuthSession | null) => void): {
      data: { subscription: { unsubscribe: () => void } }
    }
  }
  storage: typeof storageStub
  channel(_name: string): {
    on(..._args: unknown[]): {
      on(..._args: unknown[]): unknown
      subscribe(): { unsubscribe(): void }
    }
    subscribe(): { unsubscribe(): void }
    unsubscribe(): void
  }
  rpc(_fn: string, _args?: unknown): Promise<{ data: null; error: { message: string } }>
}

function createClient(..._args: unknown[]): PostgresClient {
  return {
    from,
    auth: {
      async getSession() {
        const token = getAccessTokenOrNull()
        const user = getStoredAuthUser()
        if (!token || !user) return { data: { session: null }, error: null }
        return {
          data: {
            session: {
              access_token: token,
              user,
            },
          },
          error: null,
        }
      },
      async getUser() {
        const token = getAccessTokenOrNull()
        const user = getStoredAuthUser()
        if (!token || !user) return { data: { user: null }, error: { message: 'Not authenticated' } }
        return { data: { user }, error: null }
      },
      async refreshSession() {
        return authNotMigrated()
      },
      async signInWithPassword() {
        return authNotMigrated()
      },
      async signInWithOAuth() {
        return authNotMigrated()
      },
      async signInWithOtp() {
        return authNotMigrated()
      },
      async verifyOtp() {
        return authNotMigrated()
      },
      async signOut() {
        setAccessToken(null)
        setStoredAuthUser(null)
        return { error: null }
      },
      onAuthStateChange() {
        return { data: { subscription: { unsubscribe() {} } } }
      },
    },
    storage: storageStub,
    channel() {
      const subscription = { unsubscribe() {} }
      const chain = {
        on(..._args: unknown[]) {
          return chain
        },
        subscribe: () => subscription,
        unsubscribe() {},
      }
      return chain
    },
    async rpc() {
      return { data: null, error: { message: 'Database RPCs that depended on Supabase Auth were removed.' } }
    },
  }
}

export type SupabaseClient = PostgresClient

let client: PostgresClient | null = null

export function getSupabaseClient(): PostgresClient {
  if (!client) client = createClient()
  return client
}

export function resetSupabaseClient(): void {
  client = null
}

export interface DatabaseTables {
  newsletters: NewsletterRow
  articles: ArticleRow
  newsletter_articles: NewsletterArticleRow
  classes: ClassRow
  user_roles: UserRoleRow
  families: FamilyRow
  family_enrollment: FamilyEnrollmentRow
  students: StudentRow
  student_class_enrollment: ChildClassEnrollmentRow
  child_class_enrollment: ChildClassEnrollmentRow
  teacher_class_assignment: TeacherClassAssignmentRow
  article_audit_log: ArticleAuditLogRow
  auth_events: UntypedTableRow
  analytics_events: UntypedTableRow
  analytics_snapshots: UntypedTableRow
  media_files: UntypedTableRow
  media_usage: UntypedTableRow
  media_variants: UntypedTableRow
  media_deletion_audit: UntypedTableRow
  article_media_references: UntypedTableRow
  tracking_tokens: UntypedTableRow
  user_role_assignments: UntypedTableRow
  permission_mutation_audit_log: UntypedTableRow
  authorization_decision_trace: UntypedTableRow
  email_platform_subscriber_mappings: EmailPlatformSubscriberMappingRow
  email_platform_sync_jobs: EmailPlatformSyncJobRow
  email_platform_webhook_events: EmailPlatformWebhookEventRow
  email_platform_subscription_audit: EmailPlatformSubscriptionAuditRow
  newsletter_delivery_batches: NewsletterDeliveryBatchRow
  newsletter_delivery_batch_recipients: NewsletterDeliveryBatchRecipientRow
}

export function table<T extends keyof DatabaseTables>(
  tableName: T,
): HttpQueryBuilder<DatabaseTables[T]> {
  return getSupabaseClient().from(tableName)
}

export { createClient }
