import { createClient, type SupabaseClient } from '@supabase/supabase-js'

let supabaseClient: SupabaseClient | null = null
let supabaseClientOverride: (() => SupabaseClient) | null = null

function requireEnv(key: string): string {
  const value = process.env[key]
  if (!value) {
    throw new Error(`Missing required backend environment variable: ${key}`)
  }
  return value
}

function createBackendSupabaseClient(): SupabaseClient {
  return createClient(
    requireEnv('VITE_SUPABASE_URL'),
    requireEnv('SUPABASE_SERVICE_ROLE_KEY'),
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    },
  )
}

export function configureSupabaseClientOverride(factory: (() => SupabaseClient) | null): void {
  supabaseClientOverride = factory
  supabaseClient = null
}

export function getSupabaseClient(): SupabaseClient {
  if (supabaseClientOverride) {
    return supabaseClientOverride()
  }

  if (!supabaseClient) {
    supabaseClient = createBackendSupabaseClient()
  }

  return supabaseClient
}

export function getSupabaseServiceClient(): SupabaseClient {
  return getSupabaseClient()
}

export function resetSupabaseClient(): void {
  supabaseClient = null
  supabaseClientOverride = null
}

export function table(tableName: string): ReturnType<SupabaseClient['from']> {
  return getSupabaseClient().from(tableName)
}

export type { SupabaseClient } from '@supabase/supabase-js'
export { createClient } from '@supabase/supabase-js'
