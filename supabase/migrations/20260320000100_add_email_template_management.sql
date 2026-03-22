-- ============================================================================
-- Migration: Email template lifecycle + immutable revisions
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.email_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  state TEXT NOT NULL DEFAULT 'draft' CHECK (state IN ('draft', 'active', 'inactive')),
  current_revision_id UUID,
  deactivated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.email_template_revisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES public.email_templates(id) ON DELETE CASCADE,
  revision_number INTEGER NOT NULL CHECK (revision_number > 0),
  subject_template TEXT NOT NULL,
  body_template TEXT NOT NULL,
  created_by UUID REFERENCES public.user_roles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (template_id, revision_number)
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'email_templates_current_revision_fk'
      AND table_schema = 'public'
      AND table_name = 'email_templates'
  ) THEN
    ALTER TABLE public.email_templates
      ADD CONSTRAINT email_templates_current_revision_fk
      FOREIGN KEY (current_revision_id)
      REFERENCES public.email_template_revisions(id)
      ON DELETE SET NULL;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.set_email_templates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  IF NEW.state = 'inactive' AND OLD.state <> 'inactive' THEN
    NEW.deactivated_at = COALESCE(NEW.deactivated_at, NOW());
  ELSIF NEW.state <> 'inactive' THEN
    NEW.deactivated_at = NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_email_templates_updated_at ON public.email_templates;
CREATE TRIGGER trg_email_templates_updated_at
  BEFORE UPDATE ON public.email_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.set_email_templates_updated_at();

CREATE INDEX IF NOT EXISTS idx_email_templates_state ON public.email_templates(state);
CREATE INDEX IF NOT EXISTS idx_email_template_revisions_template_id
  ON public.email_template_revisions(template_id, revision_number DESC);

ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_template_revisions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS email_templates_admin_read ON public.email_templates;
CREATE POLICY email_templates_admin_read
  ON public.email_templates FOR SELECT
  USING (public.is_admin_user(auth.uid()));

DROP POLICY IF EXISTS email_templates_admin_write ON public.email_templates;
CREATE POLICY email_templates_admin_write
  ON public.email_templates FOR ALL
  USING (public.is_admin_user(auth.uid()))
  WITH CHECK (public.is_admin_user(auth.uid()));

DROP POLICY IF EXISTS email_template_revisions_admin_read ON public.email_template_revisions;
CREATE POLICY email_template_revisions_admin_read
  ON public.email_template_revisions FOR SELECT
  USING (public.is_admin_user(auth.uid()));

DROP POLICY IF EXISTS email_template_revisions_admin_write ON public.email_template_revisions;
CREATE POLICY email_template_revisions_admin_write
  ON public.email_template_revisions FOR ALL
  USING (public.is_admin_user(auth.uid()))
  WITH CHECK (public.is_admin_user(auth.uid()));

