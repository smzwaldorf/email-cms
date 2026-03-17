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
          <div className="w-12 h-12 bg-waldorf-sage-100 rounded-full flex items-center justify-center">
            <svg className="w-6 h-6 text-waldorf-sage-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
        </div>

        <div>
          <h3 className="text-lg font-medium text-waldorf-clay-800 mb-1">檢查您的電子郵件</h3>
          <p className="text-sm text-waldorf-clay-500">
            我們已向 <span className="font-medium">{email}</span> 發送了登入連結
          </p>
        </div>

        <div className="bg-waldorf-peach-50 border border-waldorf-peach-200 rounded-lg p-3 text-sm text-waldorf-peach-900">
          <p className="font-medium mb-1">📝 下一步：</p>
          <p>點擊電子郵件中的連結完成登入。連結在 15 分鐘內有效。</p>
        </div>

        <p className="text-xs text-waldorf-clay-500">
          在一切就緒後，您將被自動重新導向
        </p>

        <button
          type="button"
          onClick={() => {
            setStep('email-input')
            setEmail('')
          }}
          className="text-sm text-waldorf-peach-600 hover:text-waldorf-peach-700 font-medium"
        >
          使用不同的電子郵件
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="magic-email" className="block text-sm font-medium text-waldorf-clay-700 mb-1.5">
          電子郵件地址
        </label>
        <input
          id="magic-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="your-email@example.com"
          autoComplete="email"
          className="w-full px-4 py-2.5 border border-waldorf-cream-300 rounded-lg text-waldorf-clay-800 focus:outline-none focus:ring-2 focus:ring-waldorf-peach-300 focus:border-waldorf-peach-400 disabled:bg-waldorf-cream-100"
          disabled={isLoading || isSubmitting}
        />
      </div>

      {error && (
        <div className="bg-waldorf-rose-50 border border-waldorf-rose-200 text-waldorf-rose-700 px-4 py-3 rounded-lg text-sm" role="alert" aria-live="polite">
          {error}
        </div>
      )}

      <div className="bg-waldorf-cream-50 border border-waldorf-cream-200 rounded-lg p-3 text-xs text-waldorf-clay-500">
        <p>
          ✨ 我們將向您發送一個安全連結。不需要密碼 - 只需點擊連結即可登入。
        </p>
      </div>

      <button
        type="submit"
        disabled={isLoading || isSubmitting}
        className="w-full bg-gradient-to-r from-waldorf-peach-500 to-waldorf-peach-600 hover:from-waldorf-peach-600 hover:to-waldorf-peach-700 active:scale-[0.99] text-white font-semibold py-3 px-4 rounded-lg transition-all duration-200 disabled:from-gray-400 disabled:to-gray-400 disabled:cursor-not-allowed shadow-md shadow-waldorf-peach-200/40"
      >
        {isSubmitting ? '發送中...' : '發送登入連結'}
      </button>
    </form>
  )
}
