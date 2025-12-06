import { useState, useEffect } from 'react';
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

  const refetch = async () => {
      setLoading(true);
      try {
          const data = await analyticsAggregator.getNewsletterMetrics(newsletterId);
          setMetrics(data);
          setError(null);
      } catch (err) {
          console.error('[Analytics] Failed to refetch metrics:', err);
          setError(err instanceof Error ? err : new Error('Unknown error'));
      } finally {
          setLoading(false);
      }
  };

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

    const refetch = async () => {
        if (!newsletterId) return;
        setLoading(true);
        try {
            const data = await analyticsAggregator.getArticleStats(newsletterId);
            setStats(data);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

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

    const refetch = async () => {
        setLoading(true);
        try {
            const data = await analyticsAggregator.getTrendStats(6);
            setTrend(data);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    return { trend, loading, refetch };
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
