-- ============================================================================
-- Migration: Add family management lifecycle, validation, and audit logging
-- ============================================================================

ALTER TABLE public.families
  ADD COLUMN IF NOT EXISTS family_name TEXT,
  ADD COLUMN IF NOT EXISTS guardian_email TEXT,
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS related_topics JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS deactivated_at TIMESTAMPTZ;

-- Backfill required contact field with deterministic placeholder values.
UPDATE public.families
SET guardian_email = CONCAT('family+', id::text, '@placeholder.local')
WHERE guardian_email IS NULL OR BTRIM(guardian_email) = '';

-- Backfill family_name with family_code for existing records.
UPDATE public.families
SET family_name = family_code
WHERE family_name IS NULL OR BTRIM(family_name) = '';

ALTER TABLE public.families
  ALTER COLUMN guardian_email SET NOT NULL;

CREATE OR REPLACE FUNCTION public.update_families_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_families_updated_at ON public.families;
CREATE TRIGGER trigger_families_updated_at
  BEFORE UPDATE ON public.families
  FOR EACH ROW
  EXECUTE FUNCTION public.update_families_updated_at();

CREATE OR REPLACE FUNCTION public.sync_family_lifecycle_timestamps()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_active = false AND (OLD.is_active IS DISTINCT FROM NEW.is_active) THEN
    NEW.deactivated_at := COALESCE(NEW.deactivated_at, NOW());
  ELSIF NEW.is_active = true AND (OLD.is_active IS DISTINCT FROM NEW.is_active) THEN
    NEW.deactivated_at := NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_families_lifecycle_timestamps ON public.families;
CREATE TRIGGER trigger_families_lifecycle_timestamps
  BEFORE UPDATE ON public.families
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_family_lifecycle_timestamps();

DROP INDEX IF EXISTS idx_families_active_code_unique;
CREATE UNIQUE INDEX idx_families_active_code_unique
  ON public.families (LOWER(family_code))
  WHERE is_active = true;

DROP INDEX IF EXISTS idx_families_active_guardian_email_unique;
CREATE UNIQUE INDEX idx_families_active_guardian_email_unique
  ON public.families (LOWER(guardian_email))
  WHERE is_active = true;

CREATE TABLE IF NOT EXISTS public.family_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id UUID NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (action IN ('create', 'update', 'activate', 'deactivate', 'add_child', 'remove_child')),
  actor_id UUID REFERENCES public.user_roles(id),
  prior_state JSONB,
  new_state JSONB,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_family_audit_log_family_changed_at
  ON public.family_audit_log (family_id, changed_at DESC);

ALTER TABLE public.family_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS family_audit_log_admin_read ON public.family_audit_log;
CREATE POLICY family_audit_log_admin_read
  ON public.family_audit_log FOR SELECT
  USING (
    auth.uid() IN (
      SELECT id FROM public.user_roles WHERE role = 'admin'
    )
  );

DROP POLICY IF EXISTS family_audit_log_admin_insert ON public.family_audit_log;
CREATE POLICY family_audit_log_admin_insert
  ON public.family_audit_log FOR INSERT
  WITH CHECK (
    auth.uid() IN (
      SELECT id FROM public.user_roles WHERE role = 'admin'
    )
  );

DROP POLICY IF EXISTS families_admin_write_all ON public.families;
CREATE POLICY families_admin_write_all
  ON public.families FOR ALL
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

DROP POLICY IF EXISTS family_enrollment_admin_write_all ON public.family_enrollment;
CREATE POLICY family_enrollment_admin_write_all
  ON public.family_enrollment FOR ALL
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
