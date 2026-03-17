-- Explicitly enable RLS on student_class_enrollment
-- (It might be already enabled, but this ensures it)
ALTER TABLE public.student_class_enrollment ENABLE ROW LEVEL SECURITY;

-- 1. Drop existing policies to avoid conflicts or confusion (e.g. the 'true' policy)
DROP POLICY IF EXISTS student_class_enrollment_read ON public.student_class_enrollment;

-- 2. Policy for Admins: Enable full read access
CREATE POLICY student_class_enrollment_admin_read
  ON public.student_class_enrollment FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.id = auth.uid()
      AND user_roles.role = 'admin'
    )
  );

-- 3. Policy for Parents: Enable read access for their own family's enrollments
-- This matches the user's family_id via family_enrollment
CREATE POLICY student_class_enrollment_parent_read
  ON public.student_class_enrollment FOR SELECT
  USING (
    family_id IN (
      SELECT family_id FROM public.family_enrollment
      WHERE parent_id = auth.uid()
    )
  );

-- 4. Policy for Students? (Optional, but good for completeness if consistent with family_enrollment)
-- If a student needs to see their own enrollment
CREATE POLICY student_class_enrollment_student_read
  ON public.student_class_enrollment FOR SELECT
  USING (
    student_id IN (
      SELECT student_id FROM public.family_enrollment
      WHERE student_id = auth.uid() -- This assumes auth.uid maps to a student, which is rare in this schema (parents are auth users)
    )
    OR
    -- If auth.uid IS the student ID (if students have accounts)
    student_id = auth.uid()
  );
