-- ============================================================================
-- Migration: Add class lifecycle, identity constraints, and audit metadata
-- Purpose: Support class management workflow with activation/deactivation
-- ============================================================================

ALTER TABLE public.classes
ADD COLUMN IF NOT EXISTS class_code TEXT,
ADD COLUMN IF NOT EXISTS description TEXT,
ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS deactivated_at TIMESTAMP WITH TIME ZONE;

-- Backfill class_code from legacy ID values.
UPDATE public.classes
SET class_code = id
WHERE class_code IS NULL OR btrim(class_code) = '';

-- Resolve duplicate class_code values deterministically before unique index.
WITH duplicate_codes AS (
  SELECT id, class_code, ROW_NUMBER() OVER (
    PARTITION BY lower(btrim(class_code))
    ORDER BY created_at, id
  ) AS rn
  FROM public.classes
)
UPDATE public.classes c
SET class_code = c.class_code || '-' || LEFT(c.id, 4)
FROM duplicate_codes d
WHERE c.id = d.id
  AND d.rn > 1;

-- Resolve duplicate class_name values deterministically before unique index.
WITH duplicate_names AS (
  SELECT id, class_name, ROW_NUMBER() OVER (
    PARTITION BY lower(btrim(class_name))
    ORDER BY created_at, id
  ) AS rn
  FROM public.classes
)
UPDATE public.classes c
SET class_name = c.class_name || ' (' || c.id || ')'
FROM duplicate_names d
WHERE c.id = d.id
  AND d.rn > 1;

ALTER TABLE public.classes
ALTER COLUMN class_code SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_classes_class_code_unique
  ON public.classes (lower(btrim(class_code)));

CREATE UNIQUE INDEX IF NOT EXISTS idx_classes_class_name_unique
  ON public.classes (lower(btrim(class_name)));

CREATE INDEX IF NOT EXISTS idx_classes_is_active
  ON public.classes (is_active, class_grade_year DESC, class_name);

CREATE OR REPLACE FUNCTION public.update_classes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_classes_updated_at ON public.classes;
CREATE TRIGGER trigger_classes_updated_at
  BEFORE UPDATE ON public.classes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_classes_updated_at();

CREATE OR REPLACE FUNCTION public.sync_class_lifecycle_timestamps()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_active = FALSE AND OLD.is_active = TRUE THEN
    NEW.deactivated_at = COALESCE(NEW.deactivated_at, NOW());
  ELSIF NEW.is_active = TRUE AND OLD.is_active = FALSE THEN
    NEW.deactivated_at = NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_classes_lifecycle_timestamps ON public.classes;
CREATE TRIGGER trigger_classes_lifecycle_timestamps
  BEFORE UPDATE ON public.classes
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_class_lifecycle_timestamps();

CREATE TABLE IF NOT EXISTS public.class_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id VARCHAR(10) NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  action VARCHAR(20) NOT NULL CHECK (action IN ('create', 'update', 'activate', 'deactivate')),
  actor_id UUID REFERENCES public.user_roles(id) ON DELETE SET NULL,
  prior_state JSONB,
  new_state JSONB,
  changed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_class_audit_log_class_changed_at
  ON public.class_audit_log (class_id, changed_at DESC);

