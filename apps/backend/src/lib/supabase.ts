import type { UserRoleRow } from '#/types/database'
import type { CmsTableRows as SqlTables } from '@email-cms/shared'
import { viewerForToken } from '#/auth'
import { from, type QueryBuilder, type QueryError } from '#/lib/query'

export type PostgrestError = QueryError

export interface AuthSession {
  access_token: string
  refresh_token?: string
  expires_in?: number
  expires_at?: number
  user: AuthUser
}

export interface AuthUser {
  id: string
  email: string | null
}

function authNotMigrated(): never {
  throw new Error('Authentication is owned by SMZ Auth; use the central OIDC workflow.')
}

export interface PostgresClient {
  rpc<T = UserRoleRow>(name: string, args?: unknown): Promise<{ data: T; error: null } | { data: null; error: QueryError }>
  from: {
    <N extends keyof SqlTables>(tableName: N): QueryBuilder<SqlTables[N]>
    <T = unknown>(tableName: string): QueryBuilder<T>
  }
  auth: {
    getUser(token?: string): Promise<{
      data: { user: AuthUser | null }
      error: { message: string } | null
    }>
    getSession(): Promise<{ data: { session: AuthSession | null }; error: { message: string } | null }>
    refreshSession(): Promise<{ data: { session: AuthSession | null }; error: { message: string } | null }>
    signInWithPassword(_input: unknown): Promise<{ data: { session: AuthSession | null }; error: { message: string } | null }>
    signInWithOAuth(_input: unknown): Promise<{ data: unknown; error: { message: string } | null }>
    signInWithOtp(_input: unknown): Promise<{ data: unknown; error: { message: string } | null }>
    verifyOtp(_input: unknown): Promise<{ data: { session: AuthSession | null }; error: { message: string } | null }>
    signOut(): Promise<{ error: { message: string } | null }>
    onAuthStateChange(_callback: (event: string, session: AuthSession | null) => void): { data: { subscription: { unsubscribe: () => void } } }
  }
}

export type SupabaseClient = PostgresClient

let client: PostgresClient | null = null
let clientOverride: (() => PostgresClient) | null = null

async function getCentralUser(token?: string): Promise<{
  data: { user: AuthUser | null }; error: { message: string } | null
}> {
  if (!token) return { data: { user: null }, error: { message: 'Missing bearer token' } }
  try {
    const viewer = await viewerForToken(token)
    return { data: { user: { id: viewer.id, email: viewer.email } }, error: null }
  } catch {
    return { data: { user: null }, error: { message: 'Central identity verification failed' } }
  }
}

function createPostgresClient(): PostgresClient {
  return {
    from,
    async rpc() { return { data: null, error: { message: 'Legacy identity RPCs are disabled; identity is owned by SMZ Auth.' } } },
    auth: {
      getUser: getCentralUser,
      getSession: async () => ({ data: { session: null }, error: null }),
      refreshSession: async () => authNotMigrated(),
      signInWithPassword: async () => authNotMigrated(),
      signInWithOAuth: async () => authNotMigrated(),
      signInWithOtp: async () => authNotMigrated(),
      verifyOtp: async () => authNotMigrated(),
      signOut: async () => authNotMigrated(),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
    },
  }
}

export function configureSupabaseClientOverride(factory: (() => PostgresClient) | null): void {
  clientOverride = factory
  client = null
}

export function getSupabaseClient(): PostgresClient {
  if (clientOverride) {
    return clientOverride()
  }
  if (!client) {
    client = createPostgresClient()
  }
  return client
}

export function getSupabaseServiceClient(): PostgresClient {
  return getSupabaseClient()
}

export function resetSupabaseClient(): void {
  client = null
  clientOverride = null
}

export function table<N extends keyof SqlTables>(tableName: N): QueryBuilder<SqlTables[N]>
export function table<T = unknown>(tableName: string): QueryBuilder<T>
export function table<T = unknown>(tableName: string): QueryBuilder<T> {
  return getSupabaseClient().from<T>(tableName)
}

export function createClient(..._args: unknown[]): PostgresClient {
  return createPostgresClient()
}
