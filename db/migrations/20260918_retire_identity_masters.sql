-- Retire Auth-owned masters after the application API cutover.
-- The caller must take a backup and load reviewed Auth ID mappings beforehand.
-- Historical IDs remain unchanged. No cascading deletion is permitted.
BEGIN;
SET LOCAL lock_timeout = '5s';
CREATE TABLE IF NOT EXISTS public.identity_reference_mappings (
  entity_type text NOT NULL CHECK (entity_type IN ('person','family','class','student')),
  legacy_id text NOT NULL,
  auth_id uuid,
  PRIMARY KEY (entity_type, legacy_id)
);
CREATE TABLE IF NOT EXISTS public.newsletter_family_preferences (
  family_id uuid PRIMARY KEY,
  auth_family_id uuid UNIQUE,
  newsletter_subscription_status public.newsletter_subscription_status NOT NULL DEFAULT 'subscribed',
  newsletter_subscription_source text,
  newsletter_subscription_updated_at timestamptz,
  newsletter_subscribed_at timestamptz,
  newsletter_unsubscribed_at timestamptz,
  related_topics jsonb NOT NULL DEFAULT '[]'::jsonb
);
COMMENT ON TABLE public.newsletter_family_preferences IS 'CMS newsletter preferences only; family identity and membership are owned by Auth.';
COMMENT ON TABLE public.identity_reference_mappings IS 'Identifier-only aliases for legacy CMS references; no directory profiles or authority.';

DO $$
DECLARE retired text[] := ARRAY['families','family_enrollment','students','student_class_enrollment','teacher_profiles','teacher_class_assignment','classes','user_roles','user_role_assignments'];
  dependency record;
BEGIN
  IF to_regclass('public.families') IS NOT NULL THEN
    INSERT INTO public.identity_reference_mappings(entity_type,legacy_id)
      SELECT 'family',id::text FROM public.families ON CONFLICT DO NOTHING;
    INSERT INTO public.newsletter_family_preferences
      (family_id,auth_family_id,newsletter_subscription_status,newsletter_subscription_source,
       newsletter_subscription_updated_at,newsletter_subscribed_at,newsletter_unsubscribed_at,related_topics)
      SELECT f.id,m.auth_id,f.newsletter_subscription_status,f.newsletter_subscription_source,
        f.newsletter_subscription_updated_at,f.newsletter_subscribed_at,f.newsletter_unsubscribed_at,f.related_topics
      FROM public.families f LEFT JOIN public.identity_reference_mappings m ON m.entity_type='family' AND m.legacy_id=f.id::text
      ON CONFLICT (family_id) DO NOTHING;
    -- An orphaned opt-out could be bypassed by a new canonical identity. Require
    -- explicit reconciliation before dropping the identifying legacy metadata.
    IF EXISTS (SELECT 1 FROM public.families f LEFT JOIN public.identity_reference_mappings m
      ON m.entity_type='family' AND m.legacy_id=f.id::text
      WHERE f.newsletter_subscription_status::text <> 'subscribed' AND m.auth_id IS NULL) THEN
      RAISE EXCEPTION 'Unmapped newsletter opt-out/pending preference: reconcile Auth family IDs before retirement';
    END IF;
    IF EXISTS (SELECT 1 FROM public.families f LEFT JOIN public.newsletter_family_preferences p ON p.family_id=f.id
      WHERE p.family_id IS NULL OR p.newsletter_subscription_status IS DISTINCT FROM f.newsletter_subscription_status
      OR p.newsletter_subscription_source IS DISTINCT FROM f.newsletter_subscription_source
      OR p.newsletter_subscription_updated_at IS DISTINCT FROM f.newsletter_subscription_updated_at
      OR p.newsletter_subscribed_at IS DISTINCT FROM f.newsletter_subscribed_at
      OR p.newsletter_unsubscribed_at IS DISTINCT FROM f.newsletter_unsubscribed_at
      OR p.related_topics IS DISTINCT FROM f.related_topics) THEN
      RAISE EXCEPTION 'Newsletter preference extraction mismatch';
    END IF;
  END IF;
  IF to_regclass('public.user_roles') IS NOT NULL THEN
    INSERT INTO public.identity_reference_mappings(entity_type,legacy_id)
      SELECT 'person',id::text FROM public.user_roles ON CONFLICT DO NOTHING;
  END IF;
  IF to_regclass('public.students') IS NOT NULL THEN
    INSERT INTO public.identity_reference_mappings(entity_type,legacy_id)
      SELECT 'student',id::text FROM public.students ON CONFLICT DO NOTHING;
  END IF;
  IF to_regclass('public.classes') IS NOT NULL THEN
    INSERT INTO public.identity_reference_mappings(entity_type,legacy_id)
      SELECT 'class',id::text FROM public.classes ON CONFLICT DO NOTHING;
  END IF;
  -- Drop inbound FK constraints, never referenced rows. Retain historical UUIDs.
  FOR dependency IN SELECT n.nspname,c.relname,con.conname FROM pg_constraint con
    JOIN pg_class c ON c.oid=con.conrelid JOIN pg_namespace n ON n.oid=c.relnamespace
    JOIN pg_class parent ON parent.oid=con.confrelid JOIN pg_namespace pn ON pn.oid=parent.relnamespace
    WHERE con.contype='f' AND pn.nspname='public' AND parent.relname=ANY(retired)
  LOOP
    IF dependency.nspname <> 'public' THEN RAISE EXCEPTION 'Unexpected cross-schema dependency: %', dependency; END IF;
    EXECUTE format('ALTER TABLE %I.%I DROP CONSTRAINT %I',dependency.nspname,dependency.relname,dependency.conname);
  END LOOP;
END $$;

DROP TABLE IF EXISTS public.family_enrollment,public.student_class_enrollment,public.teacher_class_assignment,
 public.teacher_profiles,public.user_role_assignments,public.families,public.students,public.classes,public.user_roles RESTRICT;
DROP FUNCTION IF EXISTS public.set_students_updated_at(),public.sync_class_lifecycle_timestamps(),
 public.sync_family_lifecycle_timestamps(),public.sync_primary_role_from_assignments(),
 public.sync_teacher_profile_lifecycle(),public.update_classes_updated_at(),public.update_families_updated_at(),
 public.update_teacher_profiles_updated_at(),public.update_user_role_assignments_updated_at() RESTRICT;
COMMIT;
