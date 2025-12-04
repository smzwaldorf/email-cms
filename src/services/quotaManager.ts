/**
 * 儲存配額管理服務 - 限制每個使用者的儲存空間
 * Storage Quota Manager Service - Limit per-user storage space
 */

import { getSupabaseClient } from '@/lib/supabase'

/**
 * 儲存配額設定
 * Storage quota configuration (in bytes)
 */
export const STORAGE_QUOTA_CONFIG = {
  PER_USER_STORAGE_QUOTA: 500 * 1024 * 1024, // 500MB per user
  WARNING_THRESHOLD: 0.8, // Warn at 80% usage
  ABSOLUTE_LIMIT_THRESHOLD: 0.95, // Block at 95% usage
} as const

/**
 * 使用者儲存配額統計
 * User storage quota statistics
 */
export interface UserStorageStats {
  userId: string
  totalUsedBytes: number
  quotaLimitBytes: number
  remainingBytes: number
  usagePercentage: number
  isNearLimit: boolean
  isAtLimit: boolean
}

/**
 * 配額檢查結果
 * Quota check result
 */
export interface QuotaCheckResult {
  allowed: boolean
  message: string
  stats: UserStorageStats
}

/**
 * 儲存配額管理器類
 * Storage Quota Manager class
 */
class StorageQuotaManager {
  /**
   * 獲取使用者的儲存統計資訊
   * Get user's storage statistics
   */
  async getUserStorageStats(userId: string): Promise<UserStorageStats> {
    const supabaseClient = getSupabaseClient()

    // 查詢使用者上傳的所有媒體檔案大小
    // Query total file size of user's uploaded media
    const { data, error } = await supabaseClient
      .from('media_files')
      .select('file_size')
      .eq('uploaded_by', userId)

    if (error) {
      console.error('Failed to get user storage stats:', error)
      // Return default stats if query fails
      return {
        userId,
        totalUsedBytes: 0,
        quotaLimitBytes: STORAGE_QUOTA_CONFIG.PER_USER_STORAGE_QUOTA,
        remainingBytes: STORAGE_QUOTA_CONFIG.PER_USER_STORAGE_QUOTA,
        usagePercentage: 0,
        isNearLimit: false,
        isAtLimit: false,
      }
    }

    const totalUsedBytes = (data || []).reduce(
      (sum: number, file: any) => sum + (file.file_size || 0),
      0
    )

    const quotaLimitBytes = STORAGE_QUOTA_CONFIG.PER_USER_STORAGE_QUOTA
    const remainingBytes = Math.max(0, quotaLimitBytes - totalUsedBytes)
    const usagePercentage = (totalUsedBytes / quotaLimitBytes) * 100
    const isNearLimit =
      usagePercentage >= STORAGE_QUOTA_CONFIG.WARNING_THRESHOLD * 100
    const isAtLimit =
      usagePercentage >= STORAGE_QUOTA_CONFIG.ABSOLUTE_LIMIT_THRESHOLD * 100

    return {
      userId,
      totalUsedBytes,
      quotaLimitBytes,
      remainingBytes,
      usagePercentage,
      isNearLimit,
      isAtLimit,
    }
  }

  /**
   * 檢查是否可以上傳檔案
   * Check if user can upload file
   */
  async checkQuota(userId: string, fileSizeBytes: number): Promise<QuotaCheckResult> {
    const stats = await this.getUserStorageStats(userId)

    if (fileSizeBytes > stats.remainingBytes) {
      return {
        allowed: false,
        message: `檔案大小 (${this._formatBytes(fileSizeBytes)}) 超過剩餘空間 (${this._formatBytes(stats.remainingBytes)}) / File size exceeds remaining quota. Need ${this._formatBytes(fileSizeBytes)}, but only ${this._formatBytes(stats.remainingBytes)} available`,
        stats,
      }
    }

    if (stats.isAtLimit) {
      return {
        allowed: false,
        message: `儲存空間已滿。您已使用 ${this._formatBytes(stats.totalUsedBytes)} / ${this._formatBytes(stats.quotaLimitBytes)} / Storage quota exceeded. You have used ${this._formatBytes(stats.totalUsedBytes)} / ${this._formatBytes(stats.quotaLimitBytes)}`,
        stats,
      }
    }

    const resultStats = {
      ...stats,
      remainingBytes: stats.remainingBytes - fileSizeBytes,
      totalUsedBytes: stats.totalUsedBytes + fileSizeBytes,
      usagePercentage:
        ((stats.totalUsedBytes + fileSizeBytes) / stats.quotaLimitBytes) * 100,
    }

    if (resultStats.usagePercentage >= STORAGE_QUOTA_CONFIG.WARNING_THRESHOLD * 100) {
      return {
        allowed: true,
        message: `警告：儲存空間即將滿。上傳後將使用 ${resultStats.usagePercentage.toFixed(1)}% / Warning: Storage space is running low. After upload, you will use ${resultStats.usagePercentage.toFixed(1)}%`,
        stats: resultStats,
      }
    }

    return {
      allowed: true,
      message: '可以上傳 / Upload allowed',
      stats: resultStats,
    }
  }

  /**
   * 格式化位元組為可讀文字
   * Format bytes to human-readable text
   */
  private _formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B'

    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))

    return (bytes / Math.pow(k, i)).toFixed(2) + ' ' + sizes[i]
  }
}

export const quotaManager = new StorageQuotaManager()
