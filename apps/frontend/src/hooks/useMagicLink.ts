/**
 * useMagicLink Hook
 * Simple magic link authentication flow using Supabase Auth OTP
 * Works just like Google OAuth - no password, email-based login
 *
 * Supabase handles:
 * - Token generation and storage
 * - Email delivery
 * - Token expiry (15 minutes)
 * - One-time use enforcement
 * - Automatic user creation
 *
 * Usage:
 * const { sendLink, isLoading, error } = useMagicLink()
 * await sendLink(email)  // Email receives magic link
 * User clicks link → automatically logged in
 */

import { useState, useCallback } from 'react'
import { useAuth } from '@/context/AuthContext'

export interface UseMagicLinkState {
  isLoading: boolean
  error: string | null
  email: string | null
  sent: boolean
}

/**
 * Hook for magic link authentication via email
 * Minimal wrapper around Supabase Auth OTP
 */
export function useMagicLink() {
  const { sendMagicLink } = useAuth()

  const [state, setState] = useState<UseMagicLinkState>({
    isLoading: false,
    error: null,
    email: null,
    sent: false,
  })

  /**
   * Send magic link email
   * Supabase handles everything:
   * - Token generation
   * - Email sending
   * - User creation (if new)
   * - Session creation (if returning)
   */
  const sendLink = useCallback(
    async (email: string): Promise<boolean> => {
      setState({
        isLoading: true,
        error: null,
        email,
        sent: false,
      })

      try {
        const success = await sendMagicLink(email)

        if (success) {
          console.log('✅ Magic link sent to', email)
          setState({
            isLoading: false,
            error: null,
            email,
            sent: true,
          })
          return true
        } else {
          console.error('❌ Failed to send magic link')
          setState({
            isLoading: false,
            error: '無法發送魔法連結。請重試。',
            email,
            sent: false,
          })
          return false
        }
      } catch (err) {
        console.error('❌ Magic link error:', err)
        setState({
          isLoading: false,
          error: '發送魔法連結時發生錯誤',
          email,
          sent: false,
        })
        return false
      }
    },
    [sendMagicLink]
  )

  /**
   * Reset state for new attempt
   */
  const reset = useCallback(() => {
    setState({
      isLoading: false,
      error: null,
      email: null,
      sent: false,
    })
  }, [])

  return {
    sendLink,
    reset,
    isLoading: state.isLoading,
    error: state.error,
    email: state.email,
    sent: state.sent,
  }
}

export default useMagicLink
