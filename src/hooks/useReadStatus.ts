import { useState, useEffect, useCallback } from 'react';
import { trackingService } from '@/services/trackingService';
import { useAuth } from '@/context/AuthContext';

/**
 * Hook to manage read status of articles.
 * Provides a set of read article IDs and a method to manually mark as read (optimistic update).
 */
export function useReadStatus(weekNumber?: string) {
  const { user } = useAuth();
  const [readArticleIds, setReadArticleIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);

  // Fetch initial read status
  useEffect(() => {
    if (!user?.id) return;

    const fetchReadStatus = async () => {
      setIsLoading(true);
      try {
        const ids = await trackingService.getReadArticles(user.id, weekNumber);
        setReadArticleIds(new Set(ids));
      } catch (error) {
        console.error('Failed to fetch read status', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchReadStatus();
  }, [user?.id, weekNumber]);

  /**
   * Manually mark an article as read (useful for immediate UI feedback before next fetch).
   * Note: The actual logging happens via useAnalyticsTracking usually, 
   * but this can be used to update UI instantly when entering a page.
   */
  const markAsRead = useCallback((articleId: string) => {
    setReadArticleIds(prev => {
      const next = new Set(prev);
      next.add(articleId);
      return next;
    });
  }, []);

  return {
    readArticleIds,
    isLoading,
    markAsRead
  };
}
