-- Migration to add admin read policy for newsletters
-- Allows admins to read all newsletters including drafts

-- Add admin read policy for newsletters (admins can see all statuses)
CREATE POLICY newsletters_admin_read
  ON public.newsletters FOR SELECT
  USING (
    auth.uid() IN (
      SELECT id FROM public.user_roles WHERE role = 'admin'
    )
  );

-- Add teacher read policy for newsletters (teachers can see all statuses)
CREATE POLICY newsletters_teacher_read
  ON public.newsletters FOR SELECT
  USING (
    auth.uid() IN (
      SELECT id FROM public.user_roles WHERE role = 'teacher'
    )
  );

-- Add admin insert policy for newsletters
CREATE POLICY newsletters_admin_insert
  ON public.newsletters FOR INSERT
  WITH CHECK (
    auth.uid() IN (
      SELECT id FROM public.user_roles WHERE role = 'admin'
    )
  );

-- Add admin update policy for newsletters
CREATE POLICY newsletters_admin_update
  ON public.newsletters FOR UPDATE
  USING (
    auth.uid() IN (
      SELECT id FROM public.user_roles WHERE role = 'admin'
    )
  );

-- Add admin delete policy for newsletters
CREATE POLICY newsletters_admin_delete
  ON public.newsletters FOR DELETE
  USING (
    auth.uid() IN (
      SELECT id FROM public.user_roles WHERE role = 'admin'
    )
  );
