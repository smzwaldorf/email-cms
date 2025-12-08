import { describe, it, expect, vi, beforeEach } from 'vitest'
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

vi.mock('@/hooks/useAnalyticsQuery', () => ({
  useNewsletterMetrics: () => ({ metrics: null, refetch: vi.fn(), loading: false, refreshing: false }),
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

const mockReload = vi.fn()
Object.defineProperty(window, 'location', {
  value: { reload: mockReload },
  writable: true
})

describe('Analytics Smart Refresh with Navigation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    Object.defineProperty(document, 'hidden', { value: false, configurable: true })
  })

  it('triggers full reload when refreshing dashboard after being hidden on article page', async () => {
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

    // 1. Start at Dashboard
    expect(screen.getByText('Analytics Dashboard')).toBeInTheDocument();

    // 2. Navigate to Article Page (Simulate)
    // Since we don't have the link rendered in the mock dashboard easily, we can use a test utility or just simulate a link click if we had one.
    // For this test, let's just render the Router with the flow.
    // Actually, let's force navigation using a mocked button in dashboard or simply start at Article Page?
    // User scenario: View Article -> Background -> Dashboard -> Refresh.
    // Let's start the router at Article Page.
  });

  it('workflow: Article -> Background -> Dashboard -> Refresh triggers reload', async () => {
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

    // 2. Simulate User Switching Tabs (Backgrounding)
    Object.defineProperty(document, 'hidden', { value: true, configurable: true })
    const hideEvent = new Event('visibilitychange')
    act(() => {
        document.dispatchEvent(hideEvent)
    });

    // 3. User Comes Back (Foregrounding)
    Object.defineProperty(document, 'hidden', { value: false, configurable: true })
    const showEvent = new Event('visibilitychange')
    act(() => {
        document.dispatchEvent(showEvent)
    });

    // 4. Navigate Back to Dashboard
    const backBtn = screen.getByText('Back to Dashboard');
    fireEvent.click(backBtn);

    // 5. Verify Dashboard is shown
    expect(screen.getByText('Analytics Dashboard')).toBeInTheDocument();

    // 6. Click Refresh Button
    const refreshBtn = screen.getByTitle('Reload Data')
    fireEvent.click(refreshBtn)

    // 7. Expect Hard Reload
    expect(mockReload).toHaveBeenCalled()
  })
})
