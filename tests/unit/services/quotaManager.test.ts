/**
 * 儲存配額管理服務測試
 * Storage Quota Manager Service Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { quotaManager, STORAGE_QUOTA_CONFIG, type UserStorageStats } from '@/services/quotaManager'
import { getSupabaseClient } from '@/lib/supabase'

// Mock Supabase client
vi.mock('@/lib/supabase', () => ({
  getSupabaseClient: vi.fn(),
}))

describe('Storage Quota Manager', () => {
  const testUserId = 'test-user-123'
  const mockSupabaseClient = {
    from: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
    ;(getSupabaseClient as any).mockReturnValue(mockSupabaseClient)
  })

  describe('getUserStorageStats', () => {
    it('should return zero usage for new user with no files', async () => {
      mockSupabaseClient.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ data: [], error: null }),
        }),
      })

      const stats = await quotaManager.getUserStorageStats(testUserId)

      expect(stats.userId).toBe(testUserId)
      expect(stats.totalUsedBytes).toBe(0)
      expect(stats.remainingBytes).toBe(STORAGE_QUOTA_CONFIG.PER_USER_STORAGE_QUOTA)
      expect(stats.usagePercentage).toBe(0)
      expect(stats.isNearLimit).toBe(false)
      expect(stats.isAtLimit).toBe(false)
    })

    it('should calculate correct usage percentage', async () => {
      const fileSize = STORAGE_QUOTA_CONFIG.PER_USER_STORAGE_QUOTA / 2 // 50%
      mockSupabaseClient.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            data: [{ file_size: fileSize }],
            error: null,
          }),
        }),
      })

      const stats = await quotaManager.getUserStorageStats(testUserId)

      expect(stats.totalUsedBytes).toBe(fileSize)
      expect(stats.usagePercentage).toBe(50)
      expect(stats.isNearLimit).toBe(false)
      expect(stats.isAtLimit).toBe(false)
    })

    it('should mark as near limit at 80% usage', async () => {
      const fileSize = Math.floor(
        STORAGE_QUOTA_CONFIG.PER_USER_STORAGE_QUOTA * 0.82
      )
      mockSupabaseClient.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            data: [{ file_size: fileSize }],
            error: null,
          }),
        }),
      })

      const stats = await quotaManager.getUserStorageStats(testUserId)

      expect(stats.isNearLimit).toBe(true)
      expect(stats.isAtLimit).toBe(false)
    })

    it('should mark as at limit at 95% usage', async () => {
      const fileSize = Math.floor(
        STORAGE_QUOTA_CONFIG.PER_USER_STORAGE_QUOTA * 0.96
      )
      mockSupabaseClient.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            data: [{ file_size: fileSize }],
            error: null,
          }),
        }),
      })

      const stats = await quotaManager.getUserStorageStats(testUserId)

      expect(stats.isNearLimit).toBe(true)
      expect(stats.isAtLimit).toBe(true)
    })

    it('should handle database errors gracefully', async () => {
      mockSupabaseClient.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            data: null,
            error: { message: 'Database error' },
          }),
        }),
      })

      const stats = await quotaManager.getUserStorageStats(testUserId)

      expect(stats.totalUsedBytes).toBe(0)
      expect(stats.usagePercentage).toBe(0)
      expect(stats.isNearLimit).toBe(false)
      expect(stats.isAtLimit).toBe(false)
    })

    it('should sum multiple file sizes correctly', async () => {
      const file1Size = 100 * 1024 * 1024 // 100MB
      const file2Size = 50 * 1024 * 1024 // 50MB
      const totalSize = file1Size + file2Size

      mockSupabaseClient.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            data: [{ file_size: file1Size }, { file_size: file2Size }],
            error: null,
          }),
        }),
      })

      const stats = await quotaManager.getUserStorageStats(testUserId)

      expect(stats.totalUsedBytes).toBe(totalSize)
      expect(stats.remainingBytes).toBe(
        STORAGE_QUOTA_CONFIG.PER_USER_STORAGE_QUOTA - totalSize
      )
    })
  })

  describe('checkQuota', () => {
    it('should allow upload when under quota', async () => {
      const fileSize = 10 * 1024 * 1024 // 10MB
      mockSupabaseClient.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            data: [],
            error: null,
          }),
        }),
      })

      const result = await quotaManager.checkQuota(testUserId, fileSize)

      expect(result.allowed).toBe(true)
      expect(result.message).toBe('可以上傳 / Upload allowed')
      expect(result.stats.remainingBytes).toBeGreaterThan(0)
    })

    it('should reject upload when quota exceeded', async () => {
      const quotaSize = STORAGE_QUOTA_CONFIG.PER_USER_STORAGE_QUOTA
      mockSupabaseClient.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            data: [{ file_size: quotaSize }],
            error: null,
          }),
        }),
      })

      const fileSize = 10 * 1024 * 1024 // 10MB
      const result = await quotaManager.checkQuota(testUserId, fileSize)

      expect(result.allowed).toBe(false)
      // When quota is completely full, the message will say "exceeds remaining space" since remaining is 0 B
      expect(result.message).toContain('超過剩餘空間')
    })

    it('should reject upload when file exceeds remaining space', async () => {
      const existingSize = (STORAGE_QUOTA_CONFIG.PER_USER_STORAGE_QUOTA * 95) / 100
      mockSupabaseClient.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            data: [{ file_size: existingSize }],
            error: null,
          }),
        }),
      })

      const fileSize = 50 * 1024 * 1024 // 50MB (exceeds remaining)
      const result = await quotaManager.checkQuota(testUserId, fileSize)

      expect(result.allowed).toBe(false)
      expect(result.message).toContain('超過剩餘空間')
      expect(result.message).toContain('File size exceeds remaining quota')
    })

    it('should warn when upload will bring usage to 80%', async () => {
      const existingSize = (STORAGE_QUOTA_CONFIG.PER_USER_STORAGE_QUOTA * 70) / 100
      mockSupabaseClient.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            data: [{ file_size: existingSize }],
            error: null,
          }),
        }),
      })

      const fileSize = (STORAGE_QUOTA_CONFIG.PER_USER_STORAGE_QUOTA * 12) / 100 // Will total 82%
      const result = await quotaManager.checkQuota(testUserId, fileSize)

      expect(result.allowed).toBe(true)
      expect(result.message).toContain('警告')
      expect(result.message).toContain('82')
    })

    it('should calculate remaining bytes after upload', async () => {
      const existingSize = 100 * 1024 * 1024
      mockSupabaseClient.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            data: [{ file_size: existingSize }],
            error: null,
          }),
        }),
      })

      const fileSize = 50 * 1024 * 1024
      const result = await quotaManager.checkQuota(testUserId, fileSize)

      expect(result.stats.totalUsedBytes).toBe(existingSize + fileSize)
      expect(result.stats.remainingBytes).toBe(
        STORAGE_QUOTA_CONFIG.PER_USER_STORAGE_QUOTA - existingSize - fileSize
      )
    })
  })

  describe('quota configuration', () => {
    it('should have correct default quota limit', () => {
      expect(STORAGE_QUOTA_CONFIG.PER_USER_STORAGE_QUOTA).toBe(500 * 1024 * 1024) // 500MB
    })

    it('should have correct warning threshold', () => {
      expect(STORAGE_QUOTA_CONFIG.WARNING_THRESHOLD).toBe(0.8) // 80%
    })

    it('should have correct absolute limit threshold', () => {
      expect(STORAGE_QUOTA_CONFIG.ABSOLUTE_LIMIT_THRESHOLD).toBe(0.95) // 95%
    })
  })
})
