-- ============================================================================
-- Analytics & Reporting System Tables
-- Version: 1.0.0
-- Feature: 006-analytics-reporting (Phase 1)
-- ============================================================================

-- ============================================================================
-- 1. Analytics Events Table
-- ============================================================================

CREATE TABLE public.analytics_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.user_roles(id) ON DELETE SET NULL, -- Nullable for anonymous views (if allowed later)
  newsletter_id TEXT REFERENCES public.newsletter_weeks(week_number) ON DELETE CASCADE, -- Using week_number as id based on schema reuse analysis
  article_id UUID REFERENCES public.articles(id) ON DELETE SET NULL,
  session_id TEXT, -- Generated client-side for session tracking
  event_type VARCHAR(50) NOT NULL, -- e.g., 'page_view', 'scroll_50', 'link_click', 'email_open'
  metadata JSONB DEFAULT '{}'::jsonb, -- Flexible field for event-specific data (duration, source, etc.)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for Analytics Events
CREATE INDEX idx_analytics_events_user ON public.analytics_events(user_id);
CREATE INDEX idx_analytics_events_newsletter ON public.analytics_events(newsletter_id);
CREATE INDEX idx_analytics_events_article ON public.analytics_events(article_id);
CREATE INDEX idx_analytics_events_session ON public.analytics_events(session_id);
CREATE INDEX idx_analytics_events_type_time ON public.analytics_events(event_type, created_at DESC);
CREATE INDEX idx_analytics_events_created_at ON public.analytics_events(created_at DESC);

-- RLS for Analytics Events
ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;

-- Admin: View all events
CREATE POLICY analytics_events_admin_read
  ON public.analytics_events FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.id = auth.uid()
      AND user_roles.role = 'admin'
    )
  );

-- Users: View their own events
CREATE POLICY analytics_events_user_read
  ON public.analytics_events FOR SELECT
  USING (user_id = auth.uid());

-- Service/Server: Insert events - authenticated users can only insert their own events
-- Client-side tracking is restricted to prevent unattributed event insertion
CREATE POLICY analytics_events_authenticated_insert
  ON public.analytics_events FOR INSERT
  WITH CHECK (
    user_id = auth.uid() AND user_id IS NOT NULL
  );

-- Anonymous users: insert events with user_id = NULL (for unauthenticated tracking via API)
CREATE POLICY analytics_events_anonymous_insert
  ON public.analytics_events FOR INSERT
  WITH CHECK (
    user_id IS NULL AND auth.uid() IS NULL
  );

-- ============================================================================
-- 2. Analytics Snapshots Table (Daily Aggregation)
-- ============================================================================

CREATE TABLE public.analytics_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_date DATE NOT NULL,
  newsletter_id TEXT REFERENCES public.newsletter_weeks(week_number) ON DELETE CASCADE,
  article_id UUID REFERENCES public.articles(id) ON DELETE CASCADE,
  class_id TEXT REFERENCES public.classes(id) ON DELETE CASCADE,
  metric_name VARCHAR(50) NOT NULL, -- e.g., 'total_views', 'unique_visitors', 'avg_time_spent'
  metric_value NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Ensure unique snapshot per metric per dimension set per day
  UNIQUE(snapshot_date, newsletter_id, article_id, class_id, metric_name)
);

-- Indexes for Analytics Snapshots
CREATE INDEX idx_analytics_snapshots_date ON public.analytics_snapshots(snapshot_date);
CREATE INDEX idx_analytics_snapshots_newsletter ON public.analytics_snapshots(newsletter_id);
CREATE INDEX idx_analytics_snapshots_class ON public.analytics_snapshots(class_id);

-- RLS for Analytics Snapshots
ALTER TABLE public.analytics_snapshots ENABLE ROW LEVEL SECURITY;

-- Admin: Manage all snapshots
CREATE POLICY analytics_snapshots_admin_all
  ON public.analytics_snapshots FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.id = auth.uid()
      AND user_roles.role = 'admin'
    )
  );

-- Parents: View snapshots for their children's classes
CREATE POLICY analytics_snapshots_parent_read
  ON public.analytics_snapshots FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.student_class_enrollment sce
      JOIN public.family_enrollment fe ON sce.family_id = fe.family_id
      WHERE fe.parent_id = auth.uid()
      AND sce.class_id = analytics_snapshots.class_id
    )
  );

-- Teachers: View snapshots for their assigned classes (Assuming teacher logic in user_roles or similar)
-- For now, reusing the admin/broad access or specific class access if defined. 
-- Adding basic teacher policy if they are linked to classes directly (placeholder if class logic differs)
-- Note: 'classes' table access usually checked via specific logic. 
-- Assuming teachers have 'teacher' role and maybe class association. 
-- For MVP, Admin access is sufficient, Parents access is covered.

-- ============================================================================
-- 3. Tracking Tokens Table
-- ============================================================================

CREATE TABLE public.tracking_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.user_roles(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE, -- Store hash for verification, not raw token if possible, or unique identifier
  token_payload JSONB NOT NULL, -- Snapshot of payload at creation { newsletterId, classIds... }
  is_revoked BOOLEAN DEFAULT FALSE,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for Tracking Tokens
CREATE INDEX idx_tracking_tokens_user ON public.tracking_tokens(user_id);
CREATE INDEX idx_tracking_tokens_hash ON public.tracking_tokens(token_hash);
CREATE INDEX idx_tracking_tokens_expiry ON public.tracking_tokens(expires_at);

-- RLS for Tracking Tokens
ALTER TABLE public.tracking_tokens ENABLE ROW LEVEL SECURITY;

-- Admin: Manage all tokens
CREATE POLICY tracking_tokens_admin_all
  ON public.tracking_tokens FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.id = auth.uid()
      AND user_roles.role = 'admin'
    )
  );

-- Users: View/Manage their own tokens
CREATE POLICY tracking_tokens_user_all
  ON public.tracking_tokens FOR ALL
  USING (user_id = auth.uid());

-- Service can insert/manage via service key bypassing RLS.

-- ============================================================================
-- Comments
-- ============================================================================

COMMENT ON TABLE public.analytics_events IS 'Raw event log for user actions (views, clicks, scrolls).';
COMMENT ON TABLE public.analytics_snapshots IS 'Daily aggregated metrics for dashboards to avoid expensive raw queries.';
COMMENT ON TABLE public.tracking_tokens IS 'Stores JWT hashes/identifiers for validating email tracking links and magic entry.';
