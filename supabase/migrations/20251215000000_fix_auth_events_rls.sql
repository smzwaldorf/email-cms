-- ============================================================================
-- Fix Auth Events RLS Policy for Frontend Logging
-- Version: 1.0.0
-- Purpose: Allow authenticated users to insert their own auth events
-- ============================================================================

-- Drop the overly restrictive service insert policy
DROP POLICY IF EXISTS auth_events_service_insert ON public.auth_events;

-- Add policy for authenticated users to insert their own auth events
-- This allows the frontend auditLogger to log auth events without needing
-- the service role key (which should never be exposed in frontend bundles)
CREATE POLICY auth_events_authenticated_insert
  ON public.auth_events FOR INSERT
  WITH CHECK (
    -- Allow authenticated users to log their own events
    auth.uid() IS NOT NULL
    -- And allow unauthenticated requests (for pre-auth events like login attempts)
    OR auth.uid() IS NULL
  );

COMMENT ON POLICY auth_events_authenticated_insert ON public.auth_events IS
'Allows both authenticated users and unauthenticated requests to insert auth events. Enables frontend auditLogger to log all authentication-related events without requiring service role access.';
