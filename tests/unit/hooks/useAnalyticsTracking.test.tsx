import { renderHook } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useAnalyticsTracking } from '@/hooks/useAnalyticsTracking'
import { trackingService } from '@/services/trackingService'
import { ANALYTICS_CONFIG } from '@/config/analytics'
import { MemoryRouter } from 'react-router-dom'
import React from 'react'

// Mock trackingService
vi.mock('@/services/trackingService', () => ({
  trackingService: {
    logEvent: vi.fn(),
    identifySession: vi.fn()
  }
}))

// Mock AuthContext
vi.mock('@/context/AuthContext', () => ({
  useAuth: vi.fn(() => ({ user: { id: 'test-user-id' } }))
}))

describe('useAnalyticsTracking', () => {
  const mockArticleId = 'test-article-id'
  const mockWeekNumber = '2025-W01'
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <MemoryRouter>{children}</MemoryRouter>
  )

  beforeEach(() => {
    vi.clearAllMocks()
    sessionStorage.clear()
  })

  it('should generate and store a session ID on first use', () => {
    expect(sessionStorage.getItem(ANALYTICS_CONFIG.sessionIdStorageKey)).toBeNull()

    renderHook(() => useAnalyticsTracking({
      articleId: mockArticleId,
      weekNumber: mockWeekNumber
    }), { wrapper })

    const sessionId = sessionStorage.getItem(ANALYTICS_CONFIG.sessionIdStorageKey)
    expect(sessionId).toBeTruthy()
    // Verify UUID format (simple check)
    expect(sessionId?.length).toBe(36)
    expect(sessionId?.split('-').length).toBe(5)
  })

  it('should reuse existing session ID', () => {
    const existingSessionId = 'existing-session-id'
    sessionStorage.setItem(ANALYTICS_CONFIG.sessionIdStorageKey, existingSessionId)

    renderHook(() => useAnalyticsTracking({
      articleId: mockArticleId,
      weekNumber: mockWeekNumber
    }), { wrapper })

    expect(sessionStorage.getItem(ANALYTICS_CONFIG.sessionIdStorageKey)).toBe(existingSessionId)
  })

  it('should log page_view event on mount', () => {
    renderHook(() => useAnalyticsTracking({
      articleId: mockArticleId,
      weekNumber: mockWeekNumber
    }), { wrapper })

    expect(trackingService.logEvent).toHaveBeenCalledWith(expect.objectContaining({
      event_type: 'page_view',
      article_id: mockArticleId,
      newsletter_id: mockWeekNumber, // implementation uses newsletter_id
      metadata: expect.objectContaining({
        path: expect.any(String)
      })
    }))
  })

  it('should track scroll depth', () => {
    const addEventListenerSpy = vi.spyOn(window, 'addEventListener')
    
    renderHook(() => useAnalyticsTracking({
      articleId: mockArticleId,
      weekNumber: mockWeekNumber
    }), { wrapper })

    expect(addEventListenerSpy).toHaveBeenCalledWith('scroll', expect.any(Function))
  })
})
