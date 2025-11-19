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
    const initializeAuth = async () => {
      try {
        // Check if user is already logged in
        const currentUser = authService.getCurrentUser()
        setUser(currentUser)
      } catch (err) {
        console.error('Failed to initialize auth:', err)
      } finally {
        setIsLoading(false)
      }
    }

    initializeAuth()

    // Subscribe to auth state changes
    const unsubscribe = authService.onAuthStateChange((newUser) => {
      console.log('🔄 Auth state changed:', newUser ? `User: ${newUser.email}` : 'User logged out')
      setUser(newUser)
    })

    return () => {
      unsubscribe()
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

  const signOut = async (): Promise<void> => {
    try {
      console.log('🔓 Starting sign out process...')
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
