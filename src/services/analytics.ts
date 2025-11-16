/**
 * 服務 - 分析和使用者反饋
 * 收集使用者行為數據和匿名滿意度反饋
 * 驗證 SC-003：85% 導航清晰度滿意度
 */

export interface UserFeedback {
  id: string
  timestamp: Date
  feedbackType: 'navigation' | 'readability' | 'performance' | 'general'
  rating: 1 | 2 | 3 | 4 | 5
  comment?: string
  userAgent?: string
  url?: string
}

export interface AnalyticsEvent {
  id: string
  timestamp: Date
  eventType:
    | 'page_view'
    | 'article_view'
    | 'article_switch'
    | 'navigation_click'
    | 'direct_link_access'
    | 'editor_access'
  context?: Record<string, unknown>
  sessionId?: string
}

export interface FeedbackMetrics {
  totalFeedback: number
  navigationSatisfaction: number // 0-100%
  averageRating: number // 1-5
  feedbackByType: Record<string, number>
  ratingDistribution: Record<number, number> // 1-5 映射到計數
}

class AnalyticsService {
  private feedbackList: UserFeedback[] = []
  private eventsList: AnalyticsEvent[] = []
  private sessionId: string
  private maxRecords = 5000

  constructor() {
    this.sessionId = this.generateSessionId()
  }

  /**
   * 記錄使用者反饋
   */
  recordFeedback(
    feedbackType: UserFeedback['feedbackType'],
    rating: 1 | 2 | 3 | 4 | 5,
    comment?: string
  ): UserFeedback {
    const feedback: UserFeedback = {
      id: `feedback-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      feedbackType,
      rating,
      comment,
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
      url: typeof window !== 'undefined' ? window.location.href : undefined,
    }

    this.feedbackList.push(feedback)

    // 維持記錄數量在限制內
    if (this.feedbackList.length > this.maxRecords) {
      this.feedbackList = this.feedbackList.slice(-this.maxRecords)
    }

    // 發送到遠程分析服務
    this.sendFeedbackToService(feedback)

    return feedback
  }

  /**
   * 記錄分析事件
   */
  trackEvent(eventType: AnalyticsEvent['eventType'], context?: Record<string, unknown>): void {
    const event: AnalyticsEvent = {
      id: `event-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      eventType,
      context,
      sessionId: this.sessionId,
    }

    this.eventsList.push(event)

    // 維持記錄數量在限制內
    if (this.eventsList.length > this.maxRecords) {
      this.eventsList = this.eventsList.slice(-this.maxRecords)
    }

    // 發送到遠程分析服務
    this.sendEventToService(event)
  }

  /**
   * 追蹤頁面瀏覽
   */
  trackPageView(pageName: string): void {
    this.trackEvent('page_view', { pageName })
  }

  /**
   * 追蹤文章瀏覽
   */
  trackArticleView(articleId: string, articleTitle: string): void {
    this.trackEvent('article_view', { articleId, articleTitle })
  }

  /**
   * 追蹤文章切換
   */
  trackArticleSwitch(fromArticleId: string, toArticleId: string): void {
    this.trackEvent('article_switch', { fromArticleId, toArticleId })
  }

  /**
   * 追蹤導航點擊
   */
  trackNavigationClick(buttonType: 'previous' | 'next' | 'direct'): void {
    this.trackEvent('navigation_click', { buttonType })
  }

  /**
   * 追蹤直接連結訪問
   */
  trackDirectLinkAccess(articleId: string): void {
    this.trackEvent('direct_link_access', { articleId })
  }

  /**
   * 追蹤編輯器訪問
   */
  trackEditorAccess(weekNumber: string): void {
    this.trackEvent('editor_access', { weekNumber })
  }

  /**
   * 計算反饋指標
   */
  getFeedbackMetrics(): FeedbackMetrics {
    if (this.feedbackList.length === 0) {
      return {
        totalFeedback: 0,
        navigationSatisfaction: 0,
        averageRating: 0,
        feedbackByType: {},
        ratingDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
      }
    }

    const feedbackByType: Record<string, number> = {}
    const ratingDistribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
    let totalRating = 0

    this.feedbackList.forEach((feedback) => {
      feedbackByType[feedback.feedbackType] = (feedbackByType[feedback.feedbackType] || 0) + 1
      ratingDistribution[feedback.rating]++
      totalRating += feedback.rating
    })

    // 計算導航滿意度（評分 4-5 的百分比）
    const navigationFeedback = this.feedbackList.filter((f) => f.feedbackType === 'navigation')
    const navigationSatisfied = navigationFeedback.filter((f) => f.rating >= 4).length
    const navigationSatisfaction =
      navigationFeedback.length > 0 ? (navigationSatisfied / navigationFeedback.length) * 100 : 0

    return {
      totalFeedback: this.feedbackList.length,
      navigationSatisfaction,
      averageRating: totalRating / this.feedbackList.length,
      feedbackByType,
      ratingDistribution,
    }
  }

  /**
   * 獲取事件統計
   */
  getEventStats(): {
    totalEvents: number
    eventsByType: Record<string, number>
    recentEvents: AnalyticsEvent[]
  } {
    const eventsByType: Record<string, number> = {}
    this.eventsList.forEach((event) => {
      eventsByType[event.eventType] = (eventsByType[event.eventType] || 0) + 1
    })

    return {
      totalEvents: this.eventsList.length,
      eventsByType,
      recentEvents: this.eventsList.slice(-20),
    }
  }

  /**
   * 獲取用戶會話 ID
   */
  getSessionId(): string {
    return this.sessionId
  }

  /**
   * 清除所有數據
   */
  clearData(): void {
    this.feedbackList = []
    this.eventsList = []
  }

  /**
   * 生成會話 ID
   */
  private generateSessionId(): string {
    return `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * 發送反饋到遠程服務
   */
  private sendFeedbackToService(feedback: UserFeedback): void {
    // 在實際應用中，這裡應該調用：
    // fetch('/api/feedback', { method: 'POST', body: JSON.stringify(feedback) })
    //   .catch(err => console.error('Failed to send feedback:', err))

    if (process.env.NODE_ENV === 'development') {
      console.debug('Feedback would be sent to service:', feedback)
    }
  }

  /**
   * 發送事件到遠程服務
   */
  private sendEventToService(event: AnalyticsEvent): void {
    // 在實際應用中，這裡應該調用：
    // fetch('/api/analytics/events', { method: 'POST', body: JSON.stringify(event) })
    //   .catch(err => console.error('Failed to send event:', err))

    if (process.env.NODE_ENV === 'development') {
      console.debug('Event would be sent to service:', event)
    }
  }
}

// 導出單一實例
export const analytics = new AnalyticsService()

/**
 * 初始化分析服務
 * 在應用啟動時調用
 */
export function initializeAnalytics(): void {
  if (typeof window === 'undefined') return

  // 追蹤初始頁面瀏覽
  const pageName = window.location.pathname
  analytics.trackPageView(pageName)
}
