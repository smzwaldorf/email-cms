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
        console.log(`✅ Redirecting to latest week: ${latestWeek.week_number}`)
        navigate(`/week/${latestWeek.week_number}`)
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
    <div className="min-h-screen bg-gradient-to-br from-waldorf-sage to-waldorf-cream flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-lg p-8 w-full max-w-md">
        {/* Header */}
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">電子報閱讀器</h1>
          <p className="text-gray-600">Newsletter Viewer</p>
        </div>

        {/* Google Sign-in */}
        <div className="mb-6">
          <GoogleButton disabled={isLoading} />
        </div>

        {/* Divider */}
        <div className="relative mb-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-300"></div>
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-2 bg-white text-gray-500">或</span>
          </div>
        </div>

        {/* Auth Method Tabs */}
        <div className="flex gap-2 mb-6 border-b border-gray-200">
          <button
            type="button"
            onClick={() => setAuthMethod('password')}
            className={`flex-1 py-2 px-3 text-sm font-medium transition-colors duration-150 ${
              authMethod === 'password'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            密碼登入
          </button>
          <button
            type="button"
            onClick={() => setAuthMethod('magic-link')}
            className={`flex-1 py-2 px-3 text-sm font-medium transition-colors duration-150 ${
              authMethod === 'magic-link'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            魔法連結
          </button>
        </div>

        {/* Error Message (shown for both forms) */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm mb-4">
            {error}
          </div>
        )}

        {/* Password Form */}
        {authMethod === 'password' && (
          <form onSubmit={handlePasswordSubmit} data-form-type="password" className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="parent1@example.com"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-waldorf-peach disabled:bg-gray-100"
                disabled={isLoading}
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-waldorf-peach disabled:bg-gray-100"
                disabled={isLoading}
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full mt-6 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold py-3 px-4 rounded-lg transition-all duration-200 disabled:bg-gray-400 disabled:cursor-not-allowed shadow-md hover:shadow-lg"
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
          <div className="mt-8 pt-6 border-t border-gray-200">
            <p className="text-sm text-gray-600 mb-3 font-medium">🧪 Quick Fill (Dev Mode):</p>
            <div className="space-y-2">
              {testUsers.map((user) => (
                <button
                  key={user.email}
                  type="button"
                  onClick={() => handleQuickFill(user.email, user.password)}
                  disabled={isLoading}
                  className="w-full text-left px-3 py-2 bg-gray-50 hover:bg-gray-100 active:bg-gray-200 border border-gray-200 rounded-lg transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <div className="font-medium text-sm text-gray-900">{user.label}</div>
                  <div className="text-xs text-gray-600 font-mono">{user.email}</div>
                  <div className="text-xs text-gray-500 mt-1">{user.description}</div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
