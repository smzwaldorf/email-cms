import { getSupabaseClient } from '@/lib/supabase';
import { AnalyticsSnapshot, AnalyticsMetrics, ArticleHotness } from '@/types/analytics';

export interface ClassEngagement {
    className: string;
    activeUsers: number;
    totalUsers: number;
    openRate: number;
    clickCount: number;
    avgDailyTime: number;
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

      // 2. Aggregate data in memory
      // Key: `${newsletter_id}:${article_id}` (Class breakdown skipped for MVP)
      const articleStats = new Map<string, { 
        views: number;
        clicks: number;
        totalTimeSeconds: number;
        sessionCount: number;
      }>();
      
      for (const event of events) {
        if (!event.article_id) continue;

        const key = `${event.newsletter_id || 'null'}:${event.article_id}`;
        const current = articleStats.get(key) || { 
          views: 0, 
          clicks: 0, 
          totalTimeSeconds: 0, 
          sessionCount: 0 
        };

        if (event.event_type === 'page_view') {
           current.views++;
        } else if (event.event_type === 'link_click') {
           current.clicks++;
        } else if (event.event_type === 'session_end') {
           const time = event.metadata?.time_spent_seconds;
           if (typeof time === 'number' && time > 0) {
             current.totalTimeSeconds += time;
             current.sessionCount++;
           }
        }
        
        articleStats.set(key, current);
      }

      // 3. Insert Snapshots
      const snapshotsToInsert: Omit<AnalyticsSnapshot, 'id' | 'created_at'>[] = [];

      for (const [key, stats] of articleStats.entries()) {
        const [newsletterId, articleId] = key.split(':');
        const validNewsletterId = newsletterId === 'null' ? null : newsletterId;

        // Views
        if (stats.views > 0) {
          snapshotsToInsert.push({
            snapshot_date: targetDate,
            newsletter_id: validNewsletterId,
            article_id: articleId,
            class_id: null,
            metric_name: 'total_views',
            metric_value: stats.views
          });
        }

        // Clicks
        if (stats.clicks > 0) {
          snapshotsToInsert.push({
            snapshot_date: targetDate,
            newsletter_id: validNewsletterId,
            article_id: articleId,
            class_id: null,
            metric_name: 'total_clicks',
            metric_value: stats.clicks
          });
        }

        // Avg Stay Time
        if (stats.sessionCount > 0) {
          const avgTime = Math.round(stats.totalTimeSeconds / stats.sessionCount);
          snapshotsToInsert.push({
            snapshot_date: targetDate,
            newsletter_id: validNewsletterId,
            article_id: articleId,
            class_id: null,
            metric_name: 'avg_time_spent',
            metric_value: avgTime
          });
        }
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
    const QUERY_TIMEOUT_MS = 30000; // Increased to 30s for cold DB recovery
    
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
    
    // 1. Fetch Views per article
    // Use !inner to force join and filter by article's actual week number
    // This prevents "pollution" where an event logged with the wrong newsletter_id 
    // (or cross-week navigation) causes an old article to show up in the wrong week's report.
    const { data: viewEvents, error: viewError } = await supabase
      .from('analytics_events')
      .select('article_id, user_id, session_id, articles!inner ( title, created_at, article_order, week_number )')
      .eq('newsletter_id', newsletterId)
      .eq('articles.week_number', newsletterId)
      .eq('event_type', 'page_view');

    if (viewError) throw viewError;

    // 2. Fetch Clicks per article
    const { data: clickEvents, error: clickError } = await supabase
      .from('analytics_events')
      .select('article_id')
      .eq('newsletter_id', newsletterId)
      .eq('event_type', 'link_click');

    if (clickError) throw clickError;

    // 3. Fetch session_end events for time spent calculation
    const { data: sessionEndEvents, error: sessionError } = await supabase
      .from('analytics_events')
      .select('article_id, metadata')
      .eq('newsletter_id', newsletterId)
      .eq('event_type', 'session_end');

    if (sessionError) throw sessionError;

    // Aggregate
    const statsMap = new Map<string, { 
      id: string; 
      title: string; 
      publishedAt: string; 
      order: number;
      views: number; 
      uniqueViews: Set<string>;
      clicks: number;
      totalTimeSpent: number;
      timeSpentCount: number;
    }>();

    viewEvents?.forEach((event: any) => {
        if (!event.article_id) return;
        
        if (!statsMap.has(event.article_id)) {
            const article = event.articles;
            statsMap.set(event.article_id, {
                id: event.article_id,
                title: article?.title || 'Unknown Article',
                publishedAt: article?.created_at ? new Date(article.created_at).toLocaleDateString() : '-',
                order: article?.article_order || 999,
                views: 0,
                uniqueViews: new Set(),
                clicks: 0,
                totalTimeSpent: 0,
                timeSpentCount: 0
            });
        }
        const stat = statsMap.get(event.article_id)!;
        stat.views++;
        stat.uniqueViews.add(event.user_id || event.session_id);
    });

    clickEvents?.forEach((event) => {
        if (!event.article_id) return;
        if (statsMap.has(event.article_id)) {
            statsMap.get(event.article_id)!.clicks++;
        }
    });

    // Aggregate time spent from session_end events
    sessionEndEvents?.forEach((event: any) => {
        if (!event.article_id || !statsMap.has(event.article_id)) return;
        const timeSpent = event.metadata?.time_spent_seconds;
        if (typeof timeSpent === 'number' && timeSpent > 0) {
            const stat = statsMap.get(event.article_id)!;
            stat.totalTimeSpent += timeSpent;
            stat.timeSpentCount++;
        }
    });

    return Array.from(statsMap.values()).map(stat => {
        const avgSeconds = stat.timeSpentCount > 0 
            ? Math.round(stat.totalTimeSpent / stat.timeSpentCount) 
            : 0;
        return {
            ...stat,
            uniqueViews: stat.uniqueViews.size,
            avgTimeSpent: avgSeconds, // Now returns seconds as number
            avgTimeSpentFormatted: avgSeconds > 0 ? this.formatDuration(avgSeconds) : '-'
        };
      }).sort((a, b) => a.order - b.order);
  },

