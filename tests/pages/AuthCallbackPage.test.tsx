/**
 * AuthCallbackPage Component Tests
 * Tests for auth callback page with redirect URL parameter
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { BrowserRouter as Router } from 'react-router-dom'
import { AuthCallbackPage } from '@/pages/AuthCallbackPage'

// Mock react-router-dom
const mockNavigate = vi.fn()
let mockSearchParams: URLSearchParams = new URLSearchParams()

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useSearchParams: () => [mockSearchParams, (newParams: any) => {}],
  }
})

// Mock useAuth hook
const mockUseAuth = vi.fn()
vi.mock('@/context/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}))

describe('AuthCallbackPage - Redirect URL Handling', () => {
  const testUser = {
    id: 'test-user-id',
    email: 'test@example.com',
    role: 'viewer' as const,
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    mockSearchParams = new URLSearchParams()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.clearAllMocks()
  })

  describe('rendering', () => {
    it('should render processing state initially', () => {
      mockUseAuth.mockReturnValue({
        user: null,
        isLoading: true,
        verifyMagicLink: vi.fn(),
      })

      render(
        <Router>
          <AuthCallbackPage />
        </Router>
      )

      expect(screen.getByText(/正在驗證/i)).toBeInTheDocument()
    })

    it('should show error when error param is present', () => {
      mockSearchParams = new URLSearchParams('error=invalid_token')

      mockUseAuth.mockReturnValue({
        user: null,
        isLoading: false,
        verifyMagicLink: vi.fn(),
      })

      render(
        <Router>
          <AuthCallbackPage />
        </Router>
      )

      expect(screen.getByText(/驗證失敗/i)).toBeInTheDocument()
      expect(screen.getByText('invalid_token')).toBeInTheDocument()
    })
  })

  describe('redirect logic', () => {
    it('extracts redirect_to parameter from URL search params', () => {
      const testRedirectUrl = '/week/2025-W43/a001'
      mockSearchParams = new URLSearchParams(`redirect_to=${encodeURIComponent(testRedirectUrl)}`)

      const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      mockUseAuth.mockReturnValue({
        user: testUser,
        isLoading: false,
        verifyMagicLink: vi.fn(),
      })

      render(
        <Router>
          <AuthCallbackPage />
        </Router>
      )

      // Check that redirect_to was logged
      expect(consoleLogSpy).toHaveBeenCalledWith(
        '📍 Redirect destination from params:',
        testRedirectUrl
      )

      consoleLogSpy.mockRestore()
    })

    it('uses redirect_to parameter when navigating with article URL', () => {
      const articleUrl = '/week/2025-W43/a001'
      mockSearchParams = new URLSearchParams(`redirect_to=${encodeURIComponent(articleUrl)}`)

      mockUseAuth.mockReturnValue({
        user: testUser,
        isLoading: false,
        verifyMagicLink: vi.fn(),
      })

      render(
        <Router>
          <AuthCallbackPage />
        </Router>
      )

      // Run all pending timers
      vi.runAllTimers()

      expect(mockNavigate).toHaveBeenCalledWith(articleUrl)
    })

    it('navigates to default week when no redirect_to param', () => {
      mockSearchParams = new URLSearchParams()

      mockUseAuth.mockReturnValue({
        user: testUser,
        isLoading: false,
        verifyMagicLink: vi.fn(),
      })

      render(
        <Router>
          <AuthCallbackPage />
        </Router>
      )

      vi.runAllTimers()

      expect(mockNavigate).toHaveBeenCalledWith('/week/2025-W47')
    })

    it('handles empty redirect_to as falsy and uses default', () => {
      mockSearchParams = new URLSearchParams('redirect_to=')

      mockUseAuth.mockReturnValue({
        user: testUser,
        isLoading: false,
        verifyMagicLink: vi.fn(),
      })

      render(
        <Router>
          <AuthCallbackPage />
        </Router>
      )

      vi.runAllTimers()

      expect(mockNavigate).toHaveBeenCalledWith('/week/2025-W47')
    })
  })

  describe('redirect URL patterns', () => {
    it('handles week with article short ID', () => {
      const url = '/week/2025-W43/a001'
      mockSearchParams = new URLSearchParams(`redirect_to=${encodeURIComponent(url)}`)

      mockUseAuth.mockReturnValue({
        user: testUser,
        isLoading: false,
        verifyMagicLink: vi.fn(),
      })

      render(
        <Router>
          <AuthCallbackPage />
        </Router>
      )

      vi.runAllTimers()

      expect(mockNavigate).toHaveBeenCalledWith(url)
    })

    it('handles different week numbers', () => {
      const weeks = ['2025-W40', '2025-W50', '2026-W01']

      weeks.forEach((week) => {
        vi.clearAllMocks()
        const url = `/week/${week}/a001`
        mockSearchParams = new URLSearchParams(`redirect_to=${encodeURIComponent(url)}`)

        mockUseAuth.mockReturnValue({
          user: testUser,
          isLoading: false,
          verifyMagicLink: vi.fn(),
        })

        render(
          <Router>
            <AuthCallbackPage />
          </Router>
        )

        vi.runAllTimers()

        expect(mockNavigate).toHaveBeenCalledWith(url)
      })
    })

    it('handles encoded URLs correctly', () => {
      const originalUrl = '/week/2025-W43/a001'
      const encodedUrl = encodeURIComponent(originalUrl)
      mockSearchParams = new URLSearchParams(`redirect_to=${encodedUrl}`)

      mockUseAuth.mockReturnValue({
        user: testUser,
        isLoading: false,
        verifyMagicLink: vi.fn(),
      })

      render(
        <Router>
          <AuthCallbackPage />
        </Router>
      )

      vi.runAllTimers()

      // Should decode and navigate to original URL
      expect(mockNavigate).toHaveBeenCalledWith(originalUrl)
    })
  })

  describe('logging', () => {
    it('logs redirect destination when present', () => {
      const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
      const testUrl = '/week/2025-W43/a001'
      mockSearchParams = new URLSearchParams(`redirect_to=${encodeURIComponent(testUrl)}`)

      mockUseAuth.mockReturnValue({
        user: testUser,
        isLoading: false,
        verifyMagicLink: vi.fn(),
      })

      render(
        <Router>
          <AuthCallbackPage />
        </Router>
      )

      vi.runAllTimers()

      expect(consoleLogSpy).toHaveBeenCalledWith(
        '🔄 Redirecting to original article:',
        testUrl
      )

      consoleLogSpy.mockRestore()
    })

    it('logs default redirect when no redirect_to param', () => {
      const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
      mockSearchParams = new URLSearchParams()

      mockUseAuth.mockReturnValue({
        user: testUser,
        isLoading: false,
        verifyMagicLink: vi.fn(),
      })

      render(
        <Router>
          <AuthCallbackPage />
        </Router>
      )

      vi.runAllTimers()

      expect(consoleLogSpy).toHaveBeenCalledWith('🔄 Redirecting to default week')

      consoleLogSpy.mockRestore()
    })
  })
})
