/**
 * Login Page
 * Multi-method authentication: Google OAuth, Magic Link, and Email/Password
 * Redirects to the latest published week after successful login
 */

import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { GoogleButton } from '@/components/GoogleButton'
import { MagicLinkForm } from '@/components/MagicLinkForm'
import { WeekService } from '@/services/WeekService'

type AuthMethod = 'password' | 'magic-link'

export const LoginPage: React.FC = () => {
  const navigate = useNavigate()
  const { signIn, isLoading } = useAuth()

  const [authMethod, setAuthMethod] = useState<AuthMethod>('password')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  const testUsers = [
    {
      email: 'parent1@example.com',
      password: 'parent1password123',
      label: 'Parent 1',
      description: '2 public + 2 class-restricted articles',
    },
    {
      email: 'parent2@example.com',
      password: 'parent2password123',
      label: 'Parent 2',
      description: '2 public + 1 class-restricted article',
    },
    {
      email: 'teacher@example.com',
      password: 'teacher123456',
      label: 'Teacher',
      description: 'Can edit A1 (Grade 1A) articles',
    },
    {
      email: 'admin@example.com',
      password: 'admin123456',
      label: 'Admin',
      description: 'Can edit all articles',
    },
  ]

  const redirectToLatestWeek = async () => {
    try {
      const latestWeek = await WeekService.getLatestPublishedWeek()
      if (latestWeek) {
        // Use week_number if available, otherwise use newsletter id (for special editions)
        const routeKey = latestWeek.week_number || latestWeek.id
        console.log(`✅ Redirecting to latest newsletter: ${routeKey}`)
        // Use generateWeeklyUrl to get correct route (/week or /newsletter)
        const { generateWeeklyUrl } = await import('@/utils/urlUtils')
        navigate(generateWeeklyUrl(routeKey))
      } else {
        console.warn('⚠️ No published weeks found, using fallback week')
        navigate('/week/2025-W47')
      }
    } catch (err) {
      console.error('❌ Error fetching latest week:', err)
      navigate('/week/2025-W47')
    }
  }

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!email || !password) {
      setError('Please enter both email and password')
      return
    }

    console.log('📝 Password form submitted with email:', email)
    const success = await signIn(email, password)

    if (success) {
      console.log('✅ Sign in successful, redirecting to latest week...')
      await redirectToLatestWeek()
    } else {
      console.log('❌ Sign in failed')
      setError('Invalid email or password. Check browser console (F12) for details.')
    }
  }

  const handleQuickFill = async (testEmail: string, testPassword: string) => {
    setEmail(testEmail)
    setPassword(testPassword)
    setError('')
    setAuthMethod('password')

    // Wait 1 second, then submit
    await new Promise((resolve) => setTimeout(resolve, 1000))

    // Submit the form programmatically
    const form = document.querySelector('form[data-form-type="password"]')
    if (form) {
      form.dispatchEvent(new Event('submit', { bubbles: true }))
    }
  }

  const handleMagicLinkSuccess = () => {
    setError('')
    setEmail('')
    setPassword('')
  }

  return (
    <div className="relative min-h-screen bg-gradient-to-br from-waldorf-sage-100 via-waldorf-cream-100 to-waldorf-clay-50 flex items-center justify-center p-4 sm:p-6">
      <div className="pointer-events-none absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_top_right,_rgba(233,125,67,0.25),transparent_45%),radial-gradient(circle_at_bottom_left,_rgba(135,153,107,0.20),transparent_40%)]" />

      <div className="relative w-full max-w-5xl overflow-hidden rounded-3xl border border-waldorf-cream-200 bg-white/85 backdrop-blur-sm shadow-2xl shadow-waldorf-clay-200/40 lg:grid lg:grid-cols-[1.1fr,0.9fr]">
        <section className="hidden lg:flex flex-col justify-between p-10 bg-gradient-to-br from-waldorf-clay-700 via-waldorf-clay-800 to-waldorf-clay-900 text-white">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs tracking-wide uppercase">
              <span className="h-2 w-2 rounded-full bg-waldorf-peach-300" />
              Secure Access
            </p>
            <h1 className="mt-6 font-display text-4xl leading-tight">
              電子報閱讀器
            </h1>
            <p className="mt-3 text-waldorf-cream-100/90">
              Newsletter Viewer for families, teachers, and admins.
            </p>
          </div>

          <div className="space-y-4 text-sm text-waldorf-cream-100/90">
            <div className="rounded-2xl border border-white/15 bg-white/10 p-4">
              <p className="font-semibold text-white">Fast authentication</p>
              <p className="mt-1">Use Google OAuth or passwordless magic link.</p>
            </div>
            <div className="rounded-2xl border border-white/15 bg-white/10 p-4">
              <p className="font-semibold text-white">Role-based access</p>
              <p className="mt-1">Parents, teachers, and admins see the right content.</p>
            </div>
          </div>
        </section>

        <section className="p-6 sm:p-8 lg:p-10">
          <div className="mb-8 text-center lg:text-left">
            <h2 className="text-3xl font-display font-semibold text-waldorf-clay-800 mb-2">歡迎回來</h2>
            <p className="text-waldorf-clay-500">Sign in to continue reading and managing newsletters.</p>
          </div>

          {/* Google Sign-in */}
          <div className="mb-6">
            <GoogleButton disabled={isLoading} />
            <p className="mt-2 text-center text-xs text-waldorf-clay-500">
              Recommended for the quickest sign-in experience
            </p>
          </div>

          {/* Divider */}
          <div className="relative mb-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-waldorf-cream-300"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white/90 text-waldorf-clay-500">或</span>
            </div>
          </div>

          {/* Auth Method Tabs */}
          <div className="mb-6 rounded-xl border border-waldorf-cream-300 bg-waldorf-cream-50/60 p-1">
            <div className="grid grid-cols-2 gap-1">
              <button
                type="button"
                onClick={() => setAuthMethod('password')}
                aria-pressed={authMethod === 'password'}
                className={`rounded-lg py-2.5 px-3 text-sm font-medium transition-all duration-150 ${
                  authMethod === 'password'
                    ? 'bg-white text-waldorf-clay-800 shadow-sm border border-waldorf-cream-300'
                    : 'text-waldorf-clay-500 hover:text-waldorf-clay-700'
                }`}
              >
                密碼登入
              </button>
              <button
                type="button"
                onClick={() => setAuthMethod('magic-link')}
                aria-pressed={authMethod === 'magic-link'}
                className={`rounded-lg py-2.5 px-3 text-sm font-medium transition-all duration-150 ${
                  authMethod === 'magic-link'
                    ? 'bg-white text-waldorf-clay-800 shadow-sm border border-waldorf-cream-300'
                    : 'text-waldorf-clay-500 hover:text-waldorf-clay-700'
                }`}
              >
                魔法連結
              </button>
            </div>
            <p className="px-2 pt-2 text-xs text-waldorf-clay-500">
              {authMethod === 'password'
                ? 'Use your account email and password.'
                : 'Receive a one-time login link via email.'}
            </p>
          </div>

          {/* Error Message (shown for both forms) */}
          {error && (
            <div
              className="mb-4 rounded-xl border border-waldorf-rose-200 bg-waldorf-rose-50 px-4 py-3 text-sm text-waldorf-rose-700"
              role="alert"
              aria-live="polite"
            >
              {error}
            </div>
          )}

          {/* Password Form */}
          {authMethod === 'password' && (
            <form onSubmit={handlePasswordSubmit} data-form-type="password" className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-waldorf-clay-700 mb-1.5">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  placeholder="parent1@example.com"
                  className="w-full rounded-lg border border-waldorf-cream-300 bg-white px-4 py-2.5 text-waldorf-clay-800 placeholder:text-waldorf-clay-400 focus:outline-none focus:ring-2 focus:ring-waldorf-peach-300 focus:border-waldorf-peach-400 disabled:bg-waldorf-cream-100"
                  disabled={isLoading}
                />
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-waldorf-clay-700 mb-1.5">
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  className="w-full rounded-lg border border-waldorf-cream-300 bg-white px-4 py-2.5 text-waldorf-clay-800 placeholder:text-waldorf-clay-400 focus:outline-none focus:ring-2 focus:ring-waldorf-peach-300 focus:border-waldorf-peach-400 disabled:bg-waldorf-cream-100"
                  disabled={isLoading}
                />
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full mt-6 rounded-lg bg-gradient-to-r from-waldorf-peach-500 to-waldorf-peach-600 px-4 py-3 font-semibold text-white shadow-md shadow-waldorf-peach-200/40 transition-all duration-200 hover:from-waldorf-peach-600 hover:to-waldorf-peach-700 active:scale-[0.99] disabled:cursor-not-allowed disabled:from-gray-400 disabled:to-gray-400"
              >
                {isLoading ? '登入中...' : '登入'}
              </button>
            </form>
          )}

          {/* Magic Link Form */}
          {authMethod === 'magic-link' && (
            <MagicLinkForm onSuccess={handleMagicLinkSuccess} isLoading={isLoading} />
          )}

          {/* Test Users Quick Fill (Dev Mode Only) */}
          {import.meta.env.DEV && (
            <div className="mt-8 border-t border-waldorf-cream-200 pt-6">
              <p className="mb-3 text-sm font-medium text-waldorf-clay-600">🧪 Quick Fill (Dev Mode):</p>
              <div className="grid gap-2">
                {testUsers.map((user) => (
                  <button
                    key={user.email}
                    type="button"
                    onClick={() => handleQuickFill(user.email, user.password)}
                    disabled={isLoading}
                    className="w-full rounded-lg border border-waldorf-cream-200 bg-waldorf-cream-50 px-3 py-2 text-left transition-colors duration-150 hover:border-waldorf-cream-300 hover:bg-waldorf-cream-100 active:bg-waldorf-cream-200 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <div className="text-sm font-medium text-waldorf-clay-800">{user.label}</div>
                    <div className="font-mono text-xs text-waldorf-clay-500">{user.email}</div>
                    <div className="mt-1 text-xs text-waldorf-clay-400">{user.description}</div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
