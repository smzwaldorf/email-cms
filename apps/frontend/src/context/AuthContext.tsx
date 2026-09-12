/**
 * Authentication Context
 * Provides auth state and methods to the entire application
 * Usage: Wrap your app with <AuthProvider> and use useAuth() hook
 */

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { authService } from '@/services/authService'
import { tokenManager } from '@/services/tokenManager'
import { clearPermissionCache } from '@/services/PermissionService'
import type { AuthUser } from '@/types/auth'

export interface AuthContextType {
  user: AuthUser | null
  isAuthenticated: boolean
  isLoading: boolean
  signIn: (email: string, password: string) => Promise<boolean>
  signInWithGoogle: (redirectTo?: string) => Promise<void>
  sendMagicLink: (email: string, redirectTo?: string) => Promise<boolean>
  verifyMagicLink: (token: string) => Promise<boolean>
  signOut: () => Promise<void>
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined)

export interface AuthProviderProps {
  children: ReactNode
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [renewalRequired, setRenewalRequired] = useState(false)
  useEffect(() => {
    const required = () => setRenewalRequired(true)
    const renewed = () => setRenewalRequired(false)
    window.addEventListener('cms-auth-renewal-required', required)
    window.addEventListener('cms-auth-renewed', renewed)
    return () => {
      window.removeEventListener('cms-auth-renewal-required', required)
      window.removeEventListener('cms-auth-renewed', renewed)
    }
  }, [])

  // Initialize auth state on mount
  useEffect(() => {
    let isMounted = true

    const initializeAuth = async () => {
      try {
        console.log('🔄 AuthContext: Initializing auth state...')

        // Restore the central OIDC session and resolve the local application user.
        await authService.ensureInitialized()
        if (!isMounted) return () => {}
        console.log('🔄 AuthContext: AuthService initialization complete')

        // Subscribe to auth state changes
        const unsubscribe = authService.onAuthStateChange((newUser) => {
          console.log('🔄 Auth state changed:', newUser ? `User: ${newUser.email}` : 'User logged out')
          if (isMounted) {
            setUser(newUser)
          }
        })
        const stopMonitoring = authService.startSessionMonitoring()

        // Get current user (may have been restored from session)
        const currentUser = authService.getCurrentUser()
        console.log('🔄 AuthContext: Current user from service:', currentUser?.email || 'none')

        if (isMounted) {
          setUser(currentUser)
          setIsLoading(false)
        }

        return () => { unsubscribe(); stopMonitoring() }
      } catch (err) {
        console.error('Failed to initialize auth:', err)
        if (isMounted) {
          setIsLoading(false)
        }
        return () => {}
      }
    }

    let unsubscribe: (() => void) | null = null

    initializeAuth().then((fn) => {
      unsubscribe = fn
    })

    return () => {
      isMounted = false
      if (unsubscribe) {
        unsubscribe()
      }
    }
  }, [])

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

  const signInWithGoogle = async (redirectTo?: string): Promise<void> => {
    try {
      setIsLoading(true)
      await authService.signInWithGoogle(redirectTo)
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

  return <AuthContext.Provider value={value}>
    {user && renewalRequired && <div role="alert" className="bg-amber-50 p-3 text-amber-950">
      登入需要重新驗證。目前頁面會保留，重新登入後才能繼續儲存或載入資料。
      <button className="ml-3 underline" onClick={() => void authService.signInWithGoogle(window.location.pathname + window.location.search)}>重新登入</button>
    </div>}
    {children}
  </AuthContext.Provider>
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
