import { backendRequest } from '@/services/backendApi';
import { AnalyticsEvent } from '@/types/analytics';
import type { TrackingMetadata } from '@/types/tracking';

/**
 * Service for handling analytics events and read status.
 */
export const trackingService = {
  
  /**
   * Logs an analytics event to the database.
   * Warns on failures without disrupting reading. Tracking is always enabled.
   * Note: newsletter_id is expected to be a UUID.
   */
  async logEvent(event: Omit<AnalyticsEvent, 'id' | 'created_at'>): Promise<void> {
    try {
      const { user_id: _userId, ...payload } = event;
      await backendRequest('/api/reader/events', {
        method: 'POST', body: JSON.stringify(payload), keepalive: true,
      });
    } catch (error) {
      console.warn('[Analytics] Failed to log event:', error);
    }
  },

  /**
   * Fetches the list of article IDs that the user has read (viewed) in a specific week.
   * @param _userId Compatibility argument; the server uses the signed-in user.
   * @param newsletterId The newsletter week number or UUID.
   * @returns Array of article IDs.
   */
  async getReadArticles(_userId: string, newsletterId?: string): Promise<string[]> {
    try {
      const query = newsletterId ? `?newsletterId=${encodeURIComponent(newsletterId)}` : '';
      return await backendRequest<string[]>(`/api/reader/read-articles${query}`);
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
  identifySession(_sessionId: string, _metadata?: TrackingMetadata): void {
    // Placeholder for potential session metadata updates if we have a sessions table
    // For now, we just pass sessionId with events.
  }
};

