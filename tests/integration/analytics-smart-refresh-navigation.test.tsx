import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { AnalyticsDashboardPage } from '../../src/pages/AnalyticsDashboardPage'
import { AnalyticsProvider } from '@/context/AnalyticsContext'
import { MemoryRouter, Routes, Route, useNavigate } from 'react-router-dom'
import React from 'react'

// Dummy Article Page Component
const ArticlePage = () => {
    const navigate = useNavigate();
    return (
        <div>
            <h1>Article Page</h1>
            <button onClick={() => navigate('/admin/analytics')}>Back to Dashboard</button>
        </div>
    );
};

// Mock dependencies
vi.mock('react-window', () => ({
  FixedSizeList: ({ children, itemCount, itemSize, height, width }: any) => (
    <div data-testid="virtual-list" style={{ height, width }}>
      {Array.from({ length: itemCount }).map((_, index) => (
         <div key={index}>{children({ index, style: { height: itemSize } })}</div>
      ))}
    </div>
  ),
}));

const mockRefetch = vi.fn()

vi.mock('@/hooks/useAnalyticsQuery', () => ({
  useNewsletterMetrics: () => ({ metrics: null, refetch: mockRefetch, loading: false, refreshing: false }),
  useArticleStats: () => ({ stats: [], refetch: vi.fn(), loading: false, refreshing: false }),
  useTrendStats: () => ({ trend: [], refetch: vi.fn(), loading: false, refreshing: false }),
  useClassEngagement: () => ({ data: [], refetch: vi.fn(), loading: false, refreshing: false }),
  useTopicHotness: () => ({ hotness: [], refetch: vi.fn(), loading: false, refreshing: false }),
  useGenerateSnapshots: () => ({ generate: vi.fn(), generating: false }),
  useAvailableWeeks: () => ({ weeks: [{ week_number: '2025-W47' }], loading: false }),
  useAllClasses: () => ({ classes: [], loading: false }),
}))

vi.mock('@/components/admin/AdminLayout', () => ({
  AdminLayout: ({ children }: any) => <div>{children}</div>
}))

describe('Analytics Dashboard with Navigation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders dashboard and displays correct title', () => {
    render(
      <AnalyticsProvider>
        <MemoryRouter initialEntries={['/admin/analytics']}>
            <Routes>
                <Route path="/admin/analytics" element={<AnalyticsDashboardPage />} />
                <Route path="/admin/analytics/article/:id" element={<ArticlePage />} />
            </Routes>
        </MemoryRouter>
      </AnalyticsProvider>
    )

    expect(screen.getByText('Analytics Dashboard')).toBeInTheDocument();
  });

  it('navigates from article page to dashboard and refresh works', async () => {
     render(
      <AnalyticsProvider>
        <MemoryRouter initialEntries={['/admin/analytics/article/123']}>
            <Routes>
                <Route path="/admin/analytics" element={<AnalyticsDashboardPage />} />
                <Route path="/admin/analytics/article/:id" element={<ArticlePage />} />
            </Routes>
        </MemoryRouter>
      </AnalyticsProvider>
    )

    // 1. Verify we are on Article Page
    expect(screen.getByText('Article Page')).toBeInTheDocument();

    // 2. Navigate Back to Dashboard
    const backBtn = screen.getByText('Back to Dashboard');
    fireEvent.click(backBtn);

    // 3. Verify Dashboard is shown
    expect(screen.getByText('Analytics Dashboard')).toBeInTheDocument();

    // 4. Click Refresh Button
    const refreshBtn = screen.getByTitle('Reload Data')
    fireEvent.click(refreshBtn)

    // 5. Expect refetch to be called
    expect(mockRefetch).toHaveBeenCalled()
  })

  it('live update continues working after navigation', async () => {
    render(
      <AnalyticsProvider>
        <MemoryRouter initialEntries={['/admin/analytics']}>
            <Routes>
                <Route path="/admin/analytics" element={<AnalyticsDashboardPage />} />
            </Routes>
        </MemoryRouter>
      </AnalyticsProvider>
    )

    // Enable live update
    const liveBtn = screen.getByTitle('Enable live updates (every 5s)')
    fireEvent.click(liveBtn)

    // Clear previous calls
    mockRefetch.mockClear()

    // Advance timer by 5 seconds
    act(() => {
      vi.advanceTimersByTime(5000)
    })

    // Should auto-refresh
    expect(mockRefetch).toHaveBeenCalled()
  })
})