  /**
   * Fetches article stats with a fallback strategy:
   * 1. Try to fetch from analytics_snapshots (fastest)
   * 2. If no snapshots, fallback to raw event aggregation (slower)
   */
  async getArticleStatsWithFallback(newsletterId: string) {
    const supabase = getSupabaseClient();
    
    try {
      // 1. Try Snapshots
      const { data: snapshots, error } = await supabase
        .from('analytics_snapshots')
        .select('*')
        .eq('newsletter_id', newsletterId);

      if (!error && snapshots && snapshots.length > 0) {
        console.log('[Analytics] Using snapshots for article stats');
        
        // Group by article_id and aggregate
        const map = new Map<string, {
            article_id: string;
            views: number;
            clicks: number;
            weightedTime: number;
            timeCount: number;
        }>();

        snapshots.forEach(row => {
            if (!row.article_id) return;
            const current = map.get(row.article_id) || {
                article_id: row.article_id,
                views: 0,
                clicks: 0,
                weightedTime: 0,
                timeCount: 0
            };

            if (row.metric_name === 'total_views') current.views += Number(row.metric_value);
            if (row.metric_name === 'total_clicks') current.clicks += Number(row.metric_value);
            if (row.metric_name === 'avg_time_spent') {
                // Approximate weighted average not possible without weights (session counts).
                // Assuming simple average of averages for MVP or just max? 
                // Better approach: store total_time in snapshot?
                // For MVP: Average of daily averages.
                current.weightedTime += Number(row.metric_value);
                current.timeCount++;
            }
            map.set(row.article_id, current);
        });

        // We need article titles/metadata. Snapshots don't have them.
        // So we still need to join with articles, OR fetch articles separately.
        // Let's fetch articles for this newsletter to enrich data.
        const { data: articles } = await supabase
           .from('articles')
           .select('id, title, created_at, article_order')
           .eq('week_number', newsletterId);
           
        const articleLookup = new Map(articles?.map(a => [a.id, a]));

        return Array.from(map.values()).map(stat => {
           const article = articleLookup.get(stat.article_id);
           const avgTime = stat.timeCount > 0 ? Math.round(stat.weightedTime / stat.timeCount) : 0;
           
           return {
               id: stat.article_id,
               title: article?.title || 'Unknown',
               publishedAt: article?.created_at ? new Date(article.created_at).toLocaleDateString() : '-',
               order: article?.article_order || 999,
               views: stat.views,
               uniqueViews: stat.views, // Snapshots store total views, not unique. MVP Compromise or rename UI label.
               clicks: stat.clicks,
               avgTimeSpent: avgTime,
               avgTimeSpentFormatted: avgTime > 0 ? this.formatDuration(avgTime) : '-'
           };
        }).sort((a, b) => a.order - b.order);
      }
    } catch (e) {
      console.warn('[Analytics] Snapshot query failed, falling back:', e);
    }

    // 2. Fallback to raw events
    console.log('[Analytics] Falling back to raw event aggregation');
    return this.getArticleStats(newsletterId);
  },

