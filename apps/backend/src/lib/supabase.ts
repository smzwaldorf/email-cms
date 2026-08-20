import { query } from '#/lib/db'
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
  throw new Error('Auth is not migrated yet. OCID will replace Supabase Auth.')
}

export interface PostgresClient {
  from: <T = unknown>(tableName: string) => QueryBuilder<T>
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

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

async function getUserByDevToken(token?: string): Promise<{
  data: { user: AuthUser | null }
  error: { message: string } | null
}> {
  if (!token) {
    return { data: { user: null }, error: { message: 'Missing bearer token' } }
  }
  // Auth/OCID is not migrated yet. Accept a user_roles.id UUID as a temporary identity.
  if (!UUID_RE.test(token)) {
    return { data: { user: null }, error: { message: 'Invalid bearer token' } }
  }
  const result = await query<{ id: string; email: string | null }>(
    'SELECT id, email FROM user_roles WHERE id = $1',
    [token],
  )
  const row = result.rows[0]
  if (!row) {
    return { data: { user: null }, error: { message: 'Invalid bearer token' } }
  }
  return { data: { user: { id: row.id, email: row.email } }, error: null }
}

function createPostgresClient(): PostgresClient {
  return {
    from,
    auth: {
      getUser: getUserByDevToken,
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

export function table<T = unknown>(tableName: string): QueryBuilder<T> {
  return getSupabaseClient().from<T>(tableName)
}

export function createClient(..._args: unknown[]): PostgresClient {
  return createPostgresClient()
}
