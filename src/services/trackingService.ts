import { getSupabaseClient } from '@/lib/supabase';
import { AnalyticsEvent } from '@/types/analytics';

/**
 * Service for handling analytics events and read status.
 */
export const trackingService = {
  
  /**
   * Logs an analytics event to the database.
   * Silently fails in production to avoid disrupting user experience, but logs to console in dev.
   */
  async logEvent(event: Omit<AnalyticsEvent, 'id' | 'created_at'>): Promise<void> {
    if (!import.meta.env.VITE_TRACKING_ENABLED) {
      if (import.meta.env.DEV) {
        console.log('[Analytics] Event skipped (disabled):', event);
      }
      return;
    }

    try {
      const { error } = await getSupabaseClient()
        .from('analytics_events')
        .insert(event);

      if (error) {
        throw error;
      }

      if (import.meta.env.DEV) {
        console.log('[Analytics] Event logged:', event);
      }
    } catch (error) {
      console.warn('[Analytics] Failed to log event:', error);
    }
  },

  /**
   * Fetches the list of article IDs that the user has read (viewed) in a specific week.
   * @param userId The user ID to check.
   * @param weekNumber The newsletter week number.
   * @returns Array of article IDs.
   */
  async getReadArticles(userId: string, weekNumber?: string): Promise<string[]> {
    try {
      let query = getSupabaseClient()
        .from('analytics_events')
        .select('article_id')
        .eq('user_id', userId)
        .eq('event_type', 'page_view')
        .not('article_id', 'is', null);

      if (weekNumber) {
        query = query.eq('week_number', weekNumber);
      }

      const { data, error } = await query;

      if (error) {
        throw error;
      }

      // Use Set to return unique IDs
      const uniqueIds = new Set(data?.map(row => row.article_id as string) || []);
      return Array.from(uniqueIds);
    } catch (error) {
      console.warn('[Analytics] Failed to fetch read articles:', error);
      return [];
    }
  },

  /**
   * Identifies the current user/session.
   * Can be used to update session metadata if needed.
   * @param _sessionId
   * @param _metadata
   */
  identifySession(_sessionId: string, _metadata?: any): void {
    // Placeholder for potential session metadata updates if we have a sessions table
    // For now, we just pass sessionId with events.
  }
};
