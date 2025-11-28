-- ============================================================================
-- Authentication Events Audit Log
-- Version: 1.0.0
-- Feature: 003-passwordless-auth (Phase 7 - Security & Audit Logging)
-- ============================================================================

-- Enable pg_cron extension for automated cleanup
CREATE EXTENSION IF NOT EXISTS "pg_cron";

-- ============================================================================
-- Auth Events Table
-- ============================================================================

CREATE TABLE public.auth_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type VARCHAR(30) NOT NULL CHECK (event_type IN (
    'login_success',
    'login_failure',
    'logout',
    'oauth_google_start',
    'oauth_google_success',
    'oauth_google_failure',
    'magic_link_sent',
    'magic_link_verified',
    'magic_link_expired',
    'token_refresh_success',
    'token_refresh_failure',
    'session_expired'
  )),
  auth_method VARCHAR(20) CHECK (auth_method IN (
    'google_oauth',
    'magic_link',
    'email_password'
  )),
  ip_address INET,
  user_agent TEXT,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- Indexes for Performance
-- ============================================================================

-- Query by user and time (most common: view user's auth history)
CREATE INDEX idx_auth_events_user_time
  ON public.auth_events(user_id, created_at DESC);

-- Query by event type (filter dashboard by event)
CREATE INDEX idx_auth_events_type
  ON public.auth_events(event_type, created_at DESC);

-- Query by auth method (filter dashboard by login method)
CREATE INDEX idx_auth_events_method
  ON public.auth_events(auth_method, created_at DESC);

-- Query for suspicious activity detection (failed logins in time window)
CREATE INDEX idx_auth_events_failures
  ON public.auth_events(user_id, created_at DESC)
  WHERE event_type = 'login_failure';

-- ============================================================================
-- Row Level Security (RLS)
-- ============================================================================

ALTER TABLE public.auth_events ENABLE ROW LEVEL SECURITY;

-- Admin: Read all auth events
CREATE POLICY auth_events_admin_read
  ON public.auth_events FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.id = auth.uid()
      AND user_roles.role = 'admin'
    )
  );

-- Users: Read their own auth events only
CREATE POLICY auth_events_user_read
  ON public.auth_events FOR SELECT
  USING (user_id = auth.uid());

-- Service role: Insert events (from auditLogger service)
-- Note: Service role bypasses RLS by default, so explicit policy not needed
-- But including for clarity about intended access pattern
CREATE POLICY auth_events_service_insert
  ON public.auth_events FOR INSERT
  WITH CHECK (true);

-- ============================================================================
-- Automated Cleanup: Delete events older than 30 days
-- ============================================================================
-- Schedule: Daily at 2:00 AM
-- This keeps database size manageable and respects data minimization principles

SELECT cron.schedule(
  'cleanup-old-auth-events',
  '0 2 * * *',
  $$DELETE FROM public.auth_events WHERE created_at < NOW() - INTERVAL '30 days'$$
);

-- ============================================================================
-- Comments for Documentation
-- ============================================================================

COMMENT ON TABLE public.auth_events IS
'Authentication event audit log. Records all auth-related events (login, logout, OAuth, magic links, token refresh) for security auditing and suspicious activity detection. 30-day retention policy enforced via pg_cron.';

COMMENT ON COLUMN public.auth_events.event_type IS
'Type of authentication event. Used for filtering and analysis. Covers password login, OAuth, magic links, token management, and session lifecycle.';

COMMENT ON COLUMN public.auth_events.auth_method IS
'Authentication method used for this event. Identifies which auth flow was involved (password, Google OAuth, or magic link).';

COMMENT ON COLUMN public.auth_events.ip_address IS
'IP address of the request. NULL for client-side events (captured via user_agent instead). Server-side events can populate this field.';

COMMENT ON COLUMN public.auth_events.user_agent IS
'Browser/device user agent string. Primary identifier for device tracking since IP address is not available client-side.';

COMMENT ON COLUMN public.auth_events.metadata IS
'Additional event context as JSON. Examples: email for magic_link_sent, target_user_id for admin_force_logout, error details for failures.';
