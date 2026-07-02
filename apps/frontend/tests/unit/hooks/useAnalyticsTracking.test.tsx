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
  const mockNewsletterId = '11111111-1111-1111-1111-111111111111' // UUID format
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <MemoryRouter>{children}</MemoryRouter>
  )
  const wrapperWithJourneyCorrelation = ({ children }: { children: React.ReactNode }) => (
    <MemoryRouter initialEntries={['/week/2025-W43?jc=journey-123']}>{children}</MemoryRouter>
  )

  beforeEach(() => {
    vi.clearAllMocks()
    sessionStorage.clear()
  })

  it('should generate and store a session ID on first use', () => {
    expect(sessionStorage.getItem(ANALYTICS_CONFIG.sessionIdStorageKey)).toBeNull()

    renderHook(() => useAnalyticsTracking({
      articleId: mockArticleId,
      newsletterId: mockNewsletterId
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
      newsletterId: mockNewsletterId
    }), { wrapper })

    expect(sessionStorage.getItem(ANALYTICS_CONFIG.sessionIdStorageKey)).toBe(existingSessionId)
  })

  it('should log page_view event on mount', () => {
    renderHook(() => useAnalyticsTracking({
      articleId: mockArticleId,
      newsletterId: mockNewsletterId
    }), { wrapper })

    expect(trackingService.logEvent).toHaveBeenCalledWith(expect.objectContaining({
      event_type: 'page_view',
      article_id: mockArticleId,
      newsletter_id: mockNewsletterId,
      metadata: expect.objectContaining({
        path: expect.any(String)
      })
    }))
  })

  it('includes journey correlation id in page_view metadata when present in URL', () => {
    renderHook(() => useAnalyticsTracking({
      articleId: mockArticleId,
      newsletterId: mockNewsletterId,
    }), { wrapper: wrapperWithJourneyCorrelation })

    expect(trackingService.logEvent).toHaveBeenCalledWith(expect.objectContaining({
      event_type: 'page_view',
      metadata: expect.objectContaining({
        journey_correlation_id: 'journey-123',
      }),
    }))
  })

  it('should track scroll depth', () => {
    const addEventListenerSpy = vi.spyOn(window, 'addEventListener')

    renderHook(() => useAnalyticsTracking({
      articleId: mockArticleId,
      newsletterId: mockNewsletterId
    }), { wrapper })

    expect(addEventListenerSpy).toHaveBeenCalledWith('scroll', expect.any(Function))
  })

  it('should only track one page_view when switching from one article to another', () => {
    const article1Id = 'article-1'
    const article2Id = 'article-2'
    const newsletter1Id = '11111111-1111-1111-1111-111111111111'
    const newsletter2Id = '22222222-2222-2222-2222-222222222222'

    const { rerender } = renderHook(
      ({ articleId, newsletterId }) =>
        useAnalyticsTracking({ articleId, newsletterId }),
      {
        wrapper,
        initialProps: {
          articleId: article1Id,
          newsletterId: newsletter1Id
        }
      }
    )

    // Clear calls to isolate the rerender scenario
    vi.clearAllMocks()

    // Simulate switching to a different article (week change)
    rerender({
      articleId: article2Id,
      newsletterId: newsletter2Id
    })

    // Should only log one page_view event for the new article
    expect(trackingService.logEvent).toHaveBeenCalledTimes(1)
    expect(trackingService.logEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        event_type: 'page_view',
        article_id: article2Id,
        newsletter_id: newsletter2Id
      })
    )
  })

  it('should not track duplicate page_view when same article/newsletter rendered again', () => {
    const { rerender } = renderHook(
      ({ articleId, newsletterId }) =>
        useAnalyticsTracking({ articleId, newsletterId }),
      {
        wrapper,
        initialProps: {
          articleId: mockArticleId,
          newsletterId: mockNewsletterId
        }
      }
    )

    // Clear calls to isolate rerender scenario
    vi.clearAllMocks()

    // Rerender with same article ID and newsletter ID (React rerender without prop change)
    rerender({
      articleId: mockArticleId,
      newsletterId: mockNewsletterId
    })

    // Should NOT log another page_view since article/newsletter haven't changed
    expect(trackingService.logEvent).not.toHaveBeenCalled()
  })
})
