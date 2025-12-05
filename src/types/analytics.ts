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
  metadata: Record<string, any>;
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
  token_payload: any;
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
