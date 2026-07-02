import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AnalyticsDashboardPage } from '@/pages/AnalyticsDashboardPage';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

type FixedSizeListChildProps = {
  index: number
  style: React.CSSProperties
}

type FixedSizeListProps = {
  children: (props: FixedSizeListChildProps) => React.ReactNode
  itemCount: number
  itemSize: number
  height: number | string
  width: number | string
}

type CountUpProps = {
  end: number
  suffix?: string
  prefix?: string
}

// Mock Hooks
const mockRefetch = vi.fn();
const mockGenerate = vi.fn();

// Mock newsletter UUIDs
const mockNewsletterId1 = '11111111-1111-1111-1111-111111111111';
const mockNewsletterId2 = '22222222-2222-2222-2222-222222222222';

// Mock react-window
vi.mock('react-window', () => ({
  FixedSizeList: ({ children, itemCount, itemSize, height, width }: FixedSizeListProps) => (
    <div data-testid="virtual-list" style={{ height, width }}>
      {Array.from({ length: itemCount }).map((_, index) => (
         <div key={index}>{children({ index, style: { height: itemSize } })}</div>
      ))}
    </div>
  ),
}));

vi.mock('@/hooks/useAnalyticsQuery', () => ({
    useAvailableWeeks: vi.fn(() => ({ 
        weeks: [
          { id: mockNewsletterId1, week_number: '2025-W01', release_date: '2025-01-01' }, 
          { id: mockNewsletterId2, week_number: '2024-W52', release_date: '2024-12-25' }
        ],
        loading: false 
    })),
    useNewsletterMetrics: vi.fn((newsletterId: string | null | undefined) => ({ 
        metrics: newsletterId ? { openRate: 45.5, clickRate: 12.3, totalViews: 1200, avgTimeSpent: 185 } : null,
        loading: false,
        refetch: mockRefetch
    })),
    useTrendStats: vi.fn(() => ({ 
        trend: Array.from({ length: 12 }).map((_, i) => ({
            name: `Week ${i}`,
            openRate: 40 + i,
            clickRate: 10 + (i * 0.5),
            avgTimeSpent: 180 + i
        })),
        loading: false,
        refetch: mockRefetch
    })),
    useClassEngagement: vi.fn(() => ({ 
        data: [{ 
            className: 'Rose', 
            activeUsers: 15, 
            totalUsers: 20, 
            openRate: 75, 
            clickCount: 5, 
            avgDailyTime: 120 
        }], 
        loading: false, 
        refreshing: false,
        refetch: mockRefetch 
    })),
    useArticleStats: vi.fn(() => ({ 
        stats: [{ 
            id: 'a1', 
            title: 'Test Article', 
            publishedAt: '2025-01-01', 
            views: 100, 
            uniqueViews: 80, 
            clicks: 10, 
            avgTimeSpent: 60,
            avgTimeSpentFormatted: '1m 0s',
            hotnessScore: 85
        }], 
        loading: false, 
        refreshing: false,
        refetch: mockRefetch 
    })),
    useTopicHotness: vi.fn(() => ({ hotness: [], refreshing: false, refetch: mockRefetch })),
    useGenerateSnapshots: vi.fn(() => ({ generate: mockGenerate, generating: false })),
    useAllClasses: vi.fn(() => ({ classes: ['Class 1', 'Class 2'], loading: false }))
}));

// Mock CountUp to render immediately
vi.mock('@/components/common/CountUp', () => ({
    CountUp: ({ end, suffix = '', prefix = '' }: CountUpProps) => <span>{prefix}{end.toLocaleString()}{suffix}</span>
}));

// Mock AdminLayout to avoid side effects (Supabase calls, Auth)
vi.mock('@/components/admin/AdminLayout', () => ({
    AdminLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>
}));

