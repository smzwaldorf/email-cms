/**
 * Supabase Client Factory
 * Initializes and provides singleton Supabase client instance
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js'

/**
 * Validate that required environment variables are set
 */
function validateEnvironment(): void {
  const url = import.meta.env.VITE_SUPABASE_URL
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY

  if (!url) {
    throw new Error(
      'Missing VITE_SUPABASE_URL environment variable. ' +
      'Please ensure it is set in .env.local. ' +
      'See SETUP.md for configuration instructions.',
    )
  }

  if (!key) {
    throw new Error(
      'Missing VITE_SUPABASE_ANON_KEY environment variable. ' +
      'Please ensure it is set in .env.local. ' +
      'See SETUP.md for configuration instructions.',
    )
  }
}

/**
 * Create and configure Supabase client
 */
function createSupabaseClient(): SupabaseClient {
  validateEnvironment()

  const url = import.meta.env.VITE_SUPABASE_URL
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY

  const client = createClient(url, key, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      // Explicitly use PKCE flow for OAuth (required for Google sign-in)
      flowType: 'pkce',
      // Ensure localStorage is used for storing PKCE code verifier
      storage: typeof window !== 'undefined' ? window.localStorage : undefined,
      // Detect session from URL on page load (important for OAuth callbacks)
      detectSessionInUrl: true,
      // Storage key for session data
      storageKey: 'supabase.auth.token',
    },
    global: {
      headers: {
        // Optional: Add custom headers for debugging or tracking
        // 'X-App-Name': import.meta.env.VITE_APP_NAME || 'Email CMS',
      },
    },
  })

  // Log successful initialization in development
  if (import.meta.env.DEV) {
    console.log('✅ Supabase client initialized successfully')
    console.log(`   Project URL: ${url}`)
  }

  return client
}

/**
 * Singleton Supabase client instance
 * Initialize lazily on first access
 */
/**
 * Singleton Supabase client instance
 * Initialize lazily on first access
 */
let supabaseClient: SupabaseClient | null = null
let supabaseServiceClient: SupabaseClient | null = null

/**
 * Get the singleton Supabase client instance
 * Initializes on first call
 */
export function getSupabaseClient(): SupabaseClient {
  if (!supabaseClient) {
    try {
      supabaseClient = createSupabaseClient()
    } catch (error) {
      console.error('Failed to initialize Supabase client:', error)
      throw error
    }
  }
  return supabaseClient
}

/**
 * Get Supabase client with service role key for admin operations
 * WARNING: Only use this for admin operations that require elevated privileges
 */
export function getSupabaseServiceClient(): SupabaseClient {
  if (!supabaseServiceClient) {
    validateEnvironment()

    const url = import.meta.env.VITE_SUPABASE_URL
    const serviceKey = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY

    if (!serviceKey) {
      throw new Error(
        'Missing VITE_SUPABASE_SERVICE_ROLE_KEY environment variable. ' +
        'This is required for admin operations.'
      )
    }

    supabaseServiceClient = createClient(url, serviceKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    })
  }

  return supabaseServiceClient
}

/**
 * Reset the Supabase client (useful for testing)
 */
export function resetSupabaseClient(): void {
  supabaseClient = null
  supabaseServiceClient = null
}

/**
 * Type-safe database table accessor
 * Provides autocomplete for available tables
 */
export interface DatabaseTables {
  newsletter_weeks: any
  articles: any
  classes: any
  user_roles: any
  families: any
  family_enrollment: any
  child_class_enrollment: any
  teacher_class_assignment: any
  article_audit_log: any
}

/**
 * Helper function to access a specific table with type safety
 */
export function table<T extends keyof DatabaseTables>(
  tableName: T,
): ReturnType<SupabaseClient['from']> {
  return getSupabaseClient().from(tableName)
}

/**
 * Re-export Supabase types for convenience
 */
export type { SupabaseClient } from '@supabase/supabase-js'
export { createClient } from '@supabase/supabase-js'
