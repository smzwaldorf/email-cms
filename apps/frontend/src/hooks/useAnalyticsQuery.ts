import { useState } from 'react'; // keeping useState for generateSnapshots
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/context/AuthContext';
import { analyticsAggregator } from '@/services/analyticsAggregator';

function useAnalyticsScopeKey() {
  const { user } = useAuth();
  return JSON.stringify([user?.id, user?.roles ?? [user?.role], user?.teacherClassIds, user?.parentClassIds]);
}

/**
 * Hook to fetch analytics metrics for a newsletter.
 * Uses TanStack Query for caching and state management.
 */
export function useNewsletterMetrics(newsletterId: string, className?: string, tracker: 'resend' | 'cms' = 'resend') {
  const scopeKey = useAnalyticsScopeKey();
  const { data, isLoading, error, refetch, isRefetching } = useQuery({
    queryKey: ['newsletterMetrics', newsletterId, className, tracker, scopeKey],
    queryFn: () => analyticsAggregator.getNewsletterMetrics(newsletterId, className, tracker),
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
    refreshing: isRefetching,
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
  const scopeKey = useAnalyticsScopeKey();
  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['articleStats', newsletterId, scopeKey],
    // Use fallback method for snapshot optimization
    queryFn: () => analyticsAggregator.getArticleStatsWithFallback(newsletterId),
    enabled: !!newsletterId,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  return { 
    stats: data || [], 
    loading: isLoading,
    refreshing: isRefetching, 
    refetch: () => refetch() 
  };
}

export function useTrendStats(className?: string, tracker: 'resend' | 'cms' = 'resend') {
  const scopeKey = useAnalyticsScopeKey();
  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['trendStats', className, tracker, scopeKey],
    queryFn: () => analyticsAggregator.getTrendStats(12, className, tracker),
    staleTime: 1000 * 60 * 60, // 1 hour (trends don't change often)
  });

  return { 
    trend: data || [], 
    loading: isLoading,
    refreshing: isRefetching, 
    refetch: () => refetch() 
  };
}

export function useClassEngagement(newsletterId: string) {
  const scopeKey = useAnalyticsScopeKey();
  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['classEngagement', newsletterId, scopeKey],
    queryFn: () => analyticsAggregator.getClassEngagement(newsletterId),
    enabled: !!newsletterId,
    staleTime: 1000 * 60 * 15, // 15 minutes
  });

  return { 
    data: data || [], 
    loading: isLoading, 
    refreshing: isRefetching,
    refetch: () => refetch() 
  };
}

export function useAvailableWeeks() {
  const scopeKey = useAnalyticsScopeKey();
  const { data, isLoading } = useQuery({
    queryKey: ['availableWeeks', scopeKey],
    queryFn: () => analyticsAggregator.getAvailableWeeks(),
    staleTime: 1000 * 60 * 60, // 1 hour
  });

  return { 
    weeks: data || [], 
    loading: isLoading 
  };
}

export function useTopicHotness(newsletterId: string) {
  const scopeKey = useAnalyticsScopeKey();
  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['topicHotness', newsletterId, scopeKey],
    queryFn: () => analyticsAggregator.getTopicHotness(newsletterId),
    enabled: !!newsletterId,
  });

  return { 
    hotness: data || [], 
    loading: isLoading,
    refreshing: isRefetching, 
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

export const useClassHistory = (className: string) => {
  const scopeKey = useAnalyticsScopeKey();
  const { data, isLoading, error } = useQuery({
    queryKey: ['classHistory', className, scopeKey],
    queryFn: () => analyticsAggregator.getClassHistory(className), enabled: !!className,
  });
  return { history: data || [], loading: isLoading, error: error as Error | null };
};

export const useAllClasses = () => {
  const scopeKey = useAnalyticsScopeKey();
  const { data, isLoading, error } = useQuery({
    queryKey: ['analyticsClasses', scopeKey], queryFn: () => analyticsAggregator.getAllClasses(),
  });
  return { classes: data || [], loading: isLoading, error: error as Error | null };
};

export const useArticleReaders = (articleId: string) => {
  const scopeKey = useAnalyticsScopeKey();
  const { data, isLoading, error } = useQuery({
    queryKey: ['articleReaders', articleId, scopeKey],
    queryFn: () => analyticsAggregator.getArticleReaders(articleId), enabled: !!articleId,
  });
  return { readers: data || [], loading: isLoading, error: error as Error | null };
};

export const useArticleMetadata = (articleId: string) => {
  const scopeKey = useAnalyticsScopeKey();
  const { data, isLoading, error } = useQuery({
    queryKey: ['articleMetadata', articleId, scopeKey],
    queryFn: () => analyticsAggregator.getArticleMetadata(articleId), enabled: !!articleId,
  });
  return { metadata: data || null, loading: isLoading, error: error as Error | null };
};
