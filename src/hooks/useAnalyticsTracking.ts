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
  enabled?: boolean; // Defaults to true, set to false to skip tracking
}

/**
 * Hook to handle analytics tracking for pages.
 * Tracks page views on mount, time spent reading, and handles session management.
 */
export function useAnalyticsTracking({ articleId, weekNumber, classId, enabled = true }: UseAnalyticsTrackingProps = {}) {
  const location = useLocation();
  const { user } = useAuth();
  const sessionIdRef = useRef<string>('');

  const lastLoggedKeyRef = useRef<string>(''); // Track the unique key of the last logged view
  
  // Time tracking refs
  const startTimeRef = useRef<number>(0);
  const accumulatedTimeRef = useRef<number>(0); // Accumulated visible time in ms
  const isVisibleRef = useRef<boolean>(true);
  const hasLoggedEndRef = useRef<boolean>(false); // Prevent duplicate session_end logs
  
  // Store current values in refs for cleanup function access
  const currentContextRef = useRef({
    articleId: articleId,
    weekNumber: weekNumber,
    classId: classId,
    userId: user?.id,
    pathname: location.pathname
  });
  
  // Update refs when values change
  useEffect(() => {
    currentContextRef.current = {
      articleId,
      weekNumber,
      classId,
      userId: user?.id,
      pathname: location.pathname
    };
  }, [articleId, weekNumber, classId, user?.id, location.pathname]);

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
    if (!enabled) return;
    if (!sessionIdRef.current) return;
    
    const currentKey = `${location.pathname}:${articleId || ''}:${weekNumber || ''}`;

    // Prevent duplicate logging for the same context
    if (lastLoggedKeyRef.current === currentKey) return;

    const trackView = async () => {
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
  }, [enabled, articleId, weekNumber, classId, user?.id, location.pathname, location.search]);

  // Time Tracking with Visibility API
  useEffect(() => {
    if (!articleId || !enabled) return;
    
    // Reset time tracking for new article
    startTimeRef.current = Date.now();
    accumulatedTimeRef.current = 0;
    isVisibleRef.current = !document.hidden;
    hasLoggedEndRef.current = false;
    
    const handleVisibilityChange = () => {
      if (document.hidden) {
        // Page became hidden - accumulate time
        if (isVisibleRef.current && startTimeRef.current > 0) {
          accumulatedTimeRef.current += Date.now() - startTimeRef.current;
        }
        isVisibleRef.current = false;
      } else {
        // Page became visible - restart timer
        startTimeRef.current = Date.now();
        isVisibleRef.current = true;
      }
    };
    
    // Log session end - inline function that reads from refs
    const logSessionEnd = async () => {
      if (hasLoggedEndRef.current) return;
      
      const ctx = currentContextRef.current;
      if (!ctx.articleId) return;
      
      // Calculate final time spent
      let totalTime = accumulatedTimeRef.current;
      if (isVisibleRef.current && startTimeRef.current > 0) {
        totalTime += Date.now() - startTimeRef.current;
      }
      
      const timeSpentSeconds = Math.round(totalTime / 1000);
      
      // Only log if user spent at least 3 seconds (filters out React Strict Mode double-mount)
      if (timeSpentSeconds < 3) return;
      
      hasLoggedEndRef.current = true;
      
      await trackingService.logEvent({
        user_id: ctx.userId || null,
        session_id: sessionIdRef.current,
        event_type: 'session_end',
        newsletter_id: ctx.weekNumber || null,
        article_id: ctx.articleId,
        metadata: {
          path: ctx.pathname,
          time_spent_seconds: timeSpentSeconds,
          class_id: ctx.classId
        }
      });
    };
    
    const handleBeforeUnload = () => {
      logSessionEnd();
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('pagehide', handleBeforeUnload);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('pagehide', handleBeforeUnload);
      
      // Log session end when navigating away (component unmount)
      logSessionEnd();
    };
  }, [articleId, enabled]); // Minimal dependencies - reads other values from refs

  // Scroll Tracking (Simplified)
  useEffect(() => {
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


