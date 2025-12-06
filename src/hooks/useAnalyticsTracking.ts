import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { trackingService } from '@/services/trackingService';
import { ANALYTICS_CONFIG } from '@/config/analytics';
import { v4 as uuidv4 } from 'uuid';

export interface UseAnalyticsTrackingProps {
  articleId?: string;
  weekNumber?: string;
  classId?: string;
}

/**
 * Hook to handle analytics tracking for pages.
 * Tracks page views on mount and handles session management.
 */
export function useAnalyticsTracking({ articleId, weekNumber, classId }: UseAnalyticsTrackingProps = {}) {
  const location = useLocation();
  const { user } = useAuth();
  const sessionIdRef = useRef<string>('');

  const lastLoggedKeyRef = useRef<string>(''); // Track the unique key of the last logged view (e.g. articleId + pathname)

  // Initialize Session ID
  useEffect(() => {
    let sid = sessionStorage.getItem(ANALYTICS_CONFIG.sessionIdStorageKey);
    if (!sid) {
      sid = uuidv4();
      sessionStorage.setItem(ANALYTICS_CONFIG.sessionIdStorageKey, sid);
    }
    sessionIdRef.current = sid;
  }, []);

  // Track Page View
  useEffect(() => {
    if (!sessionIdRef.current) return; // Wait for session init
    
    // Construct a unique key for this view context
    // If articleId is present, we track per article.
    // If not, we track per path (e.g. dashboard list view).
    const currentKey = `${location.pathname}:${articleId || ''}:${weekNumber || ''}`;

    // Prevent duplicate logging for the same context
    if (lastLoggedKeyRef.current === currentKey) return;

    const trackView = async () => {
      // Determine effective user ID
      const userId = user?.id;
      
      await trackingService.logEvent({
        user_id: userId || null,
        session_id: sessionIdRef.current,
        event_type: 'page_view',
        newsletter_id: weekNumber || null,
        article_id: articleId || null,
        metadata: {
          path: location.pathname,
          search: location.search,
          class_id: classId
        }
      });
      
      lastLoggedKeyRef.current = currentKey;
    };

    trackView();
  }, [articleId, weekNumber, classId, user?.id, location.pathname, location.search]);

  // Scroll Tracking (Simplified)
  useEffect(() => {
      // Only track scroll on articles
      if (!articleId) return;

      const handleScroll = () => {
          // Implement scroll logic (throttle etc)
          // For MVP maybe wait.
      };
      
      window.addEventListener('scroll', handleScroll);
      return () => window.removeEventListener('scroll', handleScroll);
  }, [articleId]);

  return {
    sessionId: sessionIdRef.current
  };
}
