import { useState } from 'react'; // keeping useState for generateSnapshots
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { analyticsAggregator } from '@/services/analyticsAggregator';

/**
 * Hook to fetch analytics metrics for a newsletter.
 * Uses TanStack Query for caching and state management.
 */
export function useNewsletterMetrics(newsletterId: string) {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['newsletterMetrics', newsletterId],
    queryFn: () => analyticsAggregator.getNewsletterMetrics(newsletterId),
    enabled: !!newsletterId,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  const safeRefetch = async () => {
    if (!newsletterId) return;
    return refetch();
  };

  return { 
    metrics: data || null, 
    loading: isLoading, 
    error: error as Error | null, 
    refetch: safeRefetch
  };
}

/**
 * Hook to trigger manual snapshot generation (Admin only usually).
 */
export function useGenerateSnapshots() {
  const [generating, setGenerating] = useState(false);
  const queryClient = useQueryClient();

  const generate = async (date?: string) => {
    try {
      setGenerating(true);
      await analyticsAggregator.generateDailySnapshot(date);
      // Invalidate all analytics queries
      queryClient.invalidateQueries({ queryKey: ['articleStats'] });
      queryClient.invalidateQueries({ queryKey: ['trendStats'] });
      
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
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['articleStats', newsletterId],
    // Use fallback method for snapshot optimization
    queryFn: () => analyticsAggregator.getArticleStatsWithFallback(newsletterId),
    enabled: !!newsletterId,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  return { 
    stats: data || [], 
    loading: isLoading, 
    refetch: () => refetch() 
  };
}

export function useTrendStats() {
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['trendStats'],
    queryFn: () => analyticsAggregator.getTrendStats(12),
    staleTime: 1000 * 60 * 60, // 1 hour (trends don't change often)
  });

  return { 
    trend: data || [], 
    loading: isLoading, 
    refetch: () => refetch() 
  };
}

export function useClassEngagement(newsletterId: string) {
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['classEngagement', newsletterId],
    queryFn: () => analyticsAggregator.getClassEngagement(newsletterId),
    enabled: !!newsletterId,
    staleTime: 1000 * 60 * 15, // 15 minutes
  });

  return { 
    data: data || [], 
    loading: isLoading, 
    refetch: () => refetch() 
  };
}

export function useAvailableWeeks() {
  const { data, isLoading } = useQuery({
    queryKey: ['availableWeeks'],
    queryFn: () => analyticsAggregator.getAvailableWeeks(),
    staleTime: 1000 * 60 * 60, // 1 hour
  });

  return { 
    weeks: data || [], 
    loading: isLoading 
  };
}

export function useTopicHotness(newsletterId: string) {
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['topicHotness', newsletterId],
    queryFn: () => analyticsAggregator.getTopicHotness(newsletterId),
    enabled: !!newsletterId,
  });

  return { 
    hotness: data || [], 
    loading: isLoading, 
    refetch: () => refetch() 
  };
}

// Helper to format read latency as hours and minutes
export function formatReadLatency(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remainingMins = minutes % 60;
  if (hours < 24) {
    return remainingMins > 0 ? `${hours}h ${remainingMins}m` : `${hours}h`;
  }
  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;
  return remainingHours > 0 ? `${days}d ${remainingHours}h` : `${days}d`;
}

