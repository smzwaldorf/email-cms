import { adminRpc } from './backendApi'
import type { AnalyticsMetrics, ArticleHotness, AnalyticsNewsletterWeekOption, NewsletterTrendPoint, ArticleAnalyticsMetadata } from '@/types/analytics'

export interface ClassEngagement {
    className: string;
    activeUsers: number;
    totalUsers: number;
    openRate: number;
    clickCount: number;
    clickRate: number;
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

interface ArticleStats { id: string; title: string; publishedAt: string; views: number; uniqueViews: number; clicks: number; avgTimeSpent: number; avgTimeSpentFormatted: string; order?: number }

// Aggregation and identity lookups run inside the authorized backend.
export const analyticsAggregator = {
  generateDailySnapshot(date?: string): Promise<void> {
    return adminRpc('analytics', 'generateDailySnapshot', [date])
  },
  getNewsletterMetrics(newsletterId: string, className?: string, tracker: 'resend' | 'cms' = 'resend'): Promise<AnalyticsMetrics> {
    return adminRpc('analytics', 'getNewsletterMetrics', [newsletterId, className, tracker])
  },
  getArticleStats(newsletterId: string): Promise<ArticleStats[]> {
    return adminRpc('analytics', 'getArticleStats', [newsletterId])
  },
  getArticleStatsWithFallback(newsletterId: string): Promise<ArticleStats[]> {
    return adminRpc('analytics', 'getArticleStatsWithFallback', [newsletterId])
  },
  getTrendStats(limit = 12, className?: string, tracker: 'resend' | 'cms' = 'resend'): Promise<NewsletterTrendPoint[]> {
    return adminRpc('analytics', 'getTrendStats', [limit, className, tracker])
  },
  getAvailableWeeks(): Promise<AnalyticsNewsletterWeekOption[]> {
    return adminRpc('analytics', 'getAvailableWeeks', [])
  },
  getClassEngagement(newsletterId: string): Promise<ClassEngagement[]> {
    return adminRpc('analytics', 'getClassEngagement', [newsletterId])
  },
  getTopicHotness(newsletterId: string): Promise<ArticleHotness[]> {
    return adminRpc('analytics', 'getTopicHotness', [newsletterId])
  },
  getUsersInClass(className: string): Promise<string[]> {
    return adminRpc('analytics', 'getUsersInClass', [className])
  },
  getClassHistory(className: string, limit = 12): Promise<NewsletterTrendPoint[]> {
    return adminRpc('analytics', 'getClassHistory', [className, limit])
  },
  getArticleMetadata(articleId: string): Promise<ArticleAnalyticsMetadata> {
    return adminRpc('analytics', 'getArticleMetadata', [articleId])
  },
  getArticleReaders(articleId: string): Promise<ArticleReader[]> {
    return adminRpc('analytics', 'getArticleReaders', [articleId])
  },
  getAllClasses(): Promise<string[]> {
    return adminRpc('analytics', 'getAllClasses', [])
  },
  formatDuration(seconds: number): string {
    if (seconds < 60) return `${seconds}s`;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins < 60) return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
    const hours = Math.floor(mins / 60);
    const remainingMins = mins % 60;
    return remainingMins > 0 ? `${hours}h ${remainingMins}m` : `${hours}h`;
  },

}
