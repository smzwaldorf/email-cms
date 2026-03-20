import type { NewsletterRow } from '@/types/database';

export type AnalyticsEventType = 
  | 'page_view' 
  | 'scroll_50' 
  | 'scroll_90' 
  | 'link_click' 
  | 'email_open' 
  | 'session_start' 
  | 'session_end';

export interface AnalyticsEvent {
  id: string;
  user_id: string | null;
  newsletter_id: string | null;
  article_id: string | null;
  session_id: string | null;
  event_type: AnalyticsEventType;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface AnalyticsSnapshot {
  id: string;
  snapshot_date: string;
  newsletter_id: string | null;
  article_id: string | null;
  class_id: string | null;
  metric_name: string;
  metric_value: number;
  created_at: string;
}

export interface TrackingToken {
  id: string;
  user_id: string;
  token_hash: string;
  token_payload: unknown;
  is_revoked: boolean;
  expires_at: string;
  created_at: string;
}

export interface AnalyticsMetrics {
  openRate: number;
  clickRate: number;
  avgTimeSpent: number;
  totalViews: number;
}

export interface ArticleHotness {
  articleId: string;
  title: string;
  publishedAt: string;
  avgReadLatencyMinutes: number; // Average minutes from publish to first read
  hotnessScore: number; // 0-100 score (higher = read faster = hotter)
  totalReaders: number;
}

/** Newsletter rows returned for the analytics week selector (subset of columns). */
export type AnalyticsNewsletterWeekOption = Pick<NewsletterRow, 'id' | 'release_date'> & {
  week_number?: NewsletterRow['week_number'];
  title?: NewsletterRow['title'];
};

/** One point in the engagement trend series (per newsletter week). */
export interface NewsletterTrendPoint {
  name: string;
  openRate: number;
  clickRate: number;
  avgTimeSpent: number;
}

/** Article + newsletter context for reader-facing article metadata. */
export interface ArticleAnalyticsMetadata {
  title: string;
  publishedAt: string;
  newsletterId: string | null;
  weekNumber: string | null;
}

