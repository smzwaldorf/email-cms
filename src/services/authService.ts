/**
 * Authentication Service
 * Handles user authentication with Supabase
 * Supports email/password login and session management
 */

import { getSupabaseClient } from '@/lib/supabase'
import type { AuthSession } from '@supabase/supabase-js'

export interface AuthUser {
  id: string
  email: string
  role: 'viewer' | 'editor' | 'admin' | 'parent' | 'teacher' | 'student'
  displayName?: string
}

export interface AuthServiceInterface {
  signIn(email: string, password: string): Promise<AuthUser | null>
  signInWithGoogle(): Promise<AuthUser | null>
  sendMagicLink(email: string): Promise<boolean>
  verifyMagicLink(token: string): Promise<AuthUser | null>
  signOut(): Promise<void>
  getCurrentUser(): AuthUser | null
  isAuthenticated(): boolean
  onAuthStateChange(callback: (user: AuthUser | null) => void): () => void
  getSession(): Promise<AuthSession | null>
  initialize(): Promise<void>
  ensureInitialized(): Promise<void>
}

class SupabaseAuthService implements AuthServiceInterface {
  private currentUser: AuthUser | null = null
  private authStateListeners: Array<(user: AuthUser | null) => void> = []
  private initialized = false
  private initializationPromise: Promise<void> | null = null

  async initialize(): Promise<void> {
    // Prevent multiple simultaneous initializations
    if (this.initializationPromise) {
      return this.initializationPromise
    }

    if (this.initialized) {
      return
    }

    this.initializationPromise = (async () => {
      const supabase = getSupabaseClient()

      // Check for existing session
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (session?.user) {
        await this.setCurrentUser(session.user.id)
      }

      // Listen for auth state changes
      supabase.auth.onAuthStateChange(async (_event, session) => {
        if (session?.user) {
          await this.setCurrentUser(session.user.id)
        } else {
          this.currentUser = null
          this.notifyListeners(null)
        }
      })

      this.initialized = true
    })()

    return this.initializationPromise
  }

  async ensureInitialized(): Promise<void> {
    return this.initialize()
  }

  async signIn(email: string, password: string): Promise<AuthUser | null> {
    const supabase = getSupabaseClient()

    try {
      console.log('🔐 Attempting to sign in with email:', email)
      console.log('Using Supabase client from:', import.meta.env.VITE_SUPABASE_URL)

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      console.log('📦 Full response - Data:', data)
      console.log('📦 Full response - Error:', error)

      if (error) {
        console.error('❌ Sign in error detected')
        console.error('  Message:', error.message)
        console.error('  Status:', error.status)
        console.error('  Code:', error.code)
        console.error('  Full error:', JSON.stringify(error))
        return null
      }

      const userId = data.user?.id
      console.log('✅ Sign in successful, user ID:', userId)

      if (userId) {
        console.log('👤 Calling setCurrentUser with ID:', userId)
        await this.setCurrentUser(userId)
        console.log('✅ Current user is now:', this.currentUser)
        return this.currentUser
      }

      console.warn('⚠️ No user ID returned from auth response')
      console.warn('Data object structure:', Object.keys(data || {}))
      return null
    } catch (err) {
      console.error('❌ Sign in exception caught')
      console.error('  Error:', err)
      console.error('  Type:', typeof err)
      console.error('  Message:', (err as any).message)
      return null
    }
  }

  async signInWithGoogle(): Promise<AuthUser | null> {
    const supabase = getSupabaseClient()

    try {
      console.log('🔐 Attempting to sign in with Google OAuth...')

      // Initiate OAuth flow with Google
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      })

      if (error) {
        console.error('❌ Google OAuth error:', error)
        return null
      }

