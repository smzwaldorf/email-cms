/**
 * Auth Callback Handler Page
 * Handles OAuth redirects and magic link verification
 * Processes authentication callbacks from Supabase
 */

import React, { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'

export const AuthCallbackPage: React.FC = () => {
  const navigate = useNavigate()
  const { user, isLoading, verifyMagicLink } = useAuth()
  const [searchParams] = useSearchParams()
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState('processing')

  useEffect(() => {
    const handleCallback = async () => {
      try {
        setStatus('processing')
        console.log('🔄 Auth callback handler initiated')

        // Check for magic link token in URL hash
        // Supabase returns the token in the URL fragment: #access_token=...
        const hash = window.location.hash
        console.log('📍 URL hash:', hash ? hash.substring(0, 50) + '...' : 'none')

        // Check for error in query params
        const errorParam = searchParams.get('error')
        if (errorParam) {
          setError(errorParam)
          setStatus('error')
          console.error('❌ Auth error:', errorParam)
          return
        }

        // Get redirect destination from query params
        const redirectUrl = searchParams.get('redirect_to')
        console.log('📍 Redirect destination from params:', redirectUrl || 'none')

        // Supabase handles OAuth and Magic Link callbacks automatically
        // The user session is established when the auth state changes
        // We just need to wait for the user to be set by AuthContext

        // Wait for auth to be initialized and user to be set
        let attempts = 0
        const maxAttempts = 20 // 10 seconds with 500ms checks

        const checkUser = setInterval(() => {
          attempts++

          if (!isLoading && user) {
            clearInterval(checkUser)
            console.log('✅ User authenticated:', user.email)
            setStatus('success')

            // Redirect to original article link or latest week
            setTimeout(() => {
              if (redirectUrl) {
                console.log('🔄 Redirecting to original article:', redirectUrl)
                navigate(redirectUrl)
              } else {
                console.log('🔄 Redirecting to default week')
                navigate('/week/2025-W47')
              }
            }, 500)
          } else if (attempts >= maxAttempts) {
            clearInterval(checkUser)
            console.warn('⚠️ Auth callback timeout - no user after 10 seconds')
            setStatus('timeout')
            setError('Authentication verification took too long. Please try logging in again.')
          }
        }, 500)

        return () => clearInterval(checkUser)
      } catch (err) {
        console.error('❌ Auth callback error:', err)
        setError((err as Error).message || 'An error occurred during authentication')
        setStatus('error')
      }
    }

    handleCallback()
  }, [user, isLoading, navigate, searchParams, verifyMagicLink])

  return (
    <div className="min-h-screen bg-gradient-to-br from-waldorf-sage to-waldorf-cream flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-lg p-8 w-full max-w-md text-center">
        {status === 'processing' && (
          <>
            <div className="flex justify-center mb-4">
              <div className="relative w-12 h-12">
                <div className="absolute inset-0 border-4 border-gray-200 rounded-full"></div>
                <div className="absolute inset-0 border-4 border-transparent border-t-blue-600 border-r-blue-600 rounded-full animate-spin"></div>
              </div>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">正在驗證</h1>
            <p className="text-gray-600">Processing your authentication...</p>
          </>
        )}

        {status === 'success' && (
          <>
            <div className="flex justify-center mb-4">
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">登入成功！</h1>
            <p className="text-gray-600">Redirecting to newsletter viewer...</p>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="flex justify-center mb-4">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">驗證失敗</h1>
            <p className="text-red-600 mb-4">{error || 'An error occurred during authentication'}</p>
            <button
              onClick={() => navigate('/login')}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg transition-colors duration-150"
            >
              返回登入
            </button>
          </>
        )}

        {status === 'timeout' && (
          <>
            <div className="flex justify-center mb-4">
              <div className="w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center">
                <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">驗證逾時</h1>
            <p className="text-gray-600 mb-4">{error || 'Authentication verification took too long'}</p>
            <button
              onClick={() => navigate('/login')}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg transition-colors duration-150"
            >
              返回登入
            </button>
          </>
        )}
      </div>
    </div>
  )
}
