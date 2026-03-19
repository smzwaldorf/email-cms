-- ============================================================================
-- Migration: Student lifecycle + audit + integrity helpers
-- ============================================================================

ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS student_code TEXT,
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS deactivated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

UPDATE public.students
SET student_code = UPPER(REGEXP_REPLACE(BTRIM(name), '[^A-Za-z0-9]+', '-', 'g'))
WHERE student_code IS NULL OR BTRIM(student_code) = '';

ALTER TABLE public.students
  ALTER COLUMN student_code SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_students_code_active_unique
  ON public.students (student_code)
  WHERE is_active = true;

CREATE UNIQUE INDEX IF NOT EXISTS idx_students_name_active_unique
  ON public.students (LOWER(BTRIM(name)))
  WHERE is_active = true;

CREATE OR REPLACE FUNCTION public.set_students_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  IF NEW.is_active = false AND OLD.is_active = true THEN
    NEW.deactivated_at = COALESCE(NEW.deactivated_at, NOW());
  ELSIF NEW.is_active = true THEN
    NEW.deactivated_at = NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_students_updated_at ON public.students;
CREATE TRIGGER trg_students_updated_at
  BEFORE UPDATE ON public.students
  FOR EACH ROW
  EXECUTE FUNCTION public.set_students_updated_at();

CREATE TABLE IF NOT EXISTS public.student_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (action IN (
    'create', 'update', 'activate', 'deactivate',
    'add_class', 'remove_class', 'add_family', 'remove_family'
  )),
  actor_id UUID REFERENCES public.user_roles(id) ON DELETE SET NULL,
  prior_state JSONB,
  new_state JSONB,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.student_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS student_audit_log_admin_read ON public.student_audit_log;
CREATE POLICY student_audit_log_admin_read
  ON public.student_audit_log FOR SELECT
  USING (public.is_admin_user(auth.uid()));

DROP POLICY IF EXISTS student_audit_log_admin_write ON public.student_audit_log;
CREATE POLICY student_audit_log_admin_write
  ON public.student_audit_log FOR INSERT
  WITH CHECK (public.is_admin_user(auth.uid()));