      console.log('✅ Google OAuth flow initiated, redirecting...')
      // OAuth will redirect, so we don't return a user here
      return null
    } catch (err) {
      console.error('❌ Google sign-in exception:', err)
      return null
    }
  }

  async sendMagicLink(email: string): Promise<boolean> {
    const supabase = getSupabaseClient()

    try {
      console.log('📧 Sending magic link to:', email)

      // Use Supabase's built-in magic link functionality
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      })

      if (error) {
        console.error('❌ Magic link send error:', error)
        return false
      }

      console.log('✅ Magic link sent successfully')
      return true
    } catch (err) {
      console.error('❌ Magic link exception:', err)
      return false
    }
  }

  async verifyMagicLink(token: string): Promise<AuthUser | null> {
    const supabase = getSupabaseClient()

    try {
      console.log('🔗 Verifying magic link token...')

      // Verify the OTP token
      const { data, error } = await supabase.auth.verifyOtp({
        token_hash: token,
        type: 'email',
      })

      if (error) {
        console.error('❌ Magic link verification error:', error)
        return null
      }

      if (data.user?.id) {
        console.log('✅ Magic link verified, setting current user')
        await this.setCurrentUser(data.user.id)
        return this.currentUser
      }

      return null
    } catch (err) {
      console.error('❌ Magic link verification exception:', err)
      return null
    }
  }

  async signOut(): Promise<void> {
    const supabase = getSupabaseClient()

    try {
      console.log('🚪 Signing out user...')

      // Clear the current user FIRST - this is important for immediate UI update
      this.currentUser = null
      console.log('🚪 Current user cleared locally')

      // Notify listeners immediately so UI updates right away
      this.notifyListeners(null)
      console.log('🚪 Listeners notified of sign-out')

      // Then call Supabase sign out (may take a moment)
      try {
        const { error } = await supabase.auth.signOut()
        if (error) {
          console.warn('⚠️ Supabase sign out warning:', error.message)
        } else {
          console.log('✅ Supabase sign out complete')
        }
      } catch (supabaseErr) {
        console.warn('⚠️ Supabase sign out exception:', supabaseErr)
        // User is already logged out locally, so continue
      }

      console.log('✅ Sign out successful, user should be redirected')
    } catch (err) {
      console.error('❌ Sign out error:', err)
      // Ensure cleanup even on error
      this.currentUser = null
      this.notifyListeners(null)
    }
  }

  private async setCurrentUser(userId: string): Promise<void> {
    const supabase = getSupabaseClient()

    try {
      console.log('👤 Fetching user role for userId:', userId)

      // Get the session to access email
      const { data: sessionData } = await supabase.auth.getSession()
      const email = sessionData?.session?.user?.email

      if (!email) {
        console.warn('⚠️ No email found in session')
        return
      }

      // Try to fetch user role from user_roles table
      const { data, error } = await supabase
        .from('user_roles')
        .select('*')
        .eq('id', userId)
        .maybeSingle()  // Changed from .single() to handle missing users gracefully

      if (error) {
        console.error('⚠️ Error fetching user role (will use defaults):', error.message)
      }

      // Set current user with data from table OR defaults from auth session
      this.currentUser = {
        id: userId,
        email: email,
        role: (data?.role as any) || 'viewer',  // Default to 'viewer' if not in table
        displayName: data?.display_name || email.split('@')[0],
      }

      console.log('✅ Current user set:', this.currentUser)
      this.notifyListeners(this.currentUser)
    } catch (err) {
      console.error('❌ Error setting current user:', err)
    }
  }

  getCurrentUser(): AuthUser | null {
    return this.currentUser
  }

  isAuthenticated(): boolean {
    return this.currentUser !== null
  }

  onAuthStateChange(callback: (user: AuthUser | null) => void): () => void {
    this.authStateListeners.push(callback)

    // Return unsubscribe function
    return () => {
      this.authStateListeners = this.authStateListeners.filter((cb) => cb !== callback)
    }
  }

  private notifyListeners(user: AuthUser | null): void {
    this.authStateListeners.forEach((callback) => {
      callback(user)
    })
  }

  async getSession() {
    const supabase = getSupabaseClient()
    const { data } = await supabase.auth.getSession()
    return data.session
  }
}

// Singleton instance
const authService = new SupabaseAuthService()

// Initialize on import
console.log('🔐 Initializing AuthService...')
authService.initialize().catch((err) => {
  console.error('❌ Failed to initialize auth service:', err)
})
console.log('✅ AuthService initialized')

export { authService }
export default authService
