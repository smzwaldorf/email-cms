/**
 * Login Page
 * Email/password authentication form for parents
 * Redirects to /week/2025-W47 after successful login
 */

import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'

export const LoginPage: React.FC = () => {
  const navigate = useNavigate()
  const { signIn, isLoading } = useAuth()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!email || !password) {
      setError('Please enter both email and password')
      return
    }

    console.log('📝 Form submitted with email:', email)
    const success = await signIn(email, password)

    if (success) {
      console.log('✅ Sign in successful, redirecting...')
      // Redirect to latest newsletter
      navigate('/week/2025-W47')
    } else {
      console.log('❌ Sign in failed')
      setError('Invalid email or password. Check browser console (F12) for details.')
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-waldorf-sage to-waldorf-cream flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-lg p-8 w-full max-w-md">
        {/* Header */}
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">電子報閱讀器</h1>
          <p className="text-gray-600">Newsletter Viewer</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Email Input */}
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

          {/* Password Input */}
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

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full mt-6 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold py-3 px-4 rounded-lg transition-all duration-200 disabled:bg-gray-400 disabled:cursor-not-allowed shadow-md hover:shadow-lg"
          >
            {isLoading ? '登入中... Signing in...' : '登入 Login'}
          </button>
        </form>

        {/* Test Credentials */}
        <div className="mt-8 pt-6 border-t border-gray-200">
          <p className="text-sm text-gray-600 mb-3 font-medium">Test Credentials:</p>
          <div className="space-y-2 text-xs text-gray-600">
            <div>
              <p className="font-mono bg-gray-50 p-2 rounded mb-1">parent1@example.com</p>
              <p className="font-mono bg-gray-50 p-2 rounded">parent1password123</p>
              <p className="text-gray-500 mt-1">See 2 public + 2 class-restricted articles</p>
            </div>
            <div className="pt-2">
              <p className="font-mono bg-gray-50 p-2 rounded mb-1">parent2@example.com</p>
              <p className="font-mono bg-gray-50 p-2 rounded">parent2password123</p>
              <p className="text-gray-500 mt-1">See 2 public + 1 class-restricted article</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
