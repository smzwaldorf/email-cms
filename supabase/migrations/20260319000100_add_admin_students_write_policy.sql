-- ============================================================================
-- Migration: Admin writes + parent display names
-- Purpose: Consolidated migration for:
-- 1) students admin write policy
-- 2) user_roles.display_name backfill
-- 3) non-recursive user_roles admin write policy
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'students'
      AND policyname = 'students_admin_write_all'
  ) THEN
    CREATE POLICY students_admin_write_all
      ON public.students FOR ALL
      USING (
        auth.uid() IN (
          SELECT id FROM public.user_roles WHERE role = 'admin'
        )
      )
      WITH CHECK (
        auth.uid() IN (
          SELECT id FROM public.user_roles WHERE role = 'admin'
        )
      );
  END IF;
END
$$;

ALTER TABLE public.user_roles
  ADD COLUMN IF NOT EXISTS display_name TEXT;

UPDATE public.user_roles
SET display_name = email
WHERE display_name IS NULL OR BTRIM(display_name) = '';

CREATE OR REPLACE FUNCTION public.is_admin_user(target_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE id = target_user_id
      AND role = 'admin'
  );
$$;

DROP POLICY IF EXISTS user_roles_admin_write_all ON public.user_roles;

CREATE POLICY user_roles_admin_write_all
  ON public.user_roles FOR ALL
  USING (public.is_admin_user(auth.uid()))
  WITH CHECK (public.is_admin_user(auth.uid()));

CREATE OR REPLACE FUNCTION public.admin_update_user_display_name(
  target_user_id UUID,
  target_display_name TEXT
)
RETURNS public.user_roles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  updated_row public.user_roles;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin_user(auth.uid()) THEN
    RAISE EXCEPTION 'Only admins can update user display names'
      USING ERRCODE = '42501';
  END IF;

  UPDATE public.user_roles
  SET display_name = NULLIF(BTRIM(target_display_name), ''),
      updated_at = NOW()
  WHERE id = target_user_id
  RETURNING * INTO updated_row;

  IF updated_row.id IS NULL THEN
    RAISE EXCEPTION 'User not found for id %', target_user_id
      USING ERRCODE = 'P0002';
  END IF;

  RETURN updated_row;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_update_user_display_name(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_user_display_name(UUID, TEXT) TO service_role;
