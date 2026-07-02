/**
 * CSRF 保護服務 - 防止跨網站請求偽造
 * CSRF Protection Service - Prevent Cross-Site Request Forgery
 */

/**
 * CSRF 令牌配置
 * CSRF token configuration
 */
export const CSRF_CONFIG = {
  HEADER_NAME: 'X-CSRF-Token',
  COOKIE_NAME: 'csrf-token',
  TOKEN_LENGTH: 32, // 32 bytes = 64 hex characters
  TOKEN_EXPIRY: 24 * 60 * 60 * 1000, // 24 hours in milliseconds
} as const

/**
 * CSRF 令牌元資料
 * CSRF token metadata
 */
export interface CSRFToken {
  token: string
  createdAt: number
  expiresAt: number
  isValid: boolean
}

/**
 * CSRF 驗證結果
 * CSRF validation result
 */
export interface CSRFValidationResult {
  valid: boolean
  message: string
  token?: string
}

/**
 * CSRF 保護服務類
 * CSRF Protection Service class
 */
class CSRFProtectionService {
  private tokens: Map<string, CSRFToken> = new Map()

  /**
   * 生成新的 CSRF 令牌
   * Generate new CSRF token
   */
  generateToken(): string {
    // 生成隨機字符串
    // Generate random string
    const bytes = new Uint8Array(CSRF_CONFIG.TOKEN_LENGTH)
    crypto.getRandomValues(bytes)
    const token = Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')

    // 儲存令牌與過期時間
    // Store token with expiration
    const now = Date.now()
    this.tokens.set(token, {
      token,
      createdAt: now,
      expiresAt: now + CSRF_CONFIG.TOKEN_EXPIRY,
      isValid: true,
    })

    // 清理過期令牌
    // Clean up expired tokens
    this._cleanupExpiredTokens()

    return token
  }

  /**
   * 驗證 CSRF 令牌
   * Validate CSRF token
   */
  validateToken(token: string): CSRFValidationResult {
    if (!token) {
      return {
        valid: false,
        message: '未提供 CSRF 令牌 / CSRF token not provided',
      }
    }

    const tokenData = this.tokens.get(token)

    if (!tokenData) {
      return {
        valid: false,
        message: 'CSRF 令牌無效或不存在 / CSRF token is invalid or does not exist',
      }
    }

    if (!tokenData.isValid) {
      return {
        valid: false,
        message: 'CSRF 令牌已被使用 / CSRF token has been used',
      }
    }

    if (Date.now() > tokenData.expiresAt) {
      tokenData.isValid = false
      return {
        valid: false,
        message: 'CSRF 令牌已過期 / CSRF token has expired',
      }
    }

    // 令牌驗證成功，標記為已使用
    // Token validation successful, mark as used
    tokenData.isValid = false

    return {
      valid: true,
      message: '令牌驗證成功 / Token validation successful',
      token,
    }
  }

  /**
   * 取得有效令牌的數量
   * Get count of valid tokens
   */
  getActiveTokenCount(): number {
    return Array.from(this.tokens.values()).filter((t) => t.isValid).length
  }

  /**
   * 清理過期令牌
   * Clean up expired tokens
   */
  private _cleanupExpiredTokens(): void {
    const now = Date.now()
    for (const [token, data] of this.tokens.entries()) {
      if (now > data.expiresAt) {
        this.tokens.delete(token)
      }
    }
  }

  /**
   * 取得所有令牌統計（用於監控）
   * Get all token statistics (for monitoring)
   */
  getTokenStats(): {
    total: number
    valid: number
    expired: number
    used: number
  } {
    const now = Date.now()
    let valid = 0
    let expired = 0
    let used = 0

    for (const token of this.tokens.values()) {
      if (!token.isValid) {
        used++
      } else if (now > token.expiresAt) {
        expired++
      } else {
        valid++
      }
    }

    return {
      total: this.tokens.size,
      valid,
      expired,
      used,
    }
  }

  /**
   * 強制重置所有令牌（用於登出）
   * Force reset all tokens (for logout)
   */
  resetAllTokens(): void {
    this.tokens.clear()
  }
}

/**
 * 全域 CSRF 保護服務實例
 * Global CSRF protection service instance
 */
export const csrfProtection = new CSRFProtectionService()

/**
 * 從請求頭中提取 CSRF 令牌
 * Extract CSRF token from request headers
 */
export function extractCSRFToken(headers: Record<string, string>): string | null {
  // Check for exact match first
  if (headers[CSRF_CONFIG.HEADER_NAME]) {
    return headers[CSRF_CONFIG.HEADER_NAME]
  }

  // Check case-insensitive
  const lowerHeaderName = CSRF_CONFIG.HEADER_NAME.toLowerCase()
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === lowerHeaderName) {
      return value
    }
  }

  return null
}

/**
 * 建立 CSRF 保護的請求頭
 * Create CSRF-protected request headers
 */
export function createCSRFHeaders(token: string): Record<string, string> {
  return {
    [CSRF_CONFIG.HEADER_NAME]: token,
    'Content-Type': 'application/json',
  }
}
