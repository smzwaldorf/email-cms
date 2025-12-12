import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AnalyticsDashboardPage } from '@/pages/AnalyticsDashboardPage';
import { AnalyticsProvider } from '@/context/AnalyticsContext';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as useAnalyticsQuery from '@/hooks/useAnalyticsQuery';
import React from 'react';

// Mock Hooks (Simplified for persistence verification)
vi.mock('@/hooks/useAnalyticsQuery', () => ({
    useAvailableWeeks: vi.fn(() => ({ 
        weeks: [{ week_number: '2025-W01', release_date: '2025-01-01' }, { week_number: '2024-W52', release_date: '2024-12-25' }],
        loading: false 
    })),
    // Other hooks need to return valid objects to prevent crash
    useNewsletterMetrics: vi.fn(() => ({ metrics: null, loading: false, refreshing: false, refetch: vi.fn() })),
    useTrendStats: vi.fn(() => ({ trend: [], loading: false, refreshing: false, refetch: vi.fn() })),
    useClassEngagement: vi.fn(() => ({ data: [], loading: false, refreshing: false, refetch: vi.fn() })),
    useArticleStats: vi.fn(() => ({ stats: [], loading: false, refreshing: false, refetch: vi.fn() })),
    useTopicHotness: vi.fn(() => ({ hotness: [], refreshing: false, refetch: vi.fn() })),
    useGenerateSnapshots: vi.fn(() => ({ generate: vi.fn(), generating: false })),
    useAllClasses: vi.fn(() => ({ classes: [], loading: false }))
}));

// Mock AdminLayout
vi.mock('@/components/admin/AdminLayout', () => ({
    AdminLayout: ({ children }: any) => <div>{children}</div>
}));

// Mock Components to avoid rendering noise
vi.mock('@/components/analytics/KPICard', () => ({ KPICard: () => <div>KPI</div> }));
vi.mock('@/components/analytics/TrendChart', () => ({ TrendChart: () => <div>TrendChart</div> }));

describe('Analytics Persistence', () => {
    it('persists state when navigating away and back (simulated)', async () => {
        const queryClient = new QueryClient();
        
        // Component to toggle visibility
        const TestApp = () => {
            const [showDashboard, setShowDashboard] = React.useState(true);
            return (
                <QueryClientProvider client={queryClient}>
                    <AnalyticsProvider>
                        <BrowserRouter>
                            {showDashboard ? (
                                <AnalyticsDashboardPage />
                            ) : (
                                <button onClick={() => setShowDashboard(true)}>Back to Dashboard</button>
                            )}
                             {showDashboard && (
                                <button onClick={() => setShowDashboard(false)}>Go Away</button>
                            )}
                        </BrowserRouter>
                    </AnalyticsProvider>
                </QueryClientProvider>
            );
        };

        render(<TestApp />);

        // 1. Initial State: Dashboard visible.
        const selects = await screen.findAllByRole('combobox');
        const weekSelect = selects[1];
        
        // Change to 2024-W52
        fireEvent.change(weekSelect, { target: { value: '2024-W52' } });

        // 2. Click "Go Away" to unmount Dashboard (but keep Provider)
        fireEvent.click(screen.getByText('Go Away'));
        
        await waitFor(() => {
            expect(screen.queryByText('Analytics Dashboard')).not.toBeInTheDocument();
        });

        // 3. Click "Back to Dashboard" to remount
        fireEvent.click(screen.getByText('Back to Dashboard'));

        // 4. Verify Week 2024-W52 is still selected (hook called with it)
        // Since we are checking if the component *remembers* the state on mount.
        await waitFor(() => {
             // The most recent call should be with the persisted week
             expect(useAnalyticsQuery.useNewsletterMetrics).toHaveBeenLastCalledWith('2024-W52', expect.anything());
        });
    });

    it('persists liveUpdate state when navigating away and back', async () => {
        const queryClient = new QueryClient();
        
        // Component to toggle visibility
        const TestApp = () => {
            const [showDashboard, setShowDashboard] = React.useState(true);
            return (
                <QueryClientProvider client={queryClient}>
                    <AnalyticsProvider>
                        <BrowserRouter>
                            {showDashboard ? (
                                <AnalyticsDashboardPage />
                            ) : (
                                <button onClick={() => setShowDashboard(true)}>Back to Dashboard</button>
                            )}
                             {showDashboard && (
                                <button onClick={() => setShowDashboard(false)}>Go Away</button>
                            )}
                        </BrowserRouter>
                    </AnalyticsProvider>
                </QueryClientProvider>
            );
        };

        render(<TestApp />);

        // 1. Enable live update
        const liveBtn = screen.getByTitle('Enable live updates (every 5s)');
        fireEvent.click(liveBtn);
        
        // Verify it's now enabled
        expect(screen.getByTitle('Disable live updates')).toBeInTheDocument();

        // 2. Click "Go Away" to unmount Dashboard (but keep Provider)
        fireEvent.click(screen.getByText('Go Away'));
        
        await waitFor(() => {
            expect(screen.queryByText('Analytics Dashboard')).not.toBeInTheDocument();
        });

        // 3. Click "Back to Dashboard" to remount
        fireEvent.click(screen.getByText('Back to Dashboard'));

        // 4. Verify liveUpdate is still enabled (button should show "Disable")
        await waitFor(() => {
            expect(screen.getByTitle('Disable live updates')).toBeInTheDocument();
        });
    });
});
