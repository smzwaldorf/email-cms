/**
 * 速率限制服務 - 防止濫用上傳
 * Rate Limiter Service - Prevent upload abuse
 *
 * 配置:
 * - 每小時最多 20 次上傳 (per user)
 * - 每分鐘最多 3 次上傳 (burst protection)
 * - 滑動時間窗口
 */

interface RateLimitConfig {
  maxUploadsPerHour: number
  maxUploadsPerMinute: number
  hourlyWindow: number // milliseconds
  minuteWindow: number // milliseconds
}

interface UploadRecord {
  timestamp: number
  count: number
}

interface RateLimitStatus {
  allowed: boolean
  remaining: number
  resetIn: number // milliseconds
  message: string
}

// 預設配置
const DEFAULT_CONFIG: RateLimitConfig = {
  maxUploadsPerHour: 20, // 每小時最多 20 次
  maxUploadsPerMinute: 3, // 每分鐘最多 3 次
  hourlyWindow: 60 * 60 * 1000, // 1 小時
  minuteWindow: 60 * 1000, // 1 分鐘
}

// 使用者上傳記錄 (存儲在記憶體，生產環境應使用 Redis)
const uploadRecords = new Map<string, UploadRecord[]>()

/**
 * 檢查是否超過速率限制
 * Check if user exceeded rate limit
 */
export function checkRateLimit(userId: string, config: Partial<RateLimitConfig> = {}): RateLimitStatus {
  const finalConfig = { ...DEFAULT_CONFIG, ...config }
  const now = Date.now()

  // 初始化使用者記錄
  if (!uploadRecords.has(userId)) {
    uploadRecords.set(userId, [])
  }

  const records = uploadRecords.get(userId)!

  // 移除過期記錄 (超過 1 小時)
  const validRecords = records.filter((record) => now - record.timestamp < finalConfig.hourlyWindow)
  uploadRecords.set(userId, validRecords)

  // 計算最近 1 小時的上傳次數
  const hourlyUploads = validRecords.filter(
    (record) => now - record.timestamp < finalConfig.hourlyWindow
  ).length

  // 計算最近 1 分鐘的上傳次數
  const minuteUploads = validRecords.filter(
    (record) => now - record.timestamp < finalConfig.minuteWindow
  ).length

  // 檢查限制
  const exceededHourlyLimit = hourlyUploads >= finalConfig.maxUploadsPerHour
  const exceededMinuteLimit = minuteUploads >= finalConfig.maxUploadsPerMinute

  if (exceededMinuteLimit) {
    const oldestRecord = validRecords.reduce((oldest, current) =>
      current.timestamp < oldest.timestamp ? current : oldest
    )
    const resetIn = oldestRecord.timestamp + finalConfig.minuteWindow - now

    const message = `速率限制: 請在 ${Math.ceil(resetIn / 1000)} 秒後再試 (每分鐘最多 ${finalConfig.maxUploadsPerMinute} 次上傳)`
    logRateLimitEvent(userId, 'MINUTE_LIMIT_EXCEEDED', message)

    return {
      allowed: false,
      remaining: 0,
      resetIn,
      message,
    }
  }

  if (exceededHourlyLimit) {
    const oldestRecord = validRecords.reduce((oldest, current) =>
      current.timestamp < oldest.timestamp ? current : oldest
    )
    const resetIn = oldestRecord.timestamp + finalConfig.hourlyWindow - now

    const message = `速率限制: 今小時內已達到上傳限制 (${finalConfig.maxUploadsPerHour} 次)。請在 ${Math.ceil(resetIn / 60000)} 分鐘後重試`
    logRateLimitEvent(userId, 'HOUR_LIMIT_EXCEEDED', message)

    return {
      allowed: false,
      remaining: 0,
      resetIn,
      message,
    }
  }

  // 允許上傳
  const remaining = finalConfig.maxUploadsPerHour - hourlyUploads

  return {
    allowed: true,
    remaining,
    resetIn: 0,
    message: `允許上傳 (剩餘: ${remaining}/${finalConfig.maxUploadsPerHour} 次)`,
  }
}

/**
 * 記錄上傳嘗試
 * Record upload attempt
 */
