/**
 * Magic Link Form Component
 * Allows users to sign in via email magic link
 * Sends a time-limited link to user's email address
 */

import React, { useState, useMemo } from 'react'
import { useAuth } from '@/context/AuthContext'

interface MagicLinkFormProps {
  onSuccess: () => void
  isLoading?: boolean
  redirectTo?: string
}

export const MagicLinkForm: React.FC<MagicLinkFormProps> = ({ onSuccess, isLoading = false, redirectTo }) => {
  const { sendMagicLink } = useAuth()
  const [email, setEmail] = useState('')
  const [step, setStep] = useState<'email-input' | 'confirm'>('email-input')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Determine redirect URL: use provided redirectTo, localStorage cache, or current pathname
  const finalRedirectTo = useMemo(() => {
    if (redirectTo) return redirectTo
    const cachedShortId = localStorage.getItem('pending_short_id')
    const cachedWeekNumber = localStorage.getItem('pending_week_number')
    if (cachedShortId && cachedWeekNumber) {
      // Use /week for week_number format, /newsletter for UUIDs
      const isWeekNumber = /^\d{4}-W\d{2}$/.test(cachedWeekNumber)
      const route = isWeekNumber ? '/week' : '/newsletter'
      return `${route}/${cachedWeekNumber}/${cachedShortId}`
    }
    return undefined
  }, [redirectTo])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!email) {
      setError('Please enter your email address')
      return
    }

    if (!email.includes('@')) {
      setError('Please enter a valid email address')
      return
    }

    try {
      setIsSubmitting(true)
      console.log('📧 Sending magic link to:', email)
      if (finalRedirectTo) {
        console.log('📍 Will redirect to:', finalRedirectTo)
      }

      const success = await sendMagicLink(email, finalRedirectTo)

      if (success) {
        // Show confirmation step
        setStep('confirm')
        // Auto-redirect after showing confirmation message
        setTimeout(() => {
          onSuccess()
        }, 5000)
      } else {
        setError('Failed to send magic link. Please try again.')
      }
    } catch (err) {
      console.error('❌ Error sending magic link:', err)
      setError('Failed to send magic link. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (step === 'confirm') {
    return (
      <div className="space-y-4 text-center">
        <div className="flex justify-center">
          <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
            <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
        </div>

        <div>
          <h3 className="text-lg font-medium text-gray-900 mb-1">檢查您的電子郵件</h3>
          <p className="text-sm text-gray-600">
            我們已向 <span className="font-medium">{email}</span> 發送了登入連結
          </p>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-900">
          <p className="font-medium mb-1">📝 下一步：</p>
          <p>點擊電子郵件中的連結完成登入。連結在 15 分鐘內有效。</p>
        </div>

        <p className="text-xs text-gray-500">
          在一切就緒後，您將被自動重新導向
        </p>

        <button
          type="button"
          onClick={() => {
            setStep('email-input')
            setEmail('')
          }}
          className="text-sm text-blue-600 hover:text-blue-700 font-medium"
        >
          使用不同的電子郵件
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="magic-email" className="block text-sm font-medium text-gray-700 mb-1">
          電子郵件地址
        </label>
        <input
          id="magic-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="your-email@example.com"
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-waldorf-peach disabled:bg-gray-100"
          disabled={isLoading || isSubmitting}
        />
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-xs text-gray-600">
        <p>
          ✨ 我們將向您發送一個安全連結。不需要密碼 - 只需點擊連結即可登入。
        </p>
      </div>

      <button
        type="submit"
        disabled={isLoading || isSubmitting}
        className="w-full bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold py-3 px-4 rounded-lg transition-all duration-200 disabled:bg-gray-400 disabled:cursor-not-allowed shadow-md hover:shadow-lg"
      >
        {isSubmitting ? '發送中...' : '發送登入連結'}
      </button>
    </form>
  )
}
