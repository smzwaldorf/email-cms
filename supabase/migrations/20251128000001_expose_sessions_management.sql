-- ============================================================================
-- Expose Sessions Management via RPC
-- Version: 1.0.0
-- Feature: 003-passwordless-auth (Admin Session Management)
-- ============================================================================

-- Function to get active sessions for a specific user
-- Only accessible by admins
CREATE OR REPLACE FUNCTION public.get_user_sessions(target_user_id UUID)
RETURNS TABLE (
  id UUID,
  user_id UUID,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE,
  factor_id UUID,
  aal VARCHAR,
  not_after TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
SECURITY DEFINER -- Runs with privileges of the creator (postgres/superuser) to access auth schema
SET search_path = public, auth
AS $$
BEGIN
  -- Check if the executing user is an admin
  -- Allow service_role to bypass this check (for admin scripts/server-side calls)
  IF (auth.role() = 'service_role') THEN
    -- Allow access
    NULL;
  ELSIF NOT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.id = auth.uid() AND user_roles.role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Access denied: User is not an admin';
  END IF;

  RETURN QUERY
  SELECT 
    s.id,
    s.user_id,
    s.created_at,
    s.updated_at,
    s.factor_id,
    s.aal::VARCHAR,
    s.not_after
  FROM auth.sessions s
  WHERE s.user_id = target_user_id
  ORDER BY s.created_at DESC;
END;
$$;

-- Function to delete all sessions for a specific user (Force Logout)
-- Only accessible by admins
CREATE OR REPLACE FUNCTION public.delete_user_sessions(target_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  -- Check if the executing user is an admin
  -- Allow service_role to bypass this check
  IF (auth.role() = 'service_role') THEN
    -- Allow access
    NULL;
  ELSIF NOT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.id = auth.uid() AND user_roles.role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Access denied: User is not an admin';
  END IF;

  DELETE FROM auth.sessions
  WHERE user_id = target_user_id;

  RETURN TRUE;
END;
$$;

-- Grant execute permissions to authenticated users (RLS inside function handles actual security)
GRANT EXECUTE ON FUNCTION public.get_user_sessions(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_user_sessions(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_sessions(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.delete_user_sessions(UUID) TO service_role;
