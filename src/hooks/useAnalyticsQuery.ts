import { useState, useEffect, useCallback } from 'react';
import { analyticsAggregator } from '@/services/analyticsAggregator';
import { AnalyticsMetrics } from '@/types/analytics';

/**
 * Hook to fetch analytics metrics for a newsletter.
 * Includes simple caching/state management.
 */
export function useNewsletterMetrics(newsletterId: string) {
  const [metrics, setMetrics] = useState<AnalyticsMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let mounted = true;

    async function fetchMetrics() {
      if (!newsletterId) return;
      
      try {
        setLoading(true);
        const data = await analyticsAggregator.getNewsletterMetrics(newsletterId);
        if (mounted) {
          setMetrics(data);
          setError(null);
        }
      } catch (err) {
        if (mounted) {
          console.error('[Analytics] Failed to fetch metrics:', err);
          setError(err instanceof Error ? err : new Error('Unknown error'));
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    fetchMetrics();

    return () => {
      mounted = false;
    };
  }, [newsletterId]);

  const refetch = useCallback(async (isBackground = false) => {
      if (!newsletterId) return;
      
      try {
          if (!isBackground) {
              setLoading(true);
              console.log('[Analytics] Refetching metrics for:', newsletterId);
          }
          const data = await analyticsAggregator.getNewsletterMetrics(newsletterId);
          setMetrics(data);
          setError(null);
          console.log('[Analytics] Metrics refetched successfully');
      } catch (err) {
          console.error('[Analytics] Failed to refetch metrics:', err);
          setError(err instanceof Error ? err : new Error('Unknown error'));
      } finally { 
          setLoading(false); 
      }
  }, [newsletterId]);

  return { metrics, loading, error, refetch };
}

/**
 * Hook to trigger manual snapshot generation (Admin only usually).
 */
export function useGenerateSnapshots() {
  const [generating, setGenerating] = useState(false);

  const generate = async (date?: string) => {
    try {
      setGenerating(true);
      await analyticsAggregator.generateDailySnapshot(date);
      alert('Snapshots generated successfully!');
    } catch (err) {
      alert('Failed to generate snapshots');
      console.error(err);
    } finally {
      setGenerating(false);
    }
  };

  return { generate, generating };
}

export function useArticleStats(newsletterId: string) {
    const [stats, setStats] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetch() {
            if (!newsletterId) return;
            try {
                setLoading(true);
                const data = await analyticsAggregator.getArticleStats(newsletterId);
                setStats(data);
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        }
        fetch();
    }, [newsletterId]);

    const refetch = useCallback(async (isBackground = false) => {
        if (!newsletterId) return;
        if (!isBackground) setLoading(true);
        try {
            const data = await analyticsAggregator.getArticleStats(newsletterId);
            setStats(data);
        } catch (e) {
            console.error(e);
        } finally { 
            setLoading(false); 
        }
    }, [newsletterId]);

    return { stats, loading, refetch };
}

export function useTrendStats() {
    const [trend, setTrend] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetch() {
            try {
                setLoading(true);
                // Fetch last 6 weeks for trend
                const data = await analyticsAggregator.getTrendStats(6);
                setTrend(data);
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        }
        fetch();
    }, []);

    const refetch = useCallback(async (isBackground = false) => {
        if (!isBackground) setLoading(true);
        try {
            const data = await analyticsAggregator.getTrendStats(6);
            setTrend(data);
        } catch (e) {
            console.error(e);
        } finally { 
            setLoading(false); 
        }
    }, []);

    return { trend, loading, refetch };
}

export function useClassEngagement(newsletterId: string) {
  const [data, setData] = useState<{ className: string; activeUsers: number; totalUsers: number }[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchEngagement = useCallback(async (isBackground = false) => {
      if (!newsletterId) return;
      if (typeof isBackground !== 'boolean' || !isBackground) setLoading(true);
      try {
          const result = await analyticsAggregator.getClassEngagement(newsletterId);
          setData(result);
      } catch (err) {
          console.error(err);
      } finally { 
          setLoading(false); 
      }
  }, [newsletterId]);

  useEffect(() => {
    fetchEngagement();
  }, [fetchEngagement]);

  return { data, loading, refetch: fetchEngagement };
}

export function useAvailableWeeks() {
    const [weeks, setWeeks] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetch() {
            try {
                setLoading(true);
                const data = await analyticsAggregator.getAvailableWeeks();
                setWeeks(data);
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        }
        fetch();
    }, []);

    return { weeks, loading };
}
