-- ============================================================================
-- Admin RPCs for user_roles mutations
-- Version: 1.0.0
-- Purpose: Allow authenticated admins to manage user_roles from the frontend
-- without exposing a service role key in browser code.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.admin_create_user_role(
  target_user_id UUID,
  target_email TEXT,
  target_role VARCHAR(20)
)
RETURNS public.user_roles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  created_row public.user_roles;
BEGIN
  IF auth.role() <> 'service_role' AND NOT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE id = auth.uid()
      AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Access denied: User is not an admin';
  END IF;

  INSERT INTO public.user_roles (id, email, role)
  VALUES (target_user_id, target_email, target_role)
  RETURNING * INTO created_row;

  RETURN created_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_update_user_role(
  target_user_id UUID,
  target_role VARCHAR(20)
)
RETURNS public.user_roles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  updated_row public.user_roles;
BEGIN
  IF auth.role() <> 'service_role' AND NOT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE id = auth.uid()
      AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Access denied: User is not an admin';
  END IF;

  UPDATE public.user_roles
  SET
    role = target_role,
    updated_at = NOW()
  WHERE id = target_user_id
  RETURNING * INTO updated_row;

  IF updated_row IS NULL THEN
    RAISE EXCEPTION 'User role not found for id %', target_user_id;
  END IF;

  RETURN updated_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_delete_user_role(
  target_user_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.role() <> 'service_role' AND NOT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE id = auth.uid()
      AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Access denied: User is not an admin';
  END IF;

  DELETE FROM public.user_roles
  WHERE id = target_user_id;

  RETURN FOUND;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_create_user_role(UUID, TEXT, VARCHAR) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_create_user_role(UUID, TEXT, VARCHAR) TO service_role;

GRANT EXECUTE ON FUNCTION public.admin_update_user_role(UUID, VARCHAR) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_user_role(UUID, VARCHAR) TO service_role;

GRANT EXECUTE ON FUNCTION public.admin_delete_user_role(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_delete_user_role(UUID) TO service_role;
