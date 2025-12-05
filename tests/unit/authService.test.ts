/**
 * Auth Service Unit Tests
 * Tests for magic link with redirect URL parameter
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { authService } from '@/services/authService'

// Mock Supabase client
vi.mock('@/lib/supabase', () => {
  const mockSupabase = {
    auth: {
      signInWithOtp: vi.fn(),
      signInWithPassword: vi.fn(),
      signInWithOAuth: vi.fn(),
      verifyOtp: vi.fn(),
      getSession: vi.fn(),
      signOut: vi.fn(),
      onAuthStateChange: vi.fn(),
    },
  }
  return {
    getSupabaseClient: vi.fn(() => mockSupabase),
  }
})

import { getSupabaseClient } from '@/lib/supabase'

describe('AuthService - Magic Link with Redirect', () => {
  const mockSupabase = getSupabaseClient()
  const testEmail = 'test@example.com'
  const testRedirectUrl = '/week/2025-W43/a001'

  beforeEach(() => {
    vi.clearAllMocks()
    // Reset window.location.origin for tests
    Object.defineProperty(window, 'location', {
      value: {
        origin: 'http://localhost:5173',
        pathname: '/',
        hash: '',
      },
      writable: true,
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('sendMagicLink', () => {
    it('should send magic link without redirect parameter', async () => {
      ;(mockSupabase.auth.signInWithOtp as any).mockResolvedValueOnce({ error: null })

      const result = await authService.sendMagicLink(testEmail)

      expect(result).toBe(true)
      expect(mockSupabase.auth.signInWithOtp).toHaveBeenCalledOnce()

      const callArgs = (mockSupabase.auth.signInWithOtp as any).mock.calls[0][0]
      expect(callArgs.email).toBe(testEmail)
      expect(callArgs.options.emailRedirectTo).toContain('http://localhost:5173/auth/callback')
      expect(callArgs.options.emailRedirectTo).not.toContain('redirect_to')
    })

    it('should send magic link with redirect parameter', async () => {
      ;(mockSupabase.auth.signInWithOtp as any).mockResolvedValueOnce({ error: null })

      const result = await authService.sendMagicLink(testEmail, testRedirectUrl)

      expect(result).toBe(true)
      expect(mockSupabase.auth.signInWithOtp).toHaveBeenCalledOnce()

      const callArgs = (mockSupabase.auth.signInWithOtp as any).mock.calls[0][0]
      expect(callArgs.email).toBe(testEmail)

      // Check that the redirect URL includes the redirect_to parameter
      const emailRedirectUrl = callArgs.options.emailRedirectTo
      expect(emailRedirectUrl).toContain('http://localhost:5173/auth/callback')
      expect(emailRedirectUrl).toContain(`redirect_to=${encodeURIComponent(testRedirectUrl)}`)
    })

    it('should properly encode redirect URL with special characters', async () => {
      ;(mockSupabase.auth.signInWithOtp as any).mockResolvedValueOnce({ error: null })

      const redirectWithSpecialChars = '/week/2025-W43/a001?param=value&other=123'
      await authService.sendMagicLink(testEmail, redirectWithSpecialChars)

      const callArgs = (mockSupabase.auth.signInWithOtp as any).mock.calls[0][0]
      const emailRedirectUrl = callArgs.options.emailRedirectTo

      // Verify the URL is properly encoded
      expect(emailRedirectUrl).toContain('redirect_to=')
      const urlObj = new URL(emailRedirectUrl)
      expect(urlObj.searchParams.get('redirect_to')).toBe(redirectWithSpecialChars)
    })

    it('should return false when magic link send fails', async () => {
      const mockError = new Error('Email service error')
      ;(mockSupabase.auth.signInWithOtp as any).mockResolvedValueOnce({ error: mockError })

      const result = await authService.sendMagicLink(testEmail, testRedirectUrl)

      expect(result).toBe(false)
    })

    it('should handle exceptions during magic link send', async () => {
      ;(mockSupabase.auth.signInWithOtp as any).mockRejectedValueOnce(
        new Error('Network error')
      )

      const result = await authService.sendMagicLink(testEmail, testRedirectUrl)

      expect(result).toBe(false)
    })

    it('should send magic link with complex redirect URL', async () => {
      ;(mockSupabase.auth.signInWithOtp as any).mockResolvedValueOnce({ error: null })

      const complexRedirectUrl = '/week/2025-W43/a001'
      await authService.sendMagicLink(testEmail, complexRedirectUrl)

      const callArgs = (mockSupabase.auth.signInWithOtp as any).mock.calls[0][0]
      const emailRedirectUrl = callArgs.options.emailRedirectTo

      // Verify URL construction
      const url = new URL(emailRedirectUrl)
      expect(url.pathname).toBe('/auth/callback')
      expect(url.searchParams.get('redirect_to')).toBe(complexRedirectUrl)
    })
  })

  describe('sendMagicLink - redirect URL variations', () => {
    it('should handle article short ID redirect', async () => {
      ;(mockSupabase.auth.signInWithOtp as any).mockResolvedValueOnce({ error: null })

      const articleRedirect = '/week/2025-W43/a001'
      await authService.sendMagicLink(testEmail, articleRedirect)

      const callArgs = (mockSupabase.auth.signInWithOtp as any).mock.calls[0][0]
      const url = new URL(callArgs.options.emailRedirectTo)

      expect(url.searchParams.get('redirect_to')).toBe(articleRedirect)
    })

    it('should handle different week numbers in redirect', async () => {
      ;(mockSupabase.auth.signInWithOtp as any).mockResolvedValueOnce({ error: null })

      const weeks = ['2025-W40', '2025-W50', '2026-W01']
      for (const week of weeks) {
        const redirect = `/week/${week}/a001`
        await authService.sendMagicLink(testEmail, redirect)

        const callArgs = (mockSupabase.auth.signInWithOtp as any).mock.calls.pop()[0]
        const url = new URL(callArgs.options.emailRedirectTo)

        expect(url.searchParams.get('redirect_to')).toBe(redirect)
      }
    })

    it('should handle root path redirect', async () => {
      ;(mockSupabase.auth.signInWithOtp as any).mockResolvedValueOnce({ error: null })

      await authService.sendMagicLink(testEmail, '/week/2025-W43')

      const callArgs = (mockSupabase.auth.signInWithOtp as any).mock.calls[0][0]
      const url = new URL(callArgs.options.emailRedirectTo)

      expect(url.searchParams.get('redirect_to')).toBe('/week/2025-W43')
    })
  })

  describe('sendMagicLink - error handling', () => {
    it('should log error when Supabase fails', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      ;(mockSupabase.auth.signInWithOtp as any).mockResolvedValueOnce({
        error: { message: 'Email not sent' },
      })

      await authService.sendMagicLink(testEmail, testRedirectUrl)

      expect(consoleErrorSpy).toHaveBeenCalledWith('❌ Magic link send error:', expect.any(Object))
      consoleErrorSpy.mockRestore()
    })

    it('should log when redirect URL is provided', async () => {
      const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
      ;(mockSupabase.auth.signInWithOtp as any).mockResolvedValueOnce({ error: null })

      await authService.sendMagicLink(testEmail, testRedirectUrl)

      expect(consoleLogSpy).toHaveBeenCalledWith('📍 Redirect destination:', testRedirectUrl)
      consoleLogSpy.mockRestore()
    })
  })
})
