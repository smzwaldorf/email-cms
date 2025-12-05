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

  return { metrics, loading, error };
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
