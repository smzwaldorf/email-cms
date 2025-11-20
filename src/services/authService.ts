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

  async signOut(): Promise<void> {
    const supabase = getSupabaseClient()

    try {
      console.log('🚪 Signing out user...')
      await supabase.auth.signOut()
      console.log('🚪 Supabase sign out complete')
      this.currentUser = null
      console.log('🚪 Current user cleared')
      this.notifyListeners(null)
      console.log('✅ Sign out successful, listeners notified')
    } catch (err) {
      console.error('❌ Sign out error:', err)
    }
  }

  private async setCurrentUser(userId: string): Promise<void> {
    const supabase = getSupabaseClient()

    try {
      console.log('👤 Fetching user role for userId:', userId)
      // Fetch user role from user_roles table
      const { data, error } = await supabase
        .from('user_roles')
        .select('*')
        .eq('id', userId)
        .single()

      if (error) {
        console.error('❌ Error fetching user role:', error)
        return
      }

      if (data) {
        console.log('✅ User role found:', data)
        const { data: session } = await supabase.auth.getSession()

        this.currentUser = {
          id: userId,
          email: data.email,
          role: data.role,
          displayName: data.email?.split('@')[0],
        }

        console.log('✅ Current user set:', this.currentUser)
        this.notifyListeners(this.currentUser)
      }
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