  /**
   * Formats seconds into a human-readable duration string (Xh Ym Zs or Xm Ys)
   */
  formatDuration(seconds: number): string {
    if (seconds < 60) return `${seconds}s`;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins < 60) return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
    const hours = Math.floor(mins / 60);
    const remainingMins = mins % 60;
    return remainingMins > 0 ? `${hours}h ${remainingMins}m` : `${hours}h`;
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
    async getClassEngagement(newsletterId: string, client?: any): Promise<ClassEngagement[]> {
        const supabase = client || getSupabaseClient();
        try {
             // 1. Fetch all events for this newsletter (views, clicks, sessions)
             const { data: events } = await supabase
                 .from('analytics_events')
                 .select('user_id, event_type, metadata')
                 .eq('newsletter_id', newsletterId)
                 .not('user_id', 'is', null);
 
             if (!events || events.length === 0) return [];
             
             // 2. Map Users to Classes
             const userIds = Array.from(new Set(events.map(e => e.user_id)));
             
             // Fetch Family Enrollments for these Parents to identify their classes
             // Note: A parent might belong to multiple classes. We'll credit their activity to ALL their classes for now.
             const { data: familyEnrollments } = await supabase
                 .from('family_enrollment')
                 .select('parent_id, families ( student_class_enrollment ( class_id, classes ( class_name ) ) )')
                 .in('parent_id', userIds);
             
             const userClasses = new Map<string, string[]>();
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
             
             // 3. Aggregate Stats per Class
             // Structure: ClassName -> Stats
             const classStats = new Map<string, {
                 activeUsers: Set<string>;
                 clicks: number;
                 totalTime: number;
                 sessionCount: number;
             }>();
             
             // Helper to get/init stats
             const getStats = (className: string) => {
                 if (!classStats.has(className)) {
                     classStats.set(className, {
                         activeUsers: new Set(),
                         clicks: 0,
                         totalTime: 0,
                         sessionCount: 0
                     });
                 }
                 return classStats.get(className)!;
             };
 
             events.forEach(event => {
                 const classes = userClasses.get(event.user_id);
                 if (!classes) return; // User has no class (e.g. admin or unassigned)
 
                 classes.forEach(className => {
                     const stats = getStats(className);
                     
                     // Page View -> Active User
                     if (event.event_type === 'page_view') {
                         stats.activeUsers.add(event.user_id);
                     }
                     // Link Click -> Click Count
                     else if (event.event_type === 'link_click') {
                         stats.clicks++;
                     }
                     // Session End -> Time Spent
                     else if (event.event_type === 'session_end') {
                          const time = Number(event.metadata?.time_spent_seconds) || 0;
                          if (time > 0) {
                              stats.totalTime += time;
                              stats.sessionCount++;
                          }
                     }
                 });
             });
 
             // 4. Fetch Total Users per Class (Census)
             // We need to know the total number of parents in each class to calculate "Open Rate" (Participation)
             // This requires querying the DB for all enrollments, not just active ones.
             // Optimization: We fetch ALL classes and their parent counts.
             
             // For this MVP, we might just query student_class_enrollment count.
             // Ideally: Count distinct families.id where student_class_enrollment.class_id = X
             
             const { data: allClassData } = await supabase
                .from('classes')
                .select(`
                    class_name,
                    student_class_enrollment (count)
                `);
                
             const classCensus = new Map<string, number>();
             allClassData?.forEach((c: any) => {
                 // Assuming 1 student approx 1.5 parents? Or just count students as proxies for families?
                 // Let's use student count as the denominator for "Families"
                 const count = c.student_class_enrollment?.[0]?.count || 0;
                 classCensus.set(c.class_name, count || 1); // Avoid div by zero
             });
 
             // 5. Build Result
             const result: ClassEngagement[] = [];
             for (const [className, stats] of classStats.entries()) {
                 const totalFamilies = classCensus.get(className) || 20; // Default fallback
                 
                 // Avg Time per Active User (or Session?) -> Let's do per Active User
                 const avgTime = stats.activeUsers.size > 0 
                    ? Math.round(stats.totalTime / stats.activeUsers.size) 
                    : 0;
 
                 result.push({
                     className,
                     activeUsers: stats.activeUsers.size,
                     totalUsers: totalFamilies,
                     openRate: (stats.activeUsers.size / totalFamilies) * 100,
                     clickCount: stats.clicks,
                     avgDailyTime: avgTime 
                 });
             }
             
             // Sort by Open Rate
             return result.sort((a, b) => b.openRate - a.openRate);
             
         } catch (err) {
             console.error('[Analytics] Failed to get class engagement:', err);
             return [];
         }
    },

