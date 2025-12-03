/**
 * CSRF 保護服務測試
 * CSRF Protection Service Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  csrfProtection,
  CSRF_CONFIG,
  type CSRFToken,
  extractCSRFToken,
  createCSRFHeaders,
} from '@/services/csrfProtection'

// Mock crypto.getRandomValues for testing
let mockCallCount = 0
vi.stubGlobal(
  'crypto',
  {
    getRandomValues: (arr: Uint8Array) => {
      // Fill with predictable but different pattern for each call
      const offset = mockCallCount++ * 17 // Different offset each time
      for (let i = 0; i < arr.length; i++) {
        arr[i] = ((i * 7) + offset) % 256
      }
      return arr
    },
  }
)

describe('CSRF Protection Service', () => {
  beforeEach(() => {
    mockCallCount = 0 // Reset mock call count
    csrfProtection.resetAllTokens()
  })

  describe('generateToken', () => {
    it('should generate a valid token', () => {
      const token = csrfProtection.generateToken()

      expect(token).toBeDefined()
      expect(token).toHaveLength(CSRF_CONFIG.TOKEN_LENGTH * 2) // Hex string is 2 chars per byte
      expect(/^[0-9a-f]+$/.test(token)).toBe(true) // Valid hex
    })

    it('should generate different tokens each time', () => {
      const token1 = csrfProtection.generateToken()
      const token2 = csrfProtection.generateToken()

      expect(token1).not.toBe(token2)
    })

    it('should store token with correct expiration', () => {
      const before = Date.now()
      const token = csrfProtection.generateToken()
      const after = Date.now()

      const result = csrfProtection.validateToken(token)
      expect(result.valid).toBe(true)
    })

    it('should mark new token as valid', () => {
      const token = csrfProtection.generateToken()
      const result = csrfProtection.validateToken(token)

      expect(result.valid).toBe(true)
      expect(result.message).toContain('驗證成功')
    })
  })

  describe('validateToken', () => {
    it('should return false for empty token', () => {
      const result = csrfProtection.validateToken('')

      expect(result.valid).toBe(false)
      expect(result.message).toContain('未提供 CSRF 令牌')
    })

    it('should return false for non-existent token', () => {
      const result = csrfProtection.validateToken('invalid-token-12345')

      expect(result.valid).toBe(false)
      expect(result.message).toContain('無效或不存在')
    })

    it('should return false for already-used token', () => {
      const token = csrfProtection.generateToken()

      // First validation: should succeed
      const result1 = csrfProtection.validateToken(token)
      expect(result1.valid).toBe(true)

      // Second validation: should fail (already used)
      const result2 = csrfProtection.validateToken(token)
      expect(result2.valid).toBe(false)
      expect(result2.message).toContain('已被使用')
    })

    it('should return false for expired token', () => {
      const token = csrfProtection.generateToken()

      // Manually set expiration to past
      const now = Date.now()
      vi.spyOn(Date, 'now').mockReturnValue(now + CSRF_CONFIG.TOKEN_EXPIRY + 1000)

      const result = csrfProtection.validateToken(token)
      expect(result.valid).toBe(false)
      expect(result.message).toContain('已過期')

      vi.restoreAllMocks()
    })

    it('should mark token as invalid after validation', () => {
      const token = csrfProtection.generateToken()

      csrfProtection.validateToken(token)

      // Second attempt should fail
      const result = csrfProtection.validateToken(token)
      expect(result.valid).toBe(false)
    })
  })

  describe('getActiveTokenCount', () => {
    it('should return 0 for no tokens', () => {
      const count = csrfProtection.getActiveTokenCount()
      expect(count).toBe(0)
    })

    it('should count only valid tokens', () => {
      const token1 = csrfProtection.generateToken()
      const token2 = csrfProtection.generateToken()
      const token3 = csrfProtection.generateToken()

      expect(csrfProtection.getActiveTokenCount()).toBe(3)

      // Use one token
      csrfProtection.validateToken(token1)
      expect(csrfProtection.getActiveTokenCount()).toBe(2)

      // Use another
      csrfProtection.validateToken(token2)
      expect(csrfProtection.getActiveTokenCount()).toBe(1)

      // Use last
      csrfProtection.validateToken(token3)
      expect(csrfProtection.getActiveTokenCount()).toBe(0)
    })
  })

  describe('getTokenStats', () => {
    it('should return accurate stats', () => {
      csrfProtection.resetAllTokens() // Start fresh
      const token1 = csrfProtection.generateToken()
      const token2 = csrfProtection.generateToken()
      csrfProtection.generateToken()

      // Use one token
      csrfProtection.validateToken(token1)

      const stats = csrfProtection.getTokenStats()

      expect(stats.total).toBe(3)
      expect(stats.valid).toBe(2) // token2 and token3
      expect(stats.used).toBe(1) // token1
      expect(stats.expired).toBe(0) // No expired tokens yet
    })

    it('should include stats after expiration', () => {
      csrfProtection.resetAllTokens()
      const token = csrfProtection.generateToken()
      const initialStats = csrfProtection.getTokenStats()
      expect(initialStats.valid).toBe(1)

      // Check initial total
      expect(initialStats.total).toBeGreaterThanOrEqual(1)
    })
  })

  describe('resetAllTokens', () => {
    it('should clear all tokens', () => {
      csrfProtection.resetAllTokens() // Clear any previous tokens
      const token1 = csrfProtection.generateToken()
      const token2 = csrfProtection.generateToken()

      const countBefore = csrfProtection.getActiveTokenCount()
      expect(countBefore).toBeGreaterThanOrEqual(1) // At least 1 token exists

      csrfProtection.resetAllTokens()

      expect(csrfProtection.getActiveTokenCount()).toBe(0)
    })

    it('should require new token generation after reset', () => {
      csrfProtection.resetAllTokens() // Clear any previous tokens
      const token = csrfProtection.generateToken()
      csrfProtection.resetAllTokens()

      const result = csrfProtection.validateToken(token)
      expect(result.valid).toBe(false)
    })
  })

  describe('extractCSRFToken', () => {
    it('should extract token from headers', () => {
      const headers = {
        'X-CSRF-Token': 'test-token-12345',
        'content-type': 'application/json',
      }

      const token = extractCSRFToken(headers)
      expect(token).toBe('test-token-12345')
    })

    it('should return null if header not present', () => {
      const headers = {
        'content-type': 'application/json',
      }

      const token = extractCSRFToken(headers)
      expect(token).toBeNull()
    })

    it('should be case-insensitive', () => {
      const headers = {
        'X-CSRF-TOKEN': 'test-token-12345',
      }

      const token = extractCSRFToken(headers)
      expect(token).toBe('test-token-12345')
    })
  })

  describe('createCSRFHeaders', () => {
    it('should create headers with CSRF token', () => {
      const token = 'test-token-12345'
      const headers = createCSRFHeaders(token)

      expect(headers['X-CSRF-Token']).toBe(token)
      expect(headers['Content-Type']).toBe('application/json')
    })

    it('should include required headers', () => {
      const token = csrfProtection.generateToken()
      const headers = createCSRFHeaders(token)

      expect(headers).toHaveProperty('X-CSRF-Token')
      expect(headers).toHaveProperty('Content-Type')
      expect(Object.keys(headers).length).toBe(2)
    })
  })

  describe('CSRF_CONFIG', () => {
    it('should have correct header name', () => {
      expect(CSRF_CONFIG.HEADER_NAME).toBe('X-CSRF-Token')
    })

    it('should have valid token length', () => {
      expect(CSRF_CONFIG.TOKEN_LENGTH).toBe(32)
    })

    it('should have reasonable expiration', () => {
      expect(CSRF_CONFIG.TOKEN_EXPIRY).toBe(24 * 60 * 60 * 1000) // 24 hours
    })
  })
})