// Setup Providers
const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            retry: false,
        },
    },
});
// Mock AuthContext/useAuth
vi.mock('@/context/AuthContext', () => ({
    useAuth: () => ({
        user: { id: 'admin1', email: 'admin@test.com', role: 'admin' },
        isAuthenticated: true,
        isLoading: false,
        signIn: vi.fn(),
        signOut: vi.fn(),
        checkSession: vi.fn(),
        refreshSession: vi.fn()
    }),
    AuthContext: { Provider: ({ children }: { children: React.ReactNode }) => children } // Fallback if needed
}));

// Import Context
import { AnalyticsProvider } from '@/context/AnalyticsContext';

const renderDashboard = () => {
    return render(
        <QueryClientProvider client={queryClient}>
            <AnalyticsProvider>
                <BrowserRouter>
                    <AnalyticsDashboardPage />
                </BrowserRouter>
            </AnalyticsProvider>
        </QueryClientProvider>
    );
};

// Import mocked hooks for assertions
import * as useAnalyticsQuery from '@/hooks/useAnalyticsQuery';

describe('AnalyticsDashboardPage Integration', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('loads and displays the dashboard', async () => {
        renderDashboard();
        
        // Header
        expect(screen.getByText('Analytics Dashboard')).toBeInTheDocument();
        
        // Wait for KPI Cards to render data (after skeleton)
        await waitFor(() => {
            expect(screen.getByText('45.5%')).toBeInTheDocument(); // Open Rate
        });
        expect(screen.getByText('12.3%')).toBeInTheDocument(); // Click Rate
        expect(screen.getByText('1,200')).toBeInTheDocument(); // Total Views
        expect(screen.getByText(/3m 5s/)).toBeInTheDocument(); // Avg Time
    });

    it('fetches metrics for the selected week using newsletter ID', async () => {
        renderDashboard();

        await waitFor(() => {
            expect(screen.getByText('45.5%')).toBeInTheDocument();
        });

        // Change Week - now selects by newsletter ID, not week_number
        const selects = await screen.findAllByRole('combobox');
        const weekSelect = selects[1]; // 0 is class, 1 is week
        fireEvent.change(weekSelect, { target: { value: mockNewsletterId2 } });

        // Verify hook was called with the newsletter ID (UUID format)
        await waitFor(() => {
             expect(useAnalyticsQuery.useNewsletterMetrics).toHaveBeenCalledWith(mockNewsletterId2, expect.anything());
        });
    });

    it('displays trend charts and tables', async () => {
        renderDashboard();
        
        // Trend Chart Title
        await waitFor(() => {
            expect(screen.getByText('Engagement Trend')).toBeInTheDocument();
        });

        // Class Table
        expect(screen.getByText('Engagement by Class')).toBeInTheDocument();
        
        // Article Table
        expect(screen.getByText('Article Performance')).toBeInTheDocument();
    });
    
    it('handles manual refresh', async () => {
        renderDashboard();
        
        // Wait for initial load
        await waitFor(() => {
             expect(screen.getByText('45.5%')).toBeInTheDocument();
        });

        const refreshBtn = screen.getByTitle('Reload Data');
        fireEvent.click(refreshBtn);
        
        // Verify refetch was called
        await waitFor(() => {
            expect(mockRefetch).toHaveBeenCalled();
        });
    });

    it('uses newsletter UUID when the default newsletter has no week number', async () => {
        vi.mocked(useAnalyticsQuery.useAvailableWeeks).mockReturnValue({
            weeks: [
                {
                    id: mockNewsletterId1,
                    week_number: null,
                    title: 'Special Edition',
                    release_date: '2025-01-02',
                },
                {
                    id: mockNewsletterId2,
                    week_number: '2024-W52',
                    release_date: '2024-12-25',
                },
            ],
            loading: false,
        } as ReturnType<typeof useAnalyticsQuery.useAvailableWeeks>)

        renderDashboard()

        await waitFor(() => {
            expect(useAnalyticsQuery.useNewsletterMetrics).toHaveBeenCalledWith(
                mockNewsletterId1,
                expect.anything()
            )
        })
    })
});
