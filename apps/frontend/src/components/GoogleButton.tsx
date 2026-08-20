/**
 * SMZ Identity sign-in button.
 * The central sign-in page offers the approved Google, email-link, and
 * development-account methods.
 */

import React from 'react'
import { useAuth } from '@/context/AuthContext'

interface GoogleButtonProps {
  disabled?: boolean
  redirectTo?: string
}

export const GoogleButton: React.FC<GoogleButtonProps> = ({ disabled = false, redirectTo }) => {
  const { signInWithGoogle } = useAuth()
  const [isLoading, setIsLoading] = React.useState(false)

  const handleGoogleSignIn = async () => {
    try {
      setIsLoading(true)
      console.log('Initiating SMZ Identity sign-in...')
      await signInWithGoogle(redirectTo)
      // OAuth redirects, so onSuccess won't be called immediately
      // After callback, user will be authenticated
    } catch (error) {
      console.error('SMZ Identity sign-in error:', error)
      setIsLoading(false)
    }
  }

  return (
    <button
      type="button"
      onClick={handleGoogleSignIn}
      disabled={disabled || isLoading}
      className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-white border border-waldorf-cream-300 rounded-lg font-medium text-waldorf-clay-700 hover:bg-waldorf-cream-50 active:bg-waldorf-cream-100 transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm hover:shadow-md focus:outline-none focus:ring-2 focus:ring-waldorf-peach-300"
      aria-label={isLoading ? 'SMZ Identity sign-in in progress' : '使用 SMZ Identity 登入'}
    >
      <svg
        className="w-5 h-5"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        aria-hidden="true"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M12 3 5.5 5.8v5.5c0 4.2 2.7 7.8 6.5 9.2 3.8-1.4 6.5-5 6.5-9.2V5.8L12 3Z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="m9.2 11.9 1.8 1.8 3.9-4.1" />
      </svg>
      <span>{isLoading ? '連接中...' : '使用 SMZ Identity 登入'}</span>
    </button>
  )
}