  /**
   * Calculates topic hotness based on how quickly parents read articles after publishing.
   * Hotness score: 100 = read immediately, decreases as average read latency increases.
   */
  async getTopicHotness(newsletterId: string): Promise<ArticleHotness[]> {
      const supabase = getSupabaseClient();
      
      try {
          // 1. Fetch all page_view events with article publish time
          const { data: events, error } = await supabase
            .from('analytics_events')
            .select('article_id, user_id, created_at, articles ( title, created_at )')
            .eq('newsletter_id', newsletterId)
            .eq('event_type', 'page_view')
            .not('user_id', 'is', null);

          if (error) throw error;
          if (!events || events.length === 0) return [];

          // 2. Group by article and find first view per user
          const articleMap = new Map<string, {
              title: string;
              publishedAt: Date;
              firstViews: Map<string, Date>; // userId -> first view time
          }>();

          events.forEach((event: any) => {
              if (!event.article_id || !event.articles?.created_at) return;
              
              if (!articleMap.has(event.article_id)) {
                  articleMap.set(event.article_id, {
                      title: event.articles.title || 'Unknown',
                      publishedAt: new Date(event.articles.created_at),
                      firstViews: new Map()
                  });
              }
              
              const article = articleMap.get(event.article_id)!;
              const viewTime = new Date(event.created_at);
              const existingFirst = article.firstViews.get(event.user_id);
              
              if (!existingFirst || viewTime < existingFirst) {
                  article.firstViews.set(event.user_id, viewTime);
              }
          });

          // 3. Calculate hotness for each article
          const results: ArticleHotness[] = [];
          
          for (const [articleId, data] of articleMap.entries()) {
              if (data.firstViews.size === 0) continue;
              
              // Calculate average latency in minutes
              let totalLatencyMinutes = 0;
              data.firstViews.forEach((viewTime) => {
                  const latencyMs = viewTime.getTime() - data.publishedAt.getTime();
                  totalLatencyMinutes += Math.max(0, latencyMs / (1000 * 60));
              });
              const avgLatencyMinutes = totalLatencyMinutes / data.firstViews.size;
              
              // Calculate hotness score: 100 for immediate, decreases over time
              // Formula: score = max(0, 100 - (avgLatencyMinutes / 60) * 2)
              // Read within 1 hour = ~98, within 24 hours = ~52, 50+ hours = 0
              const hotnessScore = Math.max(0, Math.round(100 - (avgLatencyMinutes / 60) * 2));
              
              results.push({
                  articleId,
                  title: data.title,
                  publishedAt: data.publishedAt.toISOString(),
                  avgReadLatencyMinutes: Math.round(avgLatencyMinutes),
                  hotnessScore,
                  totalReaders: data.firstViews.size
              });
          }
          
          // Sort by hotness score descending
          return results.sort((a, b) => b.hotnessScore - a.hotnessScore);
          
      } catch (err) {
          console.error('[Analytics] Failed to get topic hotness:', err);
          return [];
      }
  }
};
