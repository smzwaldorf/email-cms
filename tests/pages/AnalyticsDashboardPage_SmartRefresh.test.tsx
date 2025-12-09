import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { AnalyticsDashboardPage } from '../../src/pages/AnalyticsDashboardPage'
import { AnalyticsProvider } from '@/context/AnalyticsContext'
import { BrowserRouter } from 'react-router-dom'
import React from 'react'

// Mock react-window
vi.mock('react-window', () => ({
  FixedSizeList: ({ children, itemCount, itemSize, height, width }: any) => (
    <div data-testid="virtual-list" style={{ height, width }}>
      {Array.from({ length: itemCount }).map((_, index) => (
         <div key={index}>{children({ index, style: { height: itemSize } })}</div>
      ))}
    </div>
  ),
}));

// Mock implementation variables
const mockUseNewsletterMetrics = vi.fn(() => ({ metrics: null, refetch: vi.fn(), loading: false, refreshing: false }))
const mockUseArticleStats = vi.fn(() => ({ stats: [], refetch: vi.fn(), loading: false, refreshing: false }))
const mockUseTrendStats = vi.fn(() => ({ trend: [], refetch: vi.fn(), loading: false, refreshing: false }))
const mockUseClassEngagement = vi.fn(() => ({ data: [], refetch: vi.fn(), loading: false, refreshing: false }))
const mockUseTopicHotness = vi.fn(() => ({ hotness: [], refetch: vi.fn(), loading: false, refreshing: false }))

// Mock Hooks
vi.mock('@/hooks/useAnalyticsQuery', () => ({
  useNewsletterMetrics: () => mockUseNewsletterMetrics(),
  useArticleStats: () => mockUseArticleStats(),
  useTrendStats: () => mockUseTrendStats(),
  useClassEngagement: () => mockUseClassEngagement(),
  useTopicHotness: () => mockUseTopicHotness(),
  useGenerateSnapshots: () => ({ generate: vi.fn(), generating: false }),
  useAvailableWeeks: () => ({ weeks: [{ week_number: '2025-W47' }], loading: false }),
  useAllClasses: () => ({ classes: [], loading: false }),
}))

// Mock Layout
vi.mock('@/components/admin/AdminLayout', () => ({
  AdminLayout: ({ children }: any) => <div>{children}</div>
}))

// Mock window.location.reload
const mockReload = vi.fn()
Object.defineProperty(window, 'location', {
  value: { reload: mockReload },
  writable: true
})

describe('Analytics Smart Refresh', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset document visibility to visible
    Object.defineProperty(document, 'hidden', { value: false, configurable: true })
    
    // Reset default mock implementations
    mockUseNewsletterMetrics.mockReturnValue({ metrics: null, refetch: vi.fn(), loading: false, refreshing: false })
  })

  it('should perform hard reload if tab was previously hidden', () => {
    render(
      <AnalyticsProvider>
        <BrowserRouter>
          <AnalyticsDashboardPage />
        </BrowserRouter>
      </AnalyticsProvider>
    )

    // Simulate switching tabs (visibility change)
    Object.defineProperty(document, 'hidden', { value: true, configurable: true })
    const event = new Event('visibilitychange')
    
    act(() => {
        document.dispatchEvent(event)
    });

    // Simulate coming back
    Object.defineProperty(document, 'hidden', { value: false, configurable: true })
    
    act(() => {
        document.dispatchEvent(event)
    });

    // The button has title="Reload Data"
    const refreshBtn = screen.getByTitle('Reload Data')
    
    fireEvent.click(refreshBtn)

    expect(mockReload).toHaveBeenCalled()
  })

  it('should perform soft refresh if tab was never hidden', () => {
     render(
      <AnalyticsProvider>
        <BrowserRouter>
          <AnalyticsDashboardPage />
        </BrowserRouter>
      </AnalyticsProvider>
    )

    // Find refresh button
    const refreshBtn = screen.getByTitle('Reload Data')

    // Click without changing visibility
    fireEvent.click(refreshBtn)

    // Should NOT call reload
    expect(mockReload).not.toHaveBeenCalled()
  })

  it('should allow reload even if refreshing is stuck, provided tab was hidden', () => {
    // Mock stuck refreshing state
    mockUseNewsletterMetrics.mockReturnValue({ 
        metrics: null, 
        refetch: vi.fn(), 
        loading: false, 
        refreshing: true // STUCK REFRESHING
    })

    render(
      <AnalyticsProvider>
        <BrowserRouter>
          <AnalyticsDashboardPage />
        </BrowserRouter>
      </AnalyticsProvider>
    )

    // 1. Simulate finding tab hidden (overnight)
    Object.defineProperty(document, 'hidden', { value: true, configurable: true })
    const event = new Event('visibilitychange')
    act(() => {
        document.dispatchEvent(event)
    });
    
    // 2. User comes back
    Object.defineProperty(document, 'hidden', { value: false, configurable: true })
    act(() => {
        document.dispatchEvent(event)
    });

    const refreshBtn = screen.getByTitle('Reload Data')

    // 3. Verify button is NOT disabled despite refreshing=true
    expect(refreshBtn).not.toBeDisabled()
    
    // 4. Verify spinner is NOT showing (optional, check logic)
    // The spinner logic is inside the button, verifying class presence might be fragile, 
    // but we can check if the button is clickable which implies the fix.
    
    // 5. Click verifies reload
    fireEvent.click(refreshBtn)
    expect(mockReload).toHaveBeenCalled()
  })
})
