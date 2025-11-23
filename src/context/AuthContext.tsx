/**
 * Authentication Context
 * Provides auth state and methods to the entire application
 * Usage: Wrap your app with <AuthProvider> and use useAuth() hook
 */

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { authService } from '@/services/authService'
import type { AuthUser } from '@/services/authService'

export interface AuthContextType {
  user: AuthUser | null
  isAuthenticated: boolean
  isLoading: boolean
  signIn: (email: string, password: string) => Promise<boolean>
  signInWithGoogle: () => Promise<void>
  sendMagicLink: (email: string) => Promise<boolean>
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

  const sendMagicLink = async (email: string): Promise<boolean> => {
    try {
      setIsLoading(true)
      const success = await authService.sendMagicLink(email)
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
