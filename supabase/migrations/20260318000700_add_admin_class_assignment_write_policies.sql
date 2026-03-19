-- ============================================================================
-- Migration: Add admin write policies for class and assignment tables
-- Purpose: Allow admin class save flows (including teacher assignment) via RLS
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'classes'
      AND policyname = 'classes_admin_write_all'
  ) THEN
    CREATE POLICY classes_admin_write_all
      ON public.classes FOR ALL
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

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'student_class_enrollment'
      AND policyname = 'student_class_enrollment_admin_write_all'
  ) THEN
    CREATE POLICY student_class_enrollment_admin_write_all
      ON public.student_class_enrollment FOR ALL
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

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'teacher_class_assignment'
      AND policyname = 'teacher_class_assignment_admin_write_all'
  ) THEN
    CREATE POLICY teacher_class_assignment_admin_write_all
      ON public.teacher_class_assignment FOR ALL
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
