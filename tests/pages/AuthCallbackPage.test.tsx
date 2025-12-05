/**
 * AuthCallbackPage Component Tests
 * Tests for auth callback page with redirect URL parameter
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { BrowserRouter as Router } from 'react-router-dom'
import { AuthCallbackPage } from '@/pages/AuthCallbackPage'
import WeekService from '@/services/WeekService'

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

// Mock WeekService
vi.mock('@/services/WeekService', () => ({
  default: {
    getLatestPublishedWeek: vi.fn(),
    getAllWeeks: vi.fn(),
  },
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

    // Mock WeekService to return a default week
    vi.mocked(WeekService.getLatestPublishedWeek).mockResolvedValue({
      week_number: '2025-W43',
      release_date: '2025-10-27',
      is_published: true,
      created_at: '2025-10-27T00:00:00Z',
      updated_at: '2025-10-27T00:00:00Z',
    } as any)
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

    it('navigates to latest week from database when no redirect_to param', async () => {
      vi.useRealTimers()
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

      // Wait for navigation to be called
      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/week/2025-W43')
      }, { timeout: 2000 })

      vi.useFakeTimers()
    })

    it('handles empty redirect_to as falsy and uses latest week from database', async () => {
      vi.useRealTimers()
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

      // Wait for navigation to be called
      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/week/2025-W43')
      }, { timeout: 2000 })

      vi.useFakeTimers()
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

    it('handles different week numbers', async () => {
      const weeks = ['2025-W40', '2025-W50', '2026-W01']

      for (const week of weeks) {
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
      }
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

  describe('error handling', () => {
    it('shows error page when no weeks are available in database', async () => {
      vi.useRealTimers()
      mockSearchParams = new URLSearchParams()

      mockUseAuth.mockReturnValue({
        user: testUser,
        isLoading: false,
        verifyMagicLink: vi.fn(),
      })

      // Mock WeekService to return no weeks
      vi.mocked(WeekService.getLatestPublishedWeek).mockResolvedValue(null)
      vi.mocked(WeekService.getAllWeeks).mockResolvedValue([])

      render(
        <Router>
          <AuthCallbackPage />
        </Router>
      )

      // Wait for error status to be displayed
      await waitFor(() => {
        expect(screen.getByText(/驗證失敗/i)).toBeInTheDocument()
        expect(screen.getByText(/No newsletter weeks available/i)).toBeInTheDocument()
      }, { timeout: 2000 })

      expect(mockNavigate).not.toHaveBeenCalledWith(expect.stringMatching(/^\/week/))

      vi.useFakeTimers()
    })

    it('shows error page when WeekService fails to fetch weeks', async () => {
      vi.useRealTimers()
      mockSearchParams = new URLSearchParams()

      mockUseAuth.mockReturnValue({
        user: testUser,
        isLoading: false,
        verifyMagicLink: vi.fn(),
      })

      // Mock WeekService to throw error
      vi.mocked(WeekService.getLatestPublishedWeek).mockRejectedValue(new Error('Database error'))

      render(
        <Router>
          <AuthCallbackPage />
        </Router>
      )

      // Wait for error status to be displayed
      await waitFor(() => {
        expect(screen.getByText(/驗證失敗/i)).toBeInTheDocument()
        expect(screen.getByText(/Failed to load newsletter weeks/i)).toBeInTheDocument()
      }, { timeout: 2000 })

      expect(mockNavigate).not.toHaveBeenCalledWith(expect.stringMatching(/^\/week/))

      vi.useFakeTimers()
    })
  })

  describe('logging', () => {
    it('logs auth callback initialization and error checks', () => {
      const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
      mockSearchParams = new URLSearchParams()

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

      // Should log initialization
      expect(consoleLogSpy).toHaveBeenCalledWith('🔄 Auth callback handler initiated')
      expect(consoleLogSpy).toHaveBeenCalledWith('📍 URL hash:', 'none')
      expect(consoleLogSpy).toHaveBeenCalledWith('📍 Redirect destination from params:', 'none')

      consoleLogSpy.mockRestore()
    })
  })
})
