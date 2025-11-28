-- ============================================================================
-- Enable Realtime for Auth Events
-- Version: 1.0.0
-- Feature: 003-passwordless-auth (Client-Side Force Logout)
-- ============================================================================

-- Add auth_events to the supabase_realtime publication
-- This allows clients to subscribe to changes on this table
-- RLS policies still apply (users only see their own events)

BEGIN;
  -- Check if publication exists (it should in Supabase)
  -- If not, create it (fallback, though unlikely needed in standard Supabase setup)
  DO $$
  BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
      CREATE PUBLICATION supabase_realtime;
    END IF;
  END
  $$;

  -- Add table to publication
  ALTER PUBLICATION supabase_realtime ADD TABLE public.auth_events;
COMMIT;
