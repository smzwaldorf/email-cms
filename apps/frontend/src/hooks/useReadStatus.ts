import { useState, useEffect, useCallback, useRef } from 'react';
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
  const isMountedRef = useRef(true);

  // Fetch initial read status
  useEffect(() => {
    isMountedRef.current = true;
    
    if (!user?.id) return;

    const fetchReadStatus = async () => {
      if (!isMountedRef.current) return;
      setIsLoading(true);
      try {
        const ids = await trackingService.getReadArticles(user.id, weekNumber);
        if (isMountedRef.current) {
          setReadArticleIds(new Set(ids));
        }
      } catch (error) {
        console.error('Failed to fetch read status', error);
      } finally {
        if (isMountedRef.current) {
          setIsLoading(false);
        }
      }
    };

    fetchReadStatus();
    
    return () => {
      isMountedRef.current = false;
    };
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
