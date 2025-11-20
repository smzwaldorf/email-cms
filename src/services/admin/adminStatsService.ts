/**
 * Admin Statistics Service
 * Fetches dashboard statistics and recent activity
 */

import { getSupabaseClient } from '@/lib/supabase';

const supabase = getSupabaseClient();

export interface DashboardStats {
  totalUsers: number;
  adminCount: number;
  teacherCount: number;
  parentCount: number;
  studentCount: number;
  totalWeeks: number;
  publishedWeeks: number;
  totalArticles: number;
  publishedArticles: number;
  totalClasses: number;
  totalFamilies: number;
}

export interface RecentActivity {
  id: string;
  timestamp: string;
  userId: string;
  userEmail: string;
  action: string;
  description: string;
}

/**
 * Fetch dashboard statistics
 */
export async function fetchDashboardStats(): Promise<DashboardStats> {
  // Fetch user counts
  const { data: users, error: usersError } = await supabase
    .from('user_roles')
    .select('role');

  if (usersError) throw usersError;

  const userCounts = {
    totalUsers: users?.length || 0,
    adminCount: users?.filter(u => u.role === 'admin').length || 0,
    teacherCount: users?.filter(u => u.role === 'teacher').length || 0,
    parentCount: users?.filter(u => u.role === 'parent').length || 0,
    studentCount: users?.filter(u => u.role === 'student').length || 0,
  };

  // Fetch week counts
  const { data: weeks, error: weeksError } = await supabase
    .from('newsletter_weeks')
    .select('is_published');

  if (weeksError) throw weeksError;

  const weekCounts = {
    totalWeeks: weeks?.length || 0,
    publishedWeeks: weeks?.filter(w => w.is_published).length || 0,
  };

  // Fetch article counts
  const { data: articles, error: articlesError } = await supabase
    .from('articles')
    .select('is_published, deleted_at')
    .is('deleted_at', null);

  if (articlesError) throw articlesError;

  const articleCounts = {
    totalArticles: articles?.length || 0,
    publishedArticles: articles?.filter(a => a.is_published).length || 0,
  };

  // Fetch class count
  const { count: classCount, error: classError } = await supabase
    .from('classes')
    .select('*', { count: 'exact', head: true });

  if (classError) throw classError;

  // Fetch family count
  const { count: familyCount, error: familyError } = await supabase
    .from('families')
    .select('*', { count: 'exact', head: true });

  if (familyError) throw familyError;

  return {
    ...userCounts,
    ...weekCounts,
    ...articleCounts,
    totalClasses: classCount || 0,
    totalFamilies: familyCount || 0,
  };
}

/**
 * Fetch recent activity from audit log
 */
export async function fetchRecentActivity(limit: number = 10): Promise<RecentActivity[]> {
  const { data, error } = await supabase
    .from('article_audit_log')
    .select(`
      id,
      action,
      changed_at,
      changed_by,
      article_id,
      articles!inner(title),
      user_roles!article_audit_log_changed_by_fkey(email)
    `)
    .order('changed_at', { ascending: false })
    .limit(limit);

  if (error) throw error;

  return (data || []).map((log: any) => ({
    id: log.id,
    timestamp: log.changed_at,
    userId: log.changed_by,
    userEmail: log.user_roles?.email || 'System',
    action: log.action,
    description: `${log.action} article "${log.articles?.title || 'Unknown'}"`,
  }));
}
