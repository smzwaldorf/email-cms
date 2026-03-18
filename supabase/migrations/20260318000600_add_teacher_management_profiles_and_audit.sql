-- ============================================================================
-- Migration: Add teacher profiles and audit metadata for lifecycle management
-- Purpose: Support teacher management workflow (create/update/activate/deactivate)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.teacher_profiles (
  user_id UUID PRIMARY KEY REFERENCES public.user_roles(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  deactivated_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_teacher_profiles_status
  ON public.teacher_profiles (status, is_active, display_name);

CREATE OR REPLACE FUNCTION public.update_teacher_profiles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_teacher_profiles_updated_at ON public.teacher_profiles;
CREATE TRIGGER trigger_teacher_profiles_updated_at
  BEFORE UPDATE ON public.teacher_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_teacher_profiles_updated_at();

CREATE OR REPLACE FUNCTION public.sync_teacher_profile_lifecycle()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_active = FALSE AND OLD.is_active = TRUE THEN
    NEW.deactivated_at = COALESCE(NEW.deactivated_at, NOW());
    NEW.status = 'disabled';
  ELSIF NEW.is_active = TRUE AND OLD.is_active = FALSE THEN
    NEW.deactivated_at = NULL;
    NEW.status = 'active';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_teacher_profile_lifecycle ON public.teacher_profiles;
CREATE TRIGGER trigger_teacher_profile_lifecycle
  BEFORE UPDATE ON public.teacher_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_teacher_profile_lifecycle();

-- Backfill existing teacher roles into teacher_profiles.
INSERT INTO public.teacher_profiles (user_id, display_name, status, is_active)
SELECT ur.id, ur.email, 'active', TRUE
FROM public.user_roles ur
WHERE ur.role = 'teacher'
ON CONFLICT (user_id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.teacher_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID NOT NULL REFERENCES public.user_roles(id) ON DELETE CASCADE,
  action VARCHAR(20) NOT NULL CHECK (action IN ('create', 'update', 'activate', 'deactivate')),
  actor_id UUID REFERENCES public.user_roles(id) ON DELETE SET NULL,
  prior_state JSONB,
  new_state JSONB,
  changed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_teacher_audit_log_teacher_changed_at
  ON public.teacher_audit_log (teacher_id, changed_at DESC);

ALTER TABLE public.teacher_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teacher_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS teacher_profiles_admin_read ON public.teacher_profiles;
CREATE POLICY teacher_profiles_admin_read
  ON public.teacher_profiles FOR SELECT
  USING (
    auth.uid() IN (
      SELECT id FROM public.user_roles WHERE role = 'admin'
    )
  );

DROP POLICY IF EXISTS teacher_profiles_admin_write ON public.teacher_profiles;
CREATE POLICY teacher_profiles_admin_write
  ON public.teacher_profiles FOR ALL
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

DROP POLICY IF EXISTS teacher_audit_log_admin_read ON public.teacher_audit_log;
CREATE POLICY teacher_audit_log_admin_read
  ON public.teacher_audit_log FOR SELECT
  USING (
    auth.uid() IN (
      SELECT id FROM public.user_roles WHERE role = 'admin'
    )
  );

DROP POLICY IF EXISTS teacher_audit_log_admin_insert ON public.teacher_audit_log;
CREATE POLICY teacher_audit_log_admin_insert
  ON public.teacher_audit_log FOR INSERT
  WITH CHECK (
    auth.uid() IN (
      SELECT id FROM public.user_roles WHERE role = 'admin'
    )
  );
