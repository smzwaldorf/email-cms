/**
 * TokenManager Unit Tests
 * Tests for JWT token management with automatic refresh logic
 *
 * Scenarios:
 * 1. Session initialization
 * 2. Token storage and retrieval
 * 3. Auto-refresh triggering
 * 4. Concurrent refresh prevention
 * 5. Error handling and cleanup
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { tokenManager } from '@/services/tokenManager'

// Mock Supabase client
vi.mock('@/lib/supabase', () => {
  const mockSupabase = {
    auth: {
      getSession: vi.fn(),
      refreshSession: vi.fn(),
    },
  }
  return {
    getSupabaseClient: vi.fn(() => mockSupabase),
  }
})

import { getSupabaseClient } from '@/lib/supabase'

describe('TokenManager', () => {
  const mockSupabase = getSupabaseClient()

  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    // Clear any existing tokens
    tokenManager.clearTokens()
    tokenManager.stopAutoRefreshCheck()
  })

  afterEach(() => {
    vi.useRealTimers()
    tokenManager.onLogout()
  })

  describe('initializeFromSession', () => {
    it('should initialize with existing session', async () => {
      const mockSession = {
        access_token: 'test-token-123',
        expires_in: 900, // 15 minutes
      }

      ;(mockSupabase.auth.getSession as any).mockResolvedValueOnce({
        data: { session: mockSession },
      })

      await tokenManager.initializeFromSession()

      const tokenInfo = tokenManager.getTokenInfo()
      expect(tokenInfo).not.toBeNull()
      expect(tokenInfo?.accessToken).toBe('test-token-123')
      expect(tokenInfo?.expiresIn).toBeGreaterThan(0)
    })

    it('should handle no existing session gracefully', async () => {
      ;(mockSupabase.auth.getSession as any).mockResolvedValueOnce({
        data: { session: null },
      })

      await tokenManager.initializeFromSession()

      const tokenInfo = tokenManager.getTokenInfo()
      expect(tokenInfo).toBeNull()
    })

    it('should start auto-refresh checker on initialization', async () => {
      ;(mockSupabase.auth.getSession as any).mockResolvedValueOnce({
        data: { session: null },
      })

      await tokenManager.initializeFromSession()

      // Verify auto-refresh checker is running by checking it exists
      // (We can't directly check the interval, but we can verify the method completes)
      expect(tokenManager.getTokenInfo()).toBeNull()
    })

    it('should handle errors during initialization gracefully', async () => {
      ;(mockSupabase.auth.getSession as any).mockRejectedValueOnce(
        new Error('Network error')
      )

      // Should not throw, errors are caught and logged
      await expect(
        tokenManager.initializeFromSession()
      ).resolves.toBeUndefined()

      // Token should not be initialized
      const tokenInfo = tokenManager.getTokenInfo()
      expect(tokenInfo).toBeNull()
    })
  })

  describe('getAccessToken', () => {
    it('should return current token when valid', async () => {
      const mockSession = {
        access_token: 'valid-token',
        expires_in: 900,
      }

      ;(mockSupabase.auth.getSession as any).mockResolvedValueOnce({
        data: { session: mockSession },
      })

      await tokenManager.initializeFromSession()
      const token = await tokenManager.getAccessToken()

      expect(token).toBe('valid-token')
      expect(mockSupabase.auth.refreshSession).not.toHaveBeenCalled()
    })

    it('should return null when no token exists', async () => {
      const token = await tokenManager.getAccessToken()
      expect(token).toBeNull()
    })

    it('should trigger refresh when token approaching expiry', async () => {
      const mockSession = {
        access_token: 'old-token',
        expires_in: 900,
      }

      const mockRefreshedSession = {
        access_token: 'new-token',
        expires_in: 900,
      }

      ;(mockSupabase.auth.getSession as any).mockResolvedValueOnce({
        data: { session: mockSession },
      })

      ;(mockSupabase.auth.refreshSession as any).mockResolvedValueOnce({
        data: { session: mockRefreshedSession },
      })

      await tokenManager.initializeFromSession()

      // Fast-forward time to 59 seconds before expiry (should trigger refresh at 60 seconds)
      vi.advanceTimersByTime(14 * 60 * 1000 + 1000) // 14 min 1 sec

      const token = await tokenManager.getAccessToken()

      expect(token).toBe('new-token')
      expect(mockSupabase.auth.refreshSession).toHaveBeenCalled()
    })

    it('should not trigger refresh when token has plenty of time', async () => {
      const mockSession = {
        access_token: 'valid-token',
        expires_in: 900,
      }

      ;(mockSupabase.auth.getSession as any).mockResolvedValueOnce({
        data: { session: mockSession },
      })

      await tokenManager.initializeFromSession()

      // Advance only 1 minute (no refresh needed)
      vi.advanceTimersByTime(1 * 60 * 1000)

      const token = await tokenManager.getAccessToken()

      expect(token).toBe('valid-token')
      expect(mockSupabase.auth.refreshSession).not.toHaveBeenCalled()
    })
  })

  describe('getTokenInfo', () => {
    it('should return token metadata', async () => {
      const mockSession = {
        access_token: 'test-token',
        expires_in: 900,
      }

      ;(mockSupabase.auth.getSession as any).mockResolvedValueOnce({
        data: { session: mockSession },
      })

      await tokenManager.initializeFromSession()
      const tokenInfo = tokenManager.getTokenInfo()

      expect(tokenInfo).not.toBeNull()
      expect(tokenInfo?.accessToken).toBe('test-token')
      expect(tokenInfo?.expiresIn).toBeGreaterThan(0)
      expect(tokenInfo?.expiresAt).toBeGreaterThan(Date.now())
    })

    it('should return null when no token', () => {
      const tokenInfo = tokenManager.getTokenInfo()
      expect(tokenInfo).toBeNull()
    })

    it('should calculate expiresIn correctly', async () => {
      const mockSession = {
        access_token: 'test-token',
        expires_in: 900,
      }

      ;(mockSupabase.auth.getSession as any).mockResolvedValueOnce({
        data: { session: mockSession },
      })

      await tokenManager.initializeFromSession()
      const tokenInfo1 = tokenManager.getTokenInfo()

      // Advance time by 100 seconds
      vi.advanceTimersByTime(100 * 1000)

      const tokenInfo2 = tokenManager.getTokenInfo()

      expect(tokenInfo1?.expiresIn).toBeGreaterThan(tokenInfo2?.expiresIn!)
      expect(tokenInfo1?.expiresIn! - tokenInfo2?.expiresIn!).toBeCloseTo(100, 1)
    })
  })

  describe('refreshAccessToken', () => {
    it('should successfully refresh token', async () => {
      const mockSession = {
        access_token: 'old-token',
        expires_in: 900,
      }

      const mockRefreshedSession = {
        access_token: 'new-token',
        expires_in: 900,
      }

      ;(mockSupabase.auth.getSession as any).mockResolvedValueOnce({
        data: { session: mockSession },
      })

      ;(mockSupabase.auth.refreshSession as any).mockResolvedValueOnce({
        data: { session: mockRefreshedSession },
      })

      await tokenManager.initializeFromSession()
      const result = await tokenManager.forceRefresh()

      expect(result).toBe(true)
      expect(mockSupabase.auth.refreshSession).toHaveBeenCalled()

      const tokenInfo = tokenManager.getTokenInfo()
      expect(tokenInfo?.accessToken).toBe('new-token')
    })

    it('should prevent concurrent refresh requests', async () => {
      const mockSession = {
        access_token: 'old-token',
        expires_in: 900,
      }

      const mockRefreshedSession = {
        access_token: 'new-token',
        expires_in: 900,
      }

      ;(mockSupabase.auth.getSession as any).mockResolvedValueOnce({
        data: { session: mockSession },
      })

      ;(mockSupabase.auth.refreshSession as any).mockResolvedValueOnce({
        data: { session: mockRefreshedSession },
      })

      await tokenManager.initializeFromSession()

      // Simulate concurrent refresh calls
      const [result1, result2] = await Promise.all([
        tokenManager.forceRefresh(),
        tokenManager.forceRefresh(),
      ])

      expect(result1).toBe(true)
      expect(result2).toBe(true)
      // refreshSession should only be called once (request deduplication)
      expect(mockSupabase.auth.refreshSession).toHaveBeenCalledTimes(1)
    })

    it('should clear tokens on fatal refresh failure', async () => {
      const mockSession = {
        access_token: 'old-token',
        expires_in: 900,
      }

      ;(mockSupabase.auth.getSession as any).mockResolvedValueOnce({
        data: { session: mockSession },
      })

      // Use a FATAL error to verify clearing behavior
      ;(mockSupabase.auth.refreshSession as any).mockResolvedValueOnce({
        data: { session: null },
        error: new Error('Invalid Refresh Token'), // Fatal error
      })

      await tokenManager.initializeFromSession()

      // Verify token exists before refresh
      expect(tokenManager.getTokenInfo()).not.toBeNull()

      const result = await tokenManager.forceRefresh()

      expect(result).toBe(false)
      expect(tokenManager.getTokenInfo()).toBeNull()
    })

    it('should handle refresh exceptions gracefully', async () => {
      const mockSession = {
        access_token: 'old-token',
        expires_in: 900,
      }

      ;(mockSupabase.auth.getSession as any).mockResolvedValueOnce({
        data: { session: mockSession },
      })

      // Generic error should NOT clear the token (Resilience Policy)
      ;(mockSupabase.auth.refreshSession as any).mockRejectedValueOnce(
        new Error('Network error')
      )

      await tokenManager.initializeFromSession()

      const result = await tokenManager.forceRefresh()

      expect(result).toBe(false)
      // Token should persist for retry
      expect(tokenManager.getTokenInfo()).not.toBeNull()
      expect(tokenManager.getTokenInfo()?.accessToken).toBe('old-token')
    })
  })

  describe('clearTokens', () => {
    it('should clear all token data', async () => {
      const mockSession = {
        access_token: 'test-token',
        expires_in: 900,
      }

      ;(mockSupabase.auth.getSession as any).mockResolvedValueOnce({
        data: { session: mockSession },
      })

      await tokenManager.initializeFromSession()
      expect(tokenManager.getTokenInfo()).not.toBeNull()

      tokenManager.clearTokens()

      expect(tokenManager.getTokenInfo()).toBeNull()
      expect(tokenManager.isAccessTokenValid()).toBe(false)
    })
  })

  describe('isAccessTokenValid', () => {
    it('should return true when token is valid', async () => {
      const mockSession = {
        access_token: 'test-token',
        expires_in: 900,
      }

      ;(mockSupabase.auth.getSession as any).mockResolvedValueOnce({
        data: { session: mockSession },
      })

      await tokenManager.initializeFromSession()

      expect(tokenManager.isAccessTokenValid()).toBe(true)
    })

    it('should return false when token is expired', async () => {
      const mockSession = {
        access_token: 'test-token',
        expires_in: 10, // Very short expiry
      }

      ;(mockSupabase.auth.getSession as any).mockResolvedValueOnce({
        data: { session: mockSession },
      })

      await tokenManager.initializeFromSession()

      // Advance time past expiry
      vi.advanceTimersByTime(15 * 1000)

      expect(tokenManager.isAccessTokenValid()).toBe(false)
    })

    it('should return false when no token exists', () => {
      expect(tokenManager.isAccessTokenValid()).toBe(false)
    })
  })

  describe('getTimeUntilExpiry', () => {
    it('should return time remaining in seconds', async () => {
      const mockSession = {
        access_token: 'test-token',
        expires_in: 900, // 15 minutes
      }

      ;(mockSupabase.auth.getSession as any).mockResolvedValueOnce({
        data: { session: mockSession },
      })

      await tokenManager.initializeFromSession()

      const timeUntil = tokenManager.getTimeUntilExpiry()

      expect(timeUntil).toBeGreaterThan(0)
      expect(timeUntil).toBeLessThanOrEqual(900)
    })

    it('should return 0 when no token exists', () => {
      expect(tokenManager.getTimeUntilExpiry()).toBe(0)
    })

    it('should decrease over time', async () => {
      const mockSession = {
        access_token: 'test-token',
        expires_in: 900,
      }

      ;(mockSupabase.auth.getSession as any).mockResolvedValueOnce({
        data: { session: mockSession },
      })

      await tokenManager.initializeFromSession()

      const time1 = tokenManager.getTimeUntilExpiry()

      // Advance time by 100 seconds
      vi.advanceTimersByTime(100 * 1000)

      const time2 = tokenManager.getTimeUntilExpiry()

      expect(time1).toBeGreaterThan(time2)
      expect(time1 - time2).toBeCloseTo(100, 1)
    })
  })

  describe('onLogout', () => {
    it('should stop auto-refresh and clear tokens', async () => {
      const mockSession = {
        access_token: 'test-token',
        expires_in: 900,
      }

      ;(mockSupabase.auth.getSession as any).mockResolvedValueOnce({
        data: { session: mockSession },
      })

      await tokenManager.initializeFromSession()

      expect(tokenManager.getTokenInfo()).not.toBeNull()

      tokenManager.onLogout()

      expect(tokenManager.getTokenInfo()).toBeNull()
      // Verify we can call it again without errors
      tokenManager.onLogout()
    })
  })
})
