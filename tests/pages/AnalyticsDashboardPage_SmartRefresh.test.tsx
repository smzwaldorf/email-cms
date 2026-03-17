import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
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
const mockRefetch = vi.fn()
const mockUseNewsletterMetrics = vi.fn(() => ({ metrics: null, refetch: mockRefetch, loading: false, refreshing: false }))
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

describe('Analytics Dashboard Refresh', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    
    // Reset default mock implementations
    mockUseNewsletterMetrics.mockReturnValue({ metrics: null, refetch: mockRefetch, loading: false, refreshing: false })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('should perform soft refresh when clicking the refresh button', () => {
    render(
      <AnalyticsProvider>
        <BrowserRouter>
          <AnalyticsDashboardPage />
        </BrowserRouter>
      </AnalyticsProvider>
    )

    // Find refresh button
    const refreshBtn = screen.getByTitle('Reload Data')

    // Click the refresh button
    fireEvent.click(refreshBtn)

    // Should call refetch functions
    expect(mockRefetch).toHaveBeenCalled()
  })

  it('should disable refresh button when data is refreshing', () => {
    // Mock refreshing state
    mockUseNewsletterMetrics.mockReturnValue({ 
      metrics: null, 
      refetch: mockRefetch, 
      loading: false, 
      refreshing: true
    })

    render(
      <AnalyticsProvider>
        <BrowserRouter>
          <AnalyticsDashboardPage />
        </BrowserRouter>
      </AnalyticsProvider>
    )

    const refreshBtn = screen.getByTitle('Reload Data')
    
    // Should be disabled when refreshing
    expect(refreshBtn).toBeDisabled()
  })

  it('should have a Live Update toggle button', () => {
    render(
      <AnalyticsProvider>
        <BrowserRouter>
          <AnalyticsDashboardPage />
        </BrowserRouter>
      </AnalyticsProvider>
    )

    // Find the live update button
    const liveBtn = screen.getByTitle('Enable live updates (every 5s)')
    expect(liveBtn).toBeInTheDocument()
  })

  it('should toggle live update state when clicking the Live button', () => {
    render(
      <AnalyticsProvider>
        <BrowserRouter>
          <AnalyticsDashboardPage />
        </BrowserRouter>
      </AnalyticsProvider>
    )

    // Find and click the live update button
    const liveBtn = screen.getByTitle('Enable live updates (every 5s)')
    fireEvent.click(liveBtn)

    // After clicking, the button title should change
    expect(screen.getByTitle('Disable live updates')).toBeInTheDocument()
  })

  it('should auto-refresh data every 5 seconds when live update is enabled', async () => {
    render(
      <AnalyticsProvider>
        <BrowserRouter>
          <AnalyticsDashboardPage />
        </BrowserRouter>
      </AnalyticsProvider>
    )

    // Enable live update
    const liveBtn = screen.getByTitle('Enable live updates (every 5s)')
    fireEvent.click(liveBtn)

    // Clear previous mock calls from initial render
    mockRefetch.mockClear()

    // Advance timer by 5 seconds
    act(() => {
      vi.advanceTimersByTime(5000)
    })

    // Should have called refetch
    expect(mockRefetch).toHaveBeenCalled()
  })
})
