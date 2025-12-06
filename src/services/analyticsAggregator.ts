import { getSupabaseClient } from '@/lib/supabase';
import { AnalyticsEvent, AnalyticsSnapshot, AnalyticsMetrics } from '@/types/analytics';

export interface ClassEngagement {
    className: string;
    viewCount: number;
    activeUsers: number;
    totalUsers: number; // Placeholder for now, hard to get without full enrollment count
}

export interface ArticleReader {
    userId: string;
    email: string;
    role: string;
    className: string[]; // List of class names (e.g. "G1", "G2")
    studentNames: string[]; // List of student names related to this parent
    lastViewed: string;
    viewCount: number;
}

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

      // 0. Clear existing snapshots for this date to prevent duplicates (since UNIQUE allows multiple NULLs)
      console.log(`[Analytics] Clearing existing snapshots for ${targetDate}...`);
      const { error: deleteError } = await supabase
        .from('analytics_snapshots')
        .delete()
        .eq('snapshot_date', targetDate);
      
      if (deleteError) throw deleteError;

      const { data: events, error } = await supabase
        .from('analytics_events')
        .select('*')
        .gte('created_at', startOfDay)
        .select('*')
        .gte('created_at', startOfDay)
        .lte('created_at', endOfDay);

      console.log(`[Analytics] Fetched ${events?.length || 0} events.`);

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
         console.log(`[Analytics] Successfully inserted ${snapshotsToInsert.length} snapshots.`);
      } else {
         console.log('[Analytics] No snapshots to insert.');
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
    const QUERY_TIMEOUT_MS = 10000;
    
    // Helper to create a timeout promise
    const createTimeout = (ms: number) => new Promise((_, reject) => 
      setTimeout(() => reject(new Error(`Query timeout after ${ms}ms`)), ms)
    );
    
    try {
      // 1. Get Unique Opens
      const openEventsPromise = supabase
        .from('analytics_events')
        .select('user_id')
        .eq('newsletter_id', newsletterId)
        .eq('event_type', 'email_open');
      
      const openResult = await Promise.race([
        openEventsPromise,
        createTimeout(QUERY_TIMEOUT_MS)
      ]) as { data: { user_id: string }[] | null; error: Error | null };
      
      if (openResult.error) {
        console.error('[Analytics] Error fetching open events:', openResult.error);
        throw openResult.error;
      }
          
      const uniqueOpenCount = new Set(openResult.data?.map((e: { user_id: string }) => e.user_id)).size;

      // 2. Get Unique Clicks
      const clickEventsPromise = supabase
        .from('analytics_events')
        .select('user_id')
        .eq('newsletter_id', newsletterId)
        .eq('event_type', 'link_click');
      
      const clickResult = await Promise.race([
        clickEventsPromise,
        createTimeout(QUERY_TIMEOUT_MS)
      ]) as { data: { user_id: string }[] | null; error: Error | null };
      
      if (clickResult.error) {
        console.error('[Analytics] Error fetching click events:', clickResult.error);
        throw clickResult.error;
      }
      
      const uniqueClickCount = new Set(clickResult.data?.map((e: { user_id: string }) => e.user_id)).size;

      // 3. Get Total Views (Article Reads)
      const viewCountPromise = supabase
        .from('analytics_events')
        .select('*', { count: 'exact', head: true })
        .eq('newsletter_id', newsletterId)
        .eq('event_type', 'page_view');
      
      const viewResult = await Promise.race([
        viewCountPromise,
        createTimeout(QUERY_TIMEOUT_MS)
      ]) as { count: number | null; error: Error | null };

      if (viewResult.error) {
        console.error('[Analytics] Error fetching view count:', viewResult.error);
        throw viewResult.error;
      }

      // Mock Total Sent (since we don't have email log table yet, usually distinct students count)
      // Placeholder: 100
      const totalSent = 100; 

      return {
        openRate: totalSent > 0 ? (uniqueOpenCount / totalSent) * 100 : 0,
        clickRate: uniqueOpenCount > 0 ? (uniqueClickCount / uniqueOpenCount) * 100 : 0,
        avgTimeSpent: 0, // Not implemented yet
        totalViews: viewResult.count || 0
      };
    } catch (err) {
      console.error(`[Analytics] getNewsletterMetrics failed for ${newsletterId}:`, err);
      // Return default metrics instead of throwing to prevent cascade failures
      return {
        openRate: 0,
        clickRate: 0,
        avgTimeSpent: 0,
        totalViews: 0
      };
    }
  },

  /**
   * Fetches detailed statistics for all articles in a newsletter.
   */
  async getArticleStats(newsletterId: string) {
    const supabase = getSupabaseClient();
    
    // We want views, clicks, and title for each article
    // Note: We're doing client-side aggregation here for MVP. 
    // In production, use an RPC function or a view.
    
    // 1. Fetch Views per article
    const { data: viewEvents, error: viewError } = await supabase
      .from('analytics_events')
      .select('article_id, user_id, session_id, articles ( title, created_at, article_order )')
      .eq('newsletter_id', newsletterId)
      .eq('event_type', 'page_view');

    if (viewError) throw viewError;

    // 2. Fetch Clicks per article (if applicable, link_click usually has article_id if clicked FROM an article)
    // If link_click is "clicked a link IN an article", it should have article_id.
    const { data: clickEvents, error: clickError } = await supabase
      .from('analytics_events')
      .select('article_id')
      .eq('newsletter_id', newsletterId)
      .eq('event_type', 'link_click');

    if (clickError) throw clickError;

    // Aggregate
    const statsMap = new Map<string, { 
      id: string; 
      title: string; 
      publishedAt: string; 
      order: number;
      views: number; 
      uniqueViews: Set<string>; // Set of unique user/session IDs
      clicks: number;
    }>();

    viewEvents?.forEach((event: any) => {
        if (!event.article_id) return;
        
        if (!statsMap.has(event.article_id)) {
            const article = event.articles; // Joined data
            statsMap.set(event.article_id, {
                id: event.article_id,
                title: article?.title || 'Unknown Article',
                publishedAt: article?.created_at ? new Date(article.created_at).toLocaleDateString() : '-',
                order: article?.article_order || 999,
                views: 0,
                uniqueViews: new Set(),
                clicks: 0
            });
        }
        const stat = statsMap.get(event.article_id)!;
        stat.views++;
        // Track unique visitor: use user_id if logged in, else session_id
        stat.uniqueViews.add(event.user_id || event.session_id);
    });

    clickEvents?.forEach((event) => {
        if (!event.article_id) return;
        // Note: Clicks might exist without views if data is partial? 
        // We usually assume article exists in viewEvents map if referenced, 
        // but for safety we might check. For now, only count clicks for known articles.
        if (statsMap.has(event.article_id)) {
            statsMap.get(event.article_id)!.clicks++;
        }
    });

    return Array.from(statsMap.values()).map(stat => ({
        ...stat,
        uniqueViews: stat.uniqueViews.size, // Convert Set to count
        avgTimeSpent: '-' // Not implemented yet
    })).sort((a, b) => a.order - b.order); // Sort by article order
  },

  /**
   * Fetches trend data for the last N snapshots.
   * If snapshots are missing, it might return empty or sparse data.
   */
  async getTrendStats(limit: number = 12) {
      const supabase = getSupabaseClient();
      
      // Query analytics_snapshots for daily metrics
      // We want to group by newsletter? 
      // Actually, trend chart usually shows "Week 1, Week 2..." so we need 
      // aggregated stats per newsletter_id, OR per date if it's daily trend.
      // Let's assume the chart wants "Newsletter Performance Trend"
      
      // Since generateDailySnapshot isn't populating 'open_rate' yet, this will be empty.
      // For MVP "Connect Real Data", we will cheat slightly:
      // We will fetch the LIST of recent newsletters and calculate metrics on the fly for them.
      // This is slow but guaranteed to work without cron jobs.
      
      const { data: newsletters } = await supabase
        .from('newsletter_weeks')
        .select('week_number')
        .order('week_number', { ascending: false })
        .limit(limit);
        
      if (!newsletters) return [];
      
      console.log(`[Analytics] Fetching trend stats for ${newsletters.length} weeks...`);
      const results = [];
      // Parallel fetch for last N weeks (limit concurrency if needed)
      // Reverse to show oldest first in chart
      for (const nl of newsletters.reverse()) {
          try {
              console.log(`[Analytics] Processing week ${nl.week_number}...`);
              const metrics = await this.getNewsletterMetrics(nl.week_number);
              results.push({
                  name: nl.week_number,
                  openRate: parseFloat(metrics.openRate.toFixed(1)),
                  clickRate: parseFloat(metrics.clickRate.toFixed(1))
              });
          } catch (err) {
              console.error(`[Analytics] Failed to process week ${nl.week_number}:`, err);
              // Push placeholder or skip
              results.push({ name: nl.week_number, openRate: 0, clickRate: 0 });
          }
      }
      console.log('[Analytics] Trend stats completed.');
      return results;
  },

  /**
   * Fetches list of available weeks for the dashboard.
   */
  async getAvailableWeeks() {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
          .from('newsletter_weeks')
          .select('week_number, release_date')
          .order('week_number', { ascending: false });
          
      if (error) throw error;
      return data || [];
  },

  /**
   * Fetches the list of users who have read a specific article.
   * Enriches with class info (for parents -> student classes, for teachers -> assigned classes).
   */
  async getArticleReaders(articleId: string): Promise<ArticleReader[]> {
      const supabase = getSupabaseClient();
      
      try {
          // 1. Fetch all 'page_view' events for this article
          // We need unique users, but we might want last view time.
          const { data: events, error } = await supabase
            .from('analytics_events')
            .select('user_id, created_at')
            .eq('article_id', articleId)
            .eq('event_type', 'page_view')
            .not('user_id', 'is', null);

          if (error) throw error;
          if (!events || events.length === 0) return [];

          // Aggregate by user_id
          const userMap = new Map<string, { viewCount: number, lastViewed: string }>();
          
          events.forEach(e => {
              if (!e.user_id) return;
              const current = userMap.get(e.user_id) || { viewCount: 0, lastViewed: '' };
              current.viewCount++;
              if (!current.lastViewed || new Date(e.created_at) > new Date(current.lastViewed)) {
                  current.lastViewed = e.created_at;
              }
              userMap.set(e.user_id, current);
          });

          const userIds = Array.from(userMap.keys());
          
          // 2. Fetch User Details (Email, Role)
          const { data: users, error: userError } = await supabase
            .from('user_roles')
            .select('id, email, role')
            .in('id', userIds);
            
          if (userError) throw userError;

          // 3. Fetch Context (Student Classes for Parents, Assigned Classes for Teachers)
          // This part is tricky to do in one query without complex joins.
          // We'll simplisticly fetch related data for these users.
          
          // Fetch Family Enrollments for Parents
          const { data: familyEnrollments } = await supabase
             .from('family_enrollment')
             .select('parent_id, families ( family_enrollment ( students ( name ) ), student_class_enrollment ( class_id, classes ( class_name ) ) )')
             .in('parent_id', userIds);
             
          // Fetch Teacher Assignments
          const { data: teacherAssignments } = await supabase
             .from('teacher_class_assignment')
             .select('teacher_id, class_id, classes ( class_name )')
             .in('teacher_id', userIds);

          // 4. Assemble Result
          const readers: ArticleReader[] = [];
          
          users?.forEach(user => {
              const stats = userMap.get(user.id)!;
              const reader: ArticleReader = {
                  userId: user.id,
                  email: user.email,
                  role: user.role,
                  className: [],
                  studentNames: [],
                  lastViewed: new Date(stats.lastViewed).toLocaleString(),
                  viewCount: stats.viewCount
              };

              // Enrich with Class info
              if (user.role === 'parent' || user.role === 'admin') { // Admin might have kids too? assume role='parent' mostly
                  const myEnrollments = familyEnrollments?.filter(fe => fe.parent_id === user.id);
                  myEnrollments?.forEach((fe: any) => {
                      if (fe.families) {
                          // Get Students related to this family
                          const famEnrolls = fe.families.family_enrollment;
                          if (Array.isArray(famEnrolls)) {
                              famEnrolls.forEach((sfe: any) => {
                                  if (sfe.students) reader.studentNames.push(sfe.students.name);
                              });
                          }

                          // Get Classes related to this family's students
                          // Actually student_class_enrollment is directly on families in our schema?
                          // Let's check schema again. `student_class_enrollment` has `family_id` FK.
                          // So yes, `families` -> `student_class_enrollment`.
                          const classEnrolls = fe.families.student_class_enrollment;
                          if (Array.isArray(classEnrolls)) {
                              classEnrolls.forEach((sce: any) => {
                                  if (sce.classes) reader.className.push(sce.classes.class_name);
                              });
                          }
                      }
                  });
              }
              
              if (user.role === 'teacher' || user.role === 'admin') {
                  const myAssignments = teacherAssignments?.filter(ta => ta.teacher_id === user.id);
                  myAssignments?.forEach(ta => {
                      // @ts-ignore
                      if (ta.classes) reader.className.push(ta.classes.class_name);
                  });
              }
              
              // Deduplicate class names
              reader.className = Array.from(new Set(reader.className));
              reader.studentNames = Array.from(new Set(reader.studentNames));

              readers.push(reader);
          });

          return readers.sort((a, b) => new Date(b.lastViewed).getTime() - new Date(a.lastViewed).getTime());

      } catch (err) {
          console.error('[Analytics] Failed to get article readers:', err);
          return [];
      }
  },

  /**
   * aggregated class engagement metrics for a newsletter.
   */
  async getClassEngagement(newsletterId: string): Promise<ClassEngagement[]> {
      const supabase = getSupabaseClient();
      try {
           // 1. Fetch all page views for this newsletter
            const { data: events } = await supabase
                .from('analytics_events')
                .select('user_id')
                .eq('newsletter_id', newsletterId)
                .eq('event_type', 'page_view')
                .not('user_id', 'is', null);

            if (!events || events.length === 0) return [];
            
            const userIds = Array.from(new Set(events.map(e => e.user_id)));
            
            // 2. Fetch User Class Context
             // Fetch Family Enrollments for Parents
            const { data: familyEnrollments } = await supabase
                .from('family_enrollment')
                .select('parent_id, families ( student_class_enrollment ( class_id, classes ( class_name ) ) )')
                .in('parent_id', userIds);
                
             // Map user_id -> List of Class Names
            const userClasses = new Map<string, string[]>();
            
             // Populate userClasses
             familyEnrollments?.forEach((fe: any) => {
                   const classes: string[] = [];
                   if (fe.families && fe.families.student_class_enrollment) {
                       const enrolls = fe.families.student_class_enrollment;
                        if (Array.isArray(enrolls)) {
                                enrolls.forEach((enc: any) => {
                                    if (enc.classes) classes.push(enc.classes.class_name);
                                });
                        }
                   }
                   if (classes.length > 0) userClasses.set(fe.parent_id, classes);
             });
             
             // 3. Aggregate View Counts by Class
             // We want "Active Users per Class" basically.
             const classStats = new Map<string, Set<string>>(); // ClassName -> Set<UserId>
             
             userIds.forEach(uid => {
                 const classes = userClasses.get(uid);
                 if (classes) {
                     classes.forEach(cls => {
                         if (!classStats.has(cls)) classStats.set(cls, new Set());
                         classStats.get(cls)!.add(uid);
                     });
                 } else {
                     // Maybe count "Unassigned" or "Teachers"?
                 }
             });
             
             const result: ClassEngagement[] = [];
             for (const [className, users] of classStats.entries()) {
                 result.push({
                     className,
                     viewCount: 0, // Not counting logic here, just users
                     activeUsers: users.size,
                     totalUsers: 20 // Mock total for now until we have full class counts
                 });
             }
             
             // Sort by active users
             return result.sort((a, b) => b.activeUsers - a.activeUsers).slice(0, 5); // Start with top 5
             
      } catch (err) {
          console.error('[Analytics] Failed to get class engagement:', err);
          return [];
      }
  }
};
