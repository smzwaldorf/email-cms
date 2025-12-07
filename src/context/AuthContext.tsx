/**
 * Authentication Context
 * Provides auth state and methods to the entire application
 * Usage: Wrap your app with <AuthProvider> and use useAuth() hook
 */

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { authService } from '@/services/authService'
import { tokenManager } from '@/services/tokenManager'
import { getSupabaseClient } from '@/lib/supabase'
import { clearPermissionCache } from '@/services/PermissionService'
import type { AuthUser } from '@/types/auth'
import type { RealtimePostgresInsertPayload } from '@supabase/supabase-js'

export interface AuthContextType {
  user: AuthUser | null
  isAuthenticated: boolean
  isLoading: boolean
  signIn: (email: string, password: string) => Promise<boolean>
  signInWithGoogle: () => Promise<void>
  sendMagicLink: (email: string, redirectTo?: string) => Promise<boolean>
  verifyMagicLink: (token: string) => Promise<boolean>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export interface AuthProviderProps {
  children: ReactNode
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Initialize auth state on mount
  useEffect(() => {
    let isMounted = true

    const initializeAuth = async () => {
      try {
        console.log('🔄 AuthContext: Initializing auth state...')

        // Initialize tokenManager with existing session (if any)
        await tokenManager.initializeFromSession()
        console.log('🔄 AuthContext: TokenManager initialization complete')

        // Ensure authService is initialized first
        // This will check for existing Supabase session and set up listeners
        await authService.ensureInitialized()
        console.log('🔄 AuthContext: AuthService initialization complete')

        // Subscribe to auth state changes
        const unsubscribe = authService.onAuthStateChange((newUser) => {
          console.log('🔄 Auth state changed:', newUser ? `User: ${newUser.email}` : 'User logged out')
          if (isMounted) {
            setUser(newUser)
          }
        })

        // Get current user (may have been restored from session)
        const currentUser = authService.getCurrentUser()
        console.log('🔄 AuthContext: Current user from service:', currentUser?.email || 'none')

        if (isMounted) {
          setUser(currentUser)
          setIsLoading(false)
        }

        return unsubscribe
      } catch (err) {
        console.error('Failed to initialize auth:', err)
        if (isMounted) {
          setIsLoading(false)
        }
        return () => {}
      }
    }

    let unsubscribe: (() => void) | null = null
    let realtimeChannel: ReturnType<ReturnType<typeof getSupabaseClient>['channel']> | null = null

    initializeAuth().then((fn) => {
      unsubscribe = fn
      // Realtime listener will be set up in the user change effect below
    })

    return () => {
      isMounted = false
      if (unsubscribe) {
        unsubscribe()
      }
      if (realtimeChannel) {
        console.log('🔌 Cleaning up Realtime listener')
        realtimeChannel.unsubscribe()
      }
    }
  }, [])

  // Keep-alive: Ping Supabase every 5 minutes while tab is visible
  // This prevents the connection from going completely stale after idle
  useEffect(() => {
    const KEEP_ALIVE_INTERVAL = 5 * 60 * 1000 // 5 minutes
    let intervalId: NodeJS.Timeout | null = null
    let isTabVisible = !document.hidden

    const pingSupabase = async () => {
      // Allow background pings to keep TCP connection alive
      // if (!isTabVisible) return
      
      const startTime = performance.now()
      try {
        const supabase = getSupabaseClient()
        // Use getUser() instead of getSession() because getSession() often hits local cache (0-1ms)
        // and fails to keep the TCP connection warm. getUser() forces a network request.
        const { error } = await supabase.auth.getUser()
        
        if (error) {
           // If 401, it means token expired, which is fine (TokenManager will handle it), 
           // but at least we touched the network.
           console.log(`💓 Keep-alive ping network check (${(performance.now() - startTime).toFixed(0)}ms) - Status: ${error.status || 'Error'}`)
        } else {
           console.log(`💓 Keep-alive ping network check successful (${(performance.now() - startTime).toFixed(0)}ms)`)
        }
      } catch (err) {
        console.warn('⚠️ Keep-alive ping failed:', err)
      }
    }

    const handleVisibilityChange = () => {
      const isVisible = !document.hidden
      
      if (isVisible) {
        // Tab became visible - ping immediately for responsiveness
        console.log('👁️ Tab visible, checking connection...')
        pingSupabase()
      } else {
        console.log('🙈 Tab hidden, keep-alive continuing in background')
      }
    }

    // Start keep-alive immediately
    intervalId = setInterval(pingSupabase, KEEP_ALIVE_INTERVAL)
    // Initial ping
    pingSupabase()

    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      if (intervalId) clearInterval(intervalId)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [])

  // Re-subscribe when user changes (e.g. login)
  useEffect(() => {
    if (!user) return

    console.log(`🔌 Setting up Realtime listener for user ${user.id} (user changed)`)
    const supabase = getSupabaseClient()
    
    const channel = supabase
      .channel(`auth_events_${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'auth_events',
          filter: `user_id=eq.${user.id}`,
        },
        (payload: RealtimePostgresInsertPayload<any>) => {
          const event = payload.new as { event_type: string }
          if (event.event_type === 'logout') {
            console.warn('⚠️ Received force logout event from server. Signing out...')
            signOut()
          }
        }
      )
      .subscribe()

    return () => {
      console.log(`🔌 Cleaning up Realtime listener for user ${user.id}`)
      channel.unsubscribe()
    }
  }, [user?.id])

  const signIn = async (email: string, password: string): Promise<boolean> => {
    try {
      setIsLoading(true)
      const loggedInUser = await authService.signIn(email, password)
      return loggedInUser !== null
    } catch (err) {
      console.error('Sign in error:', err)
      return false
    } finally {
      setIsLoading(false)
    }
  }

  const signInWithGoogle = async (): Promise<void> => {
    try {
      setIsLoading(true)
      await authService.signInWithGoogle()
      // OAuth redirects, so we don't need to do anything here
    } catch (err) {
      console.error('Google sign in error:', err)
      setIsLoading(false)
    }
  }

  const sendMagicLink = async (email: string, redirectTo?: string): Promise<boolean> => {
    try {
      setIsLoading(true)
      const success = await authService.sendMagicLink(email, redirectTo)
      return success
    } catch (err) {
      console.error('Send magic link error:', err)
      return false
    } finally {
      setIsLoading(false)
    }
  }

  const verifyMagicLink = async (token: string): Promise<boolean> => {
    try {
      setIsLoading(true)
      const loggedInUser = await authService.verifyMagicLink(token)
      return loggedInUser !== null
    } catch (err) {
      console.error('Verify magic link error:', err)
      return false
    } finally {
      setIsLoading(false)
    }
  }

  const signOut = async (): Promise<void> => {
    try {
      console.log('🔓 Starting sign out process...')

      // Clear any pending redirect cache
      localStorage.removeItem('pending_short_id')
      localStorage.removeItem('pending_week_number')

      // Clear permission cache to avoid stale role/class data after logout
      clearPermissionCache()
      console.log('🔓 Permission cache cleared')

      // Clean up token manager (stops auto-refresh and clears tokens)
      tokenManager.onLogout()
      console.log('🔓 TokenManager cleanup complete')

      await authService.signOut()
      console.log('🔓 AuthService.signOut() complete, setting isLoading to false')
      setIsLoading(false)
    } catch (err) {
      console.error('❌ Sign out error:', err)
      setIsLoading(false)
    }
  }

  const value: AuthContextType = {
    user,
    isAuthenticated: user !== null,
    isLoading,
    signIn,
    signInWithGoogle,
    sendMagicLink,
    verifyMagicLink,
    signOut,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

/**
 * Custom hook to use auth context
 * Must be used within <AuthProvider>
 */
export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
