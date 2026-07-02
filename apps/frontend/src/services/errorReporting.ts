/**
 * 服務 - 錯誤報告和監控
 * 用於記錄、追蹤和報告應用程式錯誤和問題
 * 驗證 SC-007：99.5% 直接連結成功率
 */

export interface ErrorLog {
  id: string
  timestamp: Date
  type: 'error' | 'warning' | 'info'
  message: string
  stackTrace?: string
  context?: Record<string, unknown>
  userAgent?: string
  url?: string
  severity: 'low' | 'medium' | 'high' | 'critical'
}

export interface ErrorMetrics {
  totalErrors: number
  errorsByType: Record<string, number>
  errorsByUrl: Record<string, number>
  errorsBySeverity: Record<string, number>
  directLinkSuccessRate: number // 0-100
  lastErrorTime?: Date
}

class ErrorReportingService {
  private errorLogs: ErrorLog[] = []
  private maxLogs = 1000 // 保留最近 1000 條日誌

  /**
   * 記錄一個錯誤
   */
  logError(
    message: string,
    options: {
      type?: 'error' | 'warning' | 'info'
      stackTrace?: string
      context?: Record<string, unknown>
      severity?: 'low' | 'medium' | 'high' | 'critical'
    } = {}
  ): ErrorLog {
    const errorLog: ErrorLog = {
      id: `error-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      type: options.type || 'error',
      message,
      stackTrace: options.stackTrace,
      context: options.context,
      severity: options.severity || 'medium',
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
      url: typeof window !== 'undefined' ? window.location.href : undefined,
    }

    this.errorLogs.push(errorLog)

    // 保持日誌數量在限制內
    if (this.errorLogs.length > this.maxLogs) {
      this.errorLogs = this.errorLogs.slice(-this.maxLogs)
    }

    // 在控制台中記錄
    this.logToConsole(errorLog)

    // 在實際應用中，這裡應該發送到遠程監控服務
    this.sendToRemoteService(errorLog)

    return errorLog
  }

  /**
   * 記錄 JavaScript 錯誤
   */
  captureException(error: Error, context?: Record<string, unknown>): ErrorLog {
    return this.logError(error.message, {
      type: 'error',
      stackTrace: error.stack,
      context,
      severity: 'high',
    })
  }

  /**
   * 記錄直接連結訪問嘗試
   */
  logDirectLinkAttempt(articleId: string, success: boolean): void {
    this.logError(
      `Direct link access: article=${articleId}, success=${success}`,
      {
        type: success ? 'info' : 'warning',
        context: { articleId, success },
        severity: success ? 'low' : 'medium',
      }
    )
  }

  /**
   * 計算直接連結成功率（用於驗證 SC-007）
   */
  calculateDirectLinkSuccessRate(): number {
    const directLinkLogs = this.errorLogs.filter(
      (log) => log.context?.['articleId'] !== undefined
    )

    if (directLinkLogs.length === 0) {
      return 100 // 如果沒有錯誤，視為 100% 成功率
    }

    const successCount = directLinkLogs.filter(
      (log) => log.context?.['success'] === true
    ).length

    return (successCount / directLinkLogs.length) * 100
  }

  /**
   * 獲取錯誤指標
   */
  getMetrics(): ErrorMetrics {
    const errorsByType: Record<string, number> = {}
    const errorsByUrl: Record<string, number> = {}
    const errorsBySeverity: Record<string, number> = {}

    this.errorLogs.forEach((log) => {
      errorsByType[log.type] = (errorsByType[log.type] || 0) + 1
      if (log.url) {
        errorsByUrl[log.url] = (errorsByUrl[log.url] || 0) + 1
      }
      errorsBySeverity[log.severity] = (errorsBySeverity[log.severity] || 0) + 1
    })

    return {
      totalErrors: this.errorLogs.length,
      errorsByType,
      errorsByUrl,
      errorsBySeverity,
      directLinkSuccessRate: this.calculateDirectLinkSuccessRate(),
      lastErrorTime: this.errorLogs[this.errorLogs.length - 1]?.timestamp,
    }
  }

  /**
   * 獲取所有錯誤日誌
   */
  getLogs(limit: number = 50): ErrorLog[] {
    return this.errorLogs.slice(-limit)
  }

  /**
   * 清除所有日誌
   */
  clearLogs(): void {
    this.errorLogs = []
  }

  /**
   * 在控制台中記錄錯誤
   */
  private logToConsole(errorLog: ErrorLog): void {
    const prefix = `[${errorLog.severity.toUpperCase()}]`
    const style =
      {
        low: 'color: #gray; font-weight: bold;',
        medium: 'color: #orange; font-weight: bold;',
        high: 'color: #red; font-weight: bold;',
        critical: 'color: #darkred; font-weight: bold;',
      }[errorLog.severity] || ''

    console.log(
      `%c${prefix} ${errorLog.message}`,
      style,
      errorLog.context || '',
      errorLog.stackTrace || ''
    )
  }

  /**
   * 發送錯誤到遠程監控服務
   * 在實際應用中應調用真實的 API
   */
  private sendToRemoteService(errorLog: ErrorLog): void {
    // 在實際應用中，這裡應該調用：
    // fetch('/api/errors', { method: 'POST', body: JSON.stringify(errorLog) })
    //   .catch(err => console.error('Failed to report error:', err))

    // 對於開發環境，只是記錄到控制台
    if (process.env.NODE_ENV === 'development') {
      console.debug('Error would be sent to remote service:', errorLog)
    }
  }
}

// 導出單一實例
export const errorReporting = new ErrorReportingService()

/**
 * 全局錯誤處理器
 * 在應用啟動時調用以捕獲未處理的錯誤
 */
export function setupGlobalErrorHandling(): void {
  if (typeof window === 'undefined') return

  // 處理未捕獲的異常
  window.addEventListener('error', (event: ErrorEvent) => {
    errorReporting.captureException(event.error, {
      type: 'uncaught-exception',
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
    })
  })

  // 處理未處理的 Promise 拒絕
  window.addEventListener('unhandledrejection', (event: PromiseRejectionEvent) => {
    const error = event.reason instanceof Error ? event.reason : new Error(String(event.reason))
    errorReporting.captureException(error, {
      type: 'unhandled-rejection',
    })
  })
}
