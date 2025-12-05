import { getSupabaseClient } from '@/lib/supabase';
import { AnalyticsEvent, AnalyticsSnapshot, AnalyticsMetrics } from '@/types/analytics';

/**
 * Service for aggregating raw analytics events into snapshots and calculating metrics.
 */
export const analyticsAggregator = {

  /**
   * Generates daily snapshots for a specific date.
   * Aggregates events by article, newsletter, and class.
   * @param date The date to generate snapshots for (YYYY-MM-DD). Defaults to yesterday.
   */
  async generateDailySnapshot(date?: string): Promise<void> {
    const targetDate = date || new Date(Date.now() - 86400000).toISOString().split('T')[0];
    const supabase = getSupabaseClient();

    console.log(`[Analytics] Generating snapshots for ${targetDate}...`);

    try {
      // 1. Fetch raw events for the target date
      // Note: In a real large-scale app, we would use a more efficient query or edge function
      const startOfDay = `${targetDate}T00:00:00.000Z`;
      const endOfDay = `${targetDate}T23:59:59.999Z`;

      const { data: events, error } = await supabase
        .from('analytics_events')
        .select('*')
        .gte('created_at', startOfDay)
        .lte('created_at', endOfDay);

      if (error) throw error;
      if (!events || events.length === 0) {
        console.log(`[Analytics] No events found for ${targetDate}`);
        return;
      }

      // 2. Aggregate data in memory (for MVP)
      // Key: `${newsletter_id}:${article_id}:${class_id}`
      const aggregations = new Map<string, {
        newsletter_id: string | null;
        article_id: string | null;
        class_id: string | null; // We need to fetch user roles to get class_id
        views: number;
        clicks: number;
        // opens? (opens are usually at newsletter level, not article)
      }>();

      // Helper to fetching user classes - simple cache
      const userClasses = new Map<string, string | null>(); 
      // Populate userClasses (this part assumes we can fetch user roles efficiently or we do it lazily)
      // For MVP, lets just group by what we have. analytics_events doesn't have class_id directly yet.
      // We might need to join with user_roles/enrollments.
      
      // OPTIMIZATION: For this MVP phase, let's Aggregate by (newsletter, article) first. 
      // Class breakdown requires joining.
      
      // Let's implement a simpler aggregation first: Total Views per Article per Newsletter
      const articleStats = new Map<string, { views: number }>();
      
      for (const event of events) {
        if (event.event_type === 'page_view' && event.article_id) {
           const key = `${event.newsletter_id || 'null'}:${event.article_id}`;
           const current = articleStats.get(key) || { views: 0 };
           current.views++;
           articleStats.set(key, current);
        }
      }

      // 3. Insert Snapshots
      const snapshotsToInsert: Omit<AnalyticsSnapshot, 'id' | 'created_at'>[] = [];

      for (const [key, stats] of articleStats.entries()) {
        const [newsletterId, articleId] = key.split(':');
        
        snapshotsToInsert.push({
          snapshot_date: targetDate,
          newsletter_id: newsletterId === 'null' ? null : newsletterId,
          article_id: articleId,
          class_id: null, // Global stats for now
          metric_name: 'total_views',
          metric_value: stats.views
        });
      }

      if (snapshotsToInsert.length > 0) {
         const { error: insertError } = await supabase
           .from('analytics_snapshots')
           .insert(snapshotsToInsert);
         
         if (insertError) throw insertError;
         console.log(`[Analytics] Inserted ${snapshotsToInsert.length} snapshots.`);
      }

    } catch (err) {
      console.error('[Analytics] Snapshot generation failed:', err);
      throw err;
    }
  },

  /**
   * Calculates metrics for a specific newsletter.
   * Computes Open Rate and Click Rate.
   */
  async getNewsletterMetrics(newsletterId: string): Promise<AnalyticsMetrics> {
    const supabase = getSupabaseClient();
    
    // Get total recipients (approximate from user_roles or enrollment)
    // For MVP, let's assume valid users count or just use raw events count for now.
    // Real calculation: Unique Opens / Total Sent
    
    // 1. Get Unique Opens
    const { count: uniqueOpens, error: openError } = await supabase
      .from('analytics_events')
      .select('user_id', { count: 'exact', head: true }) // head: true for count only? No, we need distinct.
      // supbase-js doesn't support distinct count easily in one go without raw sql or generic helper
      // workaround: use .select('user_id') and manual set, or rpc.
      .eq('newsletter_id', newsletterId)
      .eq('event_type', 'email_open');
      
    // Actually, simpler query for MVP:
    const { data: openEvents } = await supabase
        .from('analytics_events')
        .select('user_id')
        .eq('newsletter_id', newsletterId)
        .eq('event_type', 'email_open');
        
    const uniqueOpenCount = new Set(openEvents?.map(e => e.user_id)).size;

    // 2. Get Unique Clicks
    const { data: clickEvents } = await supabase
        .from('analytics_events')
        .select('user_id')
        .eq('newsletter_id', newsletterId)
        .eq('event_type', 'link_click');
    
    const uniqueClickCount = new Set(clickEvents?.map(e => e.user_id)).size;

    // 3. Get Total Views (Article Reads)
    const { count: totalViews } = await supabase
        .from('analytics_events')
        .select('*', { count: 'exact', head: true })
        .eq('newsletter_id', newsletterId)
        .eq('event_type', 'page_view');

    // Mock Total Sent (since we don't have email log table yet, usually distinct students count)
    // Placeholder: 100
    const totalSent = 100; 

    return {
      openRate: totalSent > 0 ? (uniqueOpenCount / totalSent) * 100 : 0,
      clickRate: uniqueOpenCount > 0 ? (uniqueClickCount / uniqueOpenCount) * 100 : 0, // Click-to-open rate usually
      avgTimeSpent: 0, // Not implemented yet
      totalViews: totalViews || 0 // Total page views
    };
  }
};
