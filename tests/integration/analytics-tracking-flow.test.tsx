import { renderHook, act } from '@testing-library/react'
import { useAnalyticsTracking } from '@/hooks/useAnalyticsTracking'
import { trackingService } from '@/services/trackingService'
import { AuthProvider } from '@/context/AuthContext'
import { MemoryRouter } from 'react-router-dom'
import { vi } from 'vitest'

import { ANALYTICS_CONFIG } from '@/config/analytics'

// Mock dependencies
vi.mock('@/services/trackingService', () => ({
  trackingService: {
    logEvent: vi.fn().mockResolvedValue(undefined)
  }
}))

vi.mock('@/components/LoadingTimeout', () => ({
  useLoadingTimeout: () => ({ isTimedOut: false })
}))

// Wrapper for hooks
const wrapper = ({ children }: { children: React.ReactNode }) => (
  <AuthProvider>
    <MemoryRouter initialEntries={['/week/2025-W01/article/123']}>
      {children}
    </MemoryRouter>
  </AuthProvider>
)

describe('Integration: Analytics Tracking Flow (T040)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    sessionStorage.clear()
    // Mock user auth if needed, but for public tracking it might be guest
  })

  it('should initialize session and log page view on mount', async () => {
    const props = {
      articleId: 'article-123',
      weekNumber: '2025-W01',
      classId: 'class-abc'
    }

    renderHook(() => useAnalyticsTracking(props), { wrapper })

    // 1. Check Session ID creation
    expect(sessionStorage.getItem(ANALYTICS_CONFIG.sessionIdStorageKey)).toBeTruthy()
    
    // 2. Check Page View Log
    expect(trackingService.logEvent).toHaveBeenCalledWith(expect.objectContaining({
      event_type: 'page_view',
      article_id: 'article-123',
      newsletter_id: '2025-W01',
      metadata: expect.objectContaining({
        path: '/week/2025-W01/article/123',
        class_id: 'class-abc'
      })
    }))
  })

  it('should track session end with time spent', async () => {
     const props = {
      articleId: 'article-123',
      enabled: true
    }
    
    // Fake timers to simulate reading
    vi.useFakeTimers()
    
    const { unmount } = renderHook(() => useAnalyticsTracking(props), { wrapper })
    
    // Fast forward 5 seconds
    act(() => {
      vi.advanceTimersByTime(5000)
    })
    
    // Unmount to trigger session_end
    unmount()
    
    expect(trackingService.logEvent).toHaveBeenCalledWith(expect.objectContaining({
      event_type: 'session_end',
      article_id: 'article-123',
      metadata: expect.objectContaining({
        time_spent_seconds: 5
      })
    }))
    
    vi.useRealTimers()
  })
})
