
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { AnalyticsDashboardPage } from '../../src/pages/AnalyticsDashboardPage'
import React from 'react'
import { BrowserRouter } from 'react-router-dom'

// Mock Hooks
vi.mock('@/hooks/useAnalyticsQuery', () => ({
  useNewsletterMetrics: () => ({ metrics: null, refetch: vi.fn(), loading: false }),
  useArticleStats: () => ({ stats: [], refetch: vi.fn(), loading: false }),
  useTrendStats: () => ({ trend: [], refetch: vi.fn(), loading: false }),
  useClassEngagement: () => ({ data: [], refetch: vi.fn(), loading: false }),
  useTopicHotness: () => ({ hotness: [], refetch: vi.fn(), loading: false }),
  useGenerateSnapshots: () => ({ generate: vi.fn(), generating: false }),
  useAvailableWeeks: () => ({ weeks: [{ week_number: '2025-W47' }], loading: false }),
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
  })

  it('should perform hard reload if tab was previously hidden', () => {
    const { unmount } = render(
      <BrowserRouter>
        <AnalyticsDashboardPage />
      </BrowserRouter>
    )

    // Simulate switching tabs (visibility change)
    Object.defineProperty(document, 'hidden', { value: true, configurable: true })
    const event = new Event('visibilitychange')
    document.dispatchEvent(event)

    // Simulate coming back
    Object.defineProperty(document, 'hidden', { value: false, configurable: true })
    document.dispatchEvent(event)

    // The button has title="Reload Data"
    const refreshBtn = screen.getByTitle('Reload Data')
    
    // Initial State: hasBeenHidden is false.
    // We already moved it to true and back to false in the test setup above.
    // So logic dictates it SHOULD be a reload.
    
    fireEvent.click(refreshBtn)

    expect(mockReload).toHaveBeenCalled()
  })

  it('should perform soft refresh if tab was never hidden', () => {
     const { unmount } = render(
      <BrowserRouter>
        <AnalyticsDashboardPage />
      </BrowserRouter>
    )

    // Find refresh button
    const refreshBtn = screen.getByTitle('Reload Data')

    // Click without changing visibility
    fireEvent.click(refreshBtn)

    // Should NOT call reload
    expect(mockReload).not.toHaveBeenCalled()
  })
})