export function recordUploadAttempt(userId: string): void {
  const now = Date.now()

  if (!uploadRecords.has(userId)) {
    uploadRecords.set(userId, [])
  }

  const records = uploadRecords.get(userId)!

  // 清理過期記錄
  const validRecords = records.filter((record) => now - record.timestamp < DEFAULT_CONFIG.hourlyWindow)

  // 添加新記錄
  validRecords.push({ timestamp: now, count: 1 })
  uploadRecords.set(userId, validRecords)

  logRateLimitEvent(userId, 'UPLOAD_RECORDED', `上傳已記錄 (總計: ${validRecords.length})`)
}

/**
 * 重置使用者的速率限制
 * Reset user rate limit (admin only)
 */
export function resetUserRateLimit(userId: string): void {
  uploadRecords.delete(userId)
  logRateLimitEvent(userId, 'RATE_LIMIT_RESET', '速率限制已重置')
}

/**
 * 取得使用者的速率限制統計
 * Get user rate limit statistics
 */
export function getUserRateLimitStats(userId: string) {
  const records = uploadRecords.get(userId) || []
  const now = Date.now()

  const hourlyUploads = records.filter(
    (record) => now - record.timestamp < DEFAULT_CONFIG.hourlyWindow
  ).length

  const minuteUploads = records.filter(
    (record) => now - record.timestamp < DEFAULT_CONFIG.minuteWindow
  ).length

  return {
    totalRecords: records.length,
    hourlyUploads,
    minuteUploads,
    hourlyLimit: DEFAULT_CONFIG.maxUploadsPerHour,
    minuteLimit: DEFAULT_CONFIG.maxUploadsPerMinute,
    hourlyRemaining: Math.max(0, DEFAULT_CONFIG.maxUploadsPerHour - hourlyUploads),
    minuteRemaining: Math.max(0, DEFAULT_CONFIG.maxUploadsPerMinute - minuteUploads),
  }
}

/**
 * 記錄速率限制事件（用於監控和日誌）
 * Log rate limit events for monitoring
 */
function logRateLimitEvent(userId: string, eventType: string, message: string): void {
  const timestamp = new Date().toISOString()
  const isDevelopment = import.meta.env.DEV

  if (isDevelopment) {
    // 開發環境: 彩色控制臺輸出
    console.log(
      `%c[RateLimit] ${timestamp} - ${eventType}`,
      'color: #FF6B6B; font-weight: bold'
    )
    console.log(`%cUser: ${userId}`, 'color: #4ECDC4')
    console.log(`%cMessage: ${message}`, 'color: #95E1D3')
  } else {
    // 生產環境: 簡化輸出 (可發送到錯誤追蹤服務)
    if (eventType.includes('EXCEEDED')) {
      console.warn(`[RateLimit] ${eventType} for user ${userId}`)
    } else if (eventType === 'UPLOAD_RECORDED') {
      // 不記錄每次上傳
    } else {
      console.log(`[RateLimit] ${eventType} for user ${userId}`)
    }
  }
}

/**
 * 清理所有過期記錄 (可定期調用，例如每 30 分鐘)
 * Clean up expired records
 */
export function cleanupExpiredRecords(): number {
  const now = Date.now()
  let cleanedCount = 0

  for (const [userId, records] of uploadRecords.entries()) {
    const validRecords = records.filter((record) => now - record.timestamp < DEFAULT_CONFIG.hourlyWindow)

    if (validRecords.length < records.length) {
      cleanedCount += records.length - validRecords.length
      uploadRecords.set(userId, validRecords)
    }

    // 如果使用者沒有記錄，刪除整個條目
    if (validRecords.length === 0) {
      uploadRecords.delete(userId)
    }
  }

  if (cleanedCount > 0 && import.meta.env.PROD) {
    console.log(`[RateLimit] Cleaned up ${cleanedCount} expired records`)
  }

  return cleanedCount
}

/**
 * 獲取全局速率限制統計 (僅用於管理)
 * Get global rate limit statistics
 */
export function getGlobalRateLimitStats() {
  return {
    totalUsers: uploadRecords.size,
    totalRecords: Array.from(uploadRecords.values()).reduce((sum, records) => sum + records.length, 0),
    config: DEFAULT_CONFIG,
  }
}

export type { RateLimitConfig, RateLimitStatus }
