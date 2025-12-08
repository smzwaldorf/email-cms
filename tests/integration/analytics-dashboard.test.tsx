import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AnalyticsDashboardPage } from '@/pages/AnalyticsDashboardPage';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Mock Hooks
const mockRefetch = vi.fn();
const mockGenerate = vi.fn();

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

vi.mock('@/hooks/useAnalyticsQuery', () => ({
    useAvailableWeeks: vi.fn(() => ({ 
        weeks: [{ week_number: '2025-W01', release_date: '2025-01-01' }, { week_number: '2024-W52', release_date: '2024-12-25' }],
        loading: false 
    })),
    useNewsletterMetrics: vi.fn((week) => ({ 
        metrics: week ? { openRate: 45.5, clickRate: 12.3, totalViews: 1200, avgTimeSpent: 185 } : null,
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
    CountUp: ({ end, suffix = '', prefix = '' }: any) => <span>{prefix}{end.toLocaleString()}{suffix}</span>
}));

// Mock AdminLayout to avoid side effects (Supabase calls, Auth)
vi.mock('@/components/admin/AdminLayout', () => ({
    AdminLayout: ({ children }: any) => <div>{children}</div>
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
    AuthContext: { Provider: ({ children }: any) => children } // Fallback if needed
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

    it('fetches metrics for the selected week', async () => {
        renderDashboard();

        await waitFor(() => {
            expect(screen.getByText('45.5%')).toBeInTheDocument();
        });

        // Change Week
        const selects = await screen.findAllByRole('combobox');
        const weekSelect = selects[1]; // 0 is class, 1 is week
        fireEvent.change(weekSelect, { target: { value: '2024-W52' } });

        // Note: verifying data change is tricky with the current static mock in this file
        // unless we make the mock dynamic. But calling the hook with different arg is verified by Hook mock.
        await waitFor(() => {
             // Verify hook was called with new week and empty class
             expect(useAnalyticsQuery.useNewsletterMetrics).toHaveBeenCalledWith('2024-W52', expect.anything());
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
});
