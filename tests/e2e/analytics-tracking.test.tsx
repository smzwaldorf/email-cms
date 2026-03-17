
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { trackingService } from '@/services/trackingService'
import { renderHook } from '@testing-library/react'
import { useAnalyticsTracking } from '@/hooks/useAnalyticsTracking'
import { AuthProvider } from '@/context/AuthContext'
import { MemoryRouter } from 'react-router-dom'
import React from 'react'

// Mock the tracking service methods
vi.mock('@/services/trackingService', () => ({
  trackingService: {
    logEvent: vi.fn(),
    getReadArticles: vi.fn(),
    identifySession: vi.fn()
  }
}))

// Mock Supabase
vi.mock('@/lib/supabase', () => ({
  getSupabaseClient: vi.fn()
}))

// Wrapper for hooks that need Context
const wrapper = ({ children }: { children: React.ReactNode }) => (
  <AuthProvider>
    <MemoryRouter initialEntries={['/week/2025-W01/article/123']}>
      {children}
    </MemoryRouter>
  </AuthProvider>
)

describe('E2E: Analytics Tracking Flow', () => {
  const mockUser = 'user-123'
  const mockNewsletterId = '11111111-1111-1111-1111-111111111111' // UUID format
  const mockArticle = 'article-123'

  beforeEach(() => {
    vi.clearAllMocks()
    sessionStorage.clear()
  })

  it('should track the complete user journey: Open -> Click -> View -> Read', async () => {
    // 1. Simulate Email Open (Pixel)
    const openEvent = {
        event_type: 'email_open',
        user_id: mockUser,
        newsletter_id: mockNewsletterId,
        metadata: { source: 'email' }
    }
    await trackingService.logEvent(openEvent as any)
    expect(trackingService.logEvent).toHaveBeenCalledWith(expect.objectContaining({
        event_type: 'email_open'
    }))

    // 2. Simulate Link Click (Redirect)
    const clickEvent = {
        event_type: 'link_click',
        user_id: mockUser,
        newsletter_id: mockNewsletterId,
        metadata: { target_url: `/article/${mockArticle}` }
    }
    await trackingService.logEvent(clickEvent as any)
    
    // 3. User Lands on Article Page (Frontend Hook)
    vi.useFakeTimers()
    const { unmount } = renderHook(() => useAnalyticsTracking({
        articleId: mockArticle,
        newsletterId: mockNewsletterId,
        enabled: true
    }), { wrapper })

    // Verify Page View logged
    expect(trackingService.logEvent).toHaveBeenCalledWith(expect.objectContaining({
        event_type: 'page_view',
        article_id: mockArticle,
        newsletter_id: mockNewsletterId
    }))

    // Advance time by 5 seconds to satisfy the 3s threshold
    vi.advanceTimersByTime(5000)

    // 4. User Reads and Leaves (Session End)
    unmount() // Triggers cleanup
    vi.useRealTimers()
    
    // Verify Session End logged
    expect(trackingService.logEvent).toHaveBeenCalledWith(expect.objectContaining({
        event_type: 'session_end',
        article_id: mockArticle
    }))
  })

  it('should correlate dashboard data with interactions', async () => {
    vi.mocked(trackingService.getReadArticles).mockResolvedValue([mockArticle])

    const readArticles = await trackingService.getReadArticles(mockUser, mockNewsletterId)
    
    expect(readArticles).toContain(mockArticle)
    expect(trackingService.getReadArticles).toHaveBeenCalledWith(mockUser, mockNewsletterId)
  })
})
