-- ============================================================================
-- Migration: Add access-control management primitives
-- Purpose: Multi-role assignments, permission mutation audits, and decision traces
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.user_role_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.user_roles(id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL CHECK (role IN ('admin', 'teacher', 'parent', 'student')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  CONSTRAINT unique_user_role_assignment UNIQUE (user_id, role)
);

CREATE INDEX IF NOT EXISTS idx_user_role_assignments_user_id
  ON public.user_role_assignments (user_id, role);

INSERT INTO public.user_role_assignments (user_id, role)
SELECT ur.id, ur.role
FROM public.user_roles ur
ON CONFLICT (user_id, role) DO NOTHING;

CREATE OR REPLACE FUNCTION public.update_user_role_assignments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_user_role_assignments_updated_at ON public.user_role_assignments;
CREATE TRIGGER trigger_user_role_assignments_updated_at
  BEFORE UPDATE ON public.user_role_assignments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_user_role_assignments_updated_at();

CREATE OR REPLACE FUNCTION public.sync_primary_role_from_assignments()
RETURNS TRIGGER AS $$
DECLARE
  target_user_id UUID;
  resolved_role VARCHAR(20);
BEGIN
  target_user_id := COALESCE(NEW.user_id, OLD.user_id);

  SELECT ura.role
  INTO resolved_role
  FROM public.user_role_assignments ura
  WHERE ura.user_id = target_user_id
  ORDER BY CASE ura.role
    WHEN 'admin' THEN 1
    WHEN 'teacher' THEN 2
    WHEN 'parent' THEN 3
    WHEN 'student' THEN 4
    ELSE 99
  END
  LIMIT 1;

  UPDATE public.user_roles
  SET
    role = COALESCE(resolved_role, 'student'),
    updated_at = NOW()
  WHERE id = target_user_id;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_sync_primary_role_from_assignments ON public.user_role_assignments;
CREATE TRIGGER trigger_sync_primary_role_from_assignments
  AFTER INSERT OR UPDATE OR DELETE ON public.user_role_assignments
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_primary_role_from_assignments();

CREATE TABLE IF NOT EXISTS public.permission_mutation_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID REFERENCES public.user_roles(id) ON DELETE SET NULL,
  target_user_id UUID NOT NULL REFERENCES public.user_roles(id) ON DELETE CASCADE,
  action VARCHAR(40) NOT NULL CHECK (action IN ('single_update', 'bulk_update', 'class_scope_update')),
  before_state JSONB NOT NULL DEFAULT '{}'::jsonb,
  after_state JSONB NOT NULL DEFAULT '{}'::jsonb,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  changed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_permission_mutation_target_changed_at
  ON public.permission_mutation_audit_log (target_user_id, changed_at DESC);

CREATE INDEX IF NOT EXISTS idx_permission_mutation_action_changed_at
  ON public.permission_mutation_audit_log (action, changed_at DESC);

CREATE TABLE IF NOT EXISTS public.authorization_decision_trace (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID REFERENCES public.user_roles(id) ON DELETE SET NULL,
  action VARCHAR(60) NOT NULL,
  winning_role VARCHAR(20),
  resolved_scope JSONB NOT NULL DEFAULT '{}'::jsonb,
  granted BOOLEAN NOT NULL,
  reason TEXT NOT NULL,
  policy_version VARCHAR(50) NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_authorization_decision_created_at
  ON public.authorization_decision_trace (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_authorization_decision_action_created_at
  ON public.authorization_decision_trace (action, created_at DESC);

ALTER TABLE public.user_role_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permission_mutation_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.authorization_decision_trace ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS user_role_assignments_read ON public.user_role_assignments;
CREATE POLICY user_role_assignments_read
  ON public.user_role_assignments FOR SELECT
  USING (
    auth.uid() = user_id
    OR auth.uid() IN (
      SELECT id FROM public.user_roles WHERE role = 'admin'
    )
  );

DROP POLICY IF EXISTS user_role_assignments_admin_write ON public.user_role_assignments;
CREATE POLICY user_role_assignments_admin_write
  ON public.user_role_assignments FOR ALL
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

DROP POLICY IF EXISTS permission_mutation_audit_log_admin_read ON public.permission_mutation_audit_log;
CREATE POLICY permission_mutation_audit_log_admin_read
  ON public.permission_mutation_audit_log FOR SELECT
  USING (
    auth.uid() IN (
      SELECT id FROM public.user_roles WHERE role = 'admin'
    )
  );

DROP POLICY IF EXISTS permission_mutation_audit_log_admin_insert ON public.permission_mutation_audit_log;
CREATE POLICY permission_mutation_audit_log_admin_insert
  ON public.permission_mutation_audit_log FOR INSERT
  WITH CHECK (
    auth.uid() IN (
      SELECT id FROM public.user_roles WHERE role = 'admin'
    )
  );

DROP POLICY IF EXISTS authorization_decision_trace_admin_read ON public.authorization_decision_trace;
CREATE POLICY authorization_decision_trace_admin_read
  ON public.authorization_decision_trace FOR SELECT
  USING (
    auth.uid() IN (
      SELECT id FROM public.user_roles WHERE role = 'admin'
    )
  );

DROP POLICY IF EXISTS authorization_decision_trace_admin_insert ON public.authorization_decision_trace;
CREATE POLICY authorization_decision_trace_admin_insert
  ON public.authorization_decision_trace FOR INSERT
  WITH CHECK (
    auth.uid() IN (
      SELECT id FROM public.user_roles WHERE role = 'admin'
    )
  );
