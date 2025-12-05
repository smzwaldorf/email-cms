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
  const hasLoggedViewRef = useRef<boolean>(false);

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
    // Reset view tracking on route change if articleId changes or it's a new mount
    // But this hook might be re-mounted.
    // We want to track unique views per session/page-load context basically.
    
    // Check if we already logged this specific view instance
    if (hasLoggedViewRef.current) return;

    if (!sessionIdRef.current) return; // Wait for session init

    const trackView = async () => {
      // Determine effective user ID (auth user or from token)
      // For now, use auth user. Token logic can be added if we support anonymous tracking via token.
      const userId = user?.id; // Allow null for anonymous if needed, but schema might require it?
      // Schema: user_id UUID references user_roles. Can be nullable? 
      // T002 says user_id (FK). If it's nullable, we can support anon.
      // Looking at migration: "user_id" uuid references "public"."user_roles"("id").
      // It DOES NOT say NOT NULL. So it is nullable.
      
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
      
      hasLoggedViewRef.current = true;
    };

    trackView();

    // Cleanup: if props change meaningfully, allow re-logging?
    // React strict mode might double invoke. hasLoggedViewRef helps.
    // If articleId changes, component usually unmounts/remounts or props update.
    // If props update, we should reset hasLoggedViewRef?
    return () => {
       // Cleanup if needed
    };
  }, [articleId, weekNumber, classId, user?.id, location.pathname]);

  // Reset ref if key props change effectively (handled by dependency array usually re-triggering effect, 
  // but if effect re-runs, we need to allow it.
  // Actually, hasLoggedViewRef persists across re-renders. 
  // We need to reset it if the "page" context changes.
  useEffect(() => {
      hasLoggedViewRef.current = false;
  }, [articleId, weekNumber, location.pathname]); 

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
