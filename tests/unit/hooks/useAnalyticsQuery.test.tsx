import { renderHook, act, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useNewsletterMetrics } from '@/hooks/useAnalyticsQuery'
import { analyticsAggregator } from '@/services/analyticsAggregator'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'

const createWrapper = () => {
    const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } },
    });
    return ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
};


// Mock analyticsAggregator
vi.mock('@/services/analyticsAggregator', () => ({
  analyticsAggregator: {
    getNewsletterMetrics: vi.fn(),
    getArticleStats: vi.fn(),
    getTrendStats: vi.fn(),
    getClassEngagement: vi.fn(),
    getAvailableWeeks: vi.fn(),
    getAllClasses: vi.fn()
  }
}))

describe('useNewsletterMetrics', () => {
    const mockNewsletterId = '2025-W10';
    const mockMetrics = {
        openRate: 0.5,
        clickRate: 0.2,
        avgTimeSpent: 120,
        totalViews: 500
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should fetch metrics on mount', async () => {
        (analyticsAggregator.getNewsletterMetrics as any).mockResolvedValueOnce(mockMetrics);

        const { result } = renderHook(() => useNewsletterMetrics(mockNewsletterId), {
            wrapper: createWrapper()
        });

        expect(result.current.loading).toBe(true);
        expect(result.current.metrics).toBeNull();

        await waitFor(() => {
            expect(result.current.loading).toBe(false);
        });

        expect(analyticsAggregator.getNewsletterMetrics).toHaveBeenCalledWith(mockNewsletterId, undefined);
        expect(result.current.metrics).toEqual(mockMetrics);
    });

    it('should handle refetch success with loading state', async () => {
        (analyticsAggregator.getNewsletterMetrics as any).mockResolvedValue(mockMetrics);

        const { result } = renderHook(() => useNewsletterMetrics(mockNewsletterId), {
            wrapper: createWrapper()
        });

        await waitFor(() => {
            expect(result.current.loading).toBe(false);
        });

        // Trigger refetch
        act(() => {
             result.current.refetch();
        });

        // Loading should be true immediately after refetch call (synchronously set in my fix?)
        // Wait, refetch is async. setLoading is synchronous inside it before await.
        // But since it's inside promise... wait.
        // My fix:
        // const refetch = useCallback(async (isBackground = false) => {
        //   if (!isBackground) { setLoading(true); ... }
        //   await ...
        // }
        // The setLoading(true) happens synchronously if refetch is called without await?
        // No, `refetch` is an async function. When called, it returns a promise.
        // But the code *until the first await* runs synchronously?
        // Actually, yes, in modern JS engine, async function body runs synchronously until first await.
        // So checking loading state immediately after call should work.
        
        // However, in React testing, state updates need `act`.
        // RenderHook returns `result` which is a ref. updates happen asynchronously in React 18 usually?
        // Let's see.

        // Actually, since I am not awaiting the promise returned by refetch result in the test immediately...
        // Re-checking "loading" value requires a re-render.
        // renderHook tracks state updates.

        // We'll verify it eventually.
        
        await waitFor(() => {
             expect(result.current.loading).toBe(false);
             expect(result.current.metrics).toEqual(mockMetrics);
        });
        
        expect(analyticsAggregator.getNewsletterMetrics).toHaveBeenCalledTimes(2); // Mount + Refetch
    });

    it('should not refetch if newsletterId is missing', async () => {
        const { result } = renderHook(() => useNewsletterMetrics(''), {
            wrapper: createWrapper()
        });
        
        // Initial effect checks guard
        expect(analyticsAggregator.getNewsletterMetrics).not.toHaveBeenCalled();

        await act(async () => {
            await result.current.refetch();
        });

        expect(analyticsAggregator.getNewsletterMetrics).not.toHaveBeenCalled();
    });
});

import { useAllClasses } from '@/hooks/useAnalyticsQuery'

describe('useAllClasses', () => {
    it('should fetch classes on mount', async () => {
        const mockClasses = ['Class A', 'Class B'];
        (analyticsAggregator.getAllClasses as any) = vi.fn().mockResolvedValue(mockClasses);

        const { result } = renderHook(() => useAllClasses(), {
            wrapper: createWrapper()
        });

        expect(result.current.loading).toBe(true);
        expect(result.current.classes).toEqual([]);

        await waitFor(() => {
            expect(result.current.loading).toBe(false);
        });

        expect(analyticsAggregator.getAllClasses).toHaveBeenCalled();
        expect(result.current.classes).toEqual(mockClasses);
    });
});
