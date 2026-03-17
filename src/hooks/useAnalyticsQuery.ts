import { useState, useEffect } from 'react'; // keeping useState for generateSnapshots
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { analyticsAggregator } from '@/services/analyticsAggregator';

/**
 * Hook to fetch analytics metrics for a newsletter.
 * Uses TanStack Query for caching and state management.
 */
export function useNewsletterMetrics(newsletterId: string, className?: string) {
  const { data, isLoading, error, refetch, isRefetching } = useQuery({
    queryKey: ['newsletterMetrics', newsletterId, className],
    queryFn: () => analyticsAggregator.getNewsletterMetrics(newsletterId, className),
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
  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['articleStats', newsletterId],
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

export function useTrendStats(className?: string) {
  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['trendStats', className],
    queryFn: () => analyticsAggregator.getTrendStats(12, className),
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
  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['classEngagement', newsletterId],
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
  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['topicHotness', newsletterId],
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
    const [history, setHistory] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!className) return;
        const fetchHistory = async () => {
            setLoading(true);
            try {
                const data = await analyticsAggregator.getClassHistory(className);
                setHistory(data);
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        fetchHistory();
    }, [className]);

    return { history, loading };
};

export const useAllClasses = () => {
    const [classes, setClasses] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchClasses = async () => {
            setLoading(true);
            try {
                const data = await analyticsAggregator.getAllClasses();
                setClasses(data);
            } catch (err) {
                console.error(err);
                // Fallback or empty
                setClasses([]);
            } finally {
                setLoading(false);
            }
        };
        fetchClasses();
    }, []);

    return { classes, loading };
};

export const useArticleReaders = (articleId: string) => {
    const [readers, setReaders] = useState<any[]>([]); 
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!articleId) return;
        const fetchReaders = async () => {
            setLoading(true);
            try {
                const data = await analyticsAggregator.getArticleReaders(articleId);
                setReaders(data);
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        fetchReaders();
    }, [articleId]);

    return { readers, loading };
};

export const useArticleMetadata = (articleId: string) => {
    const [metadata, setMetadata] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!articleId) return;
        const fetchMeta = async () => {
            setLoading(true);
            try {
                const data = await analyticsAggregator.getArticleMetadata(articleId);
                setMetadata(data);
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        fetchMeta();
    }, [articleId]);

    return { metadata, loading };
};


