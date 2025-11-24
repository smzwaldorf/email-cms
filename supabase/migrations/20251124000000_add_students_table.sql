-- ============================================================================
-- Migration: Add Students Table and Update Enrollments
-- Description: Separates student data from user_roles, updates family structure,
-- and renames child_class_enrollment to student_class_enrollment.
-- ============================================================================

-- 1. Create students table
CREATE TABLE public.students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on students
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;

-- Allow read access to students (can be refined later)
CREATE POLICY students_read_all
  ON public.students FOR SELECT
  USING (true);

-- 2. Modify family_enrollment to support students
-- A row can now represent a parent OR a student in a family
ALTER TABLE public.family_enrollment
  ADD COLUMN student_id UUID REFERENCES public.students(id) ON DELETE CASCADE,
  ALTER COLUMN parent_id DROP NOT NULL;

-- Add constraint to ensure a row is either for a parent or a student, not both (and not neither)
ALTER TABLE public.family_enrollment
  ADD CONSTRAINT family_member_check CHECK (
    (parent_id IS NOT NULL AND student_id IS NULL) OR
    (parent_id IS NULL AND student_id IS NOT NULL)
  );

-- Update relationship check to include 'student' or 'child' if we want to store that in relationship column
-- The existing check is: CHECK (relationship IN ('father', 'mother', 'guardian'))
-- We should probably drop or update this check to allow 'child' or 'student'.
ALTER TABLE public.family_enrollment
  DROP CONSTRAINT family_enrollment_relationship_check;

ALTER TABLE public.family_enrollment
  ADD CONSTRAINT family_enrollment_relationship_check
  CHECK (relationship IN ('father', 'mother', 'guardian', 'child', 'student'));

-- 3. Rename child_class_enrollment to student_class_enrollment
ALTER TABLE public.child_class_enrollment RENAME TO student_class_enrollment;

-- Rename child_id column to student_id
ALTER TABLE public.student_class_enrollment
  RENAME COLUMN child_id TO student_id;

-- Drop old foreign key (was referencing user_roles)
ALTER TABLE public.student_class_enrollment
  DROP CONSTRAINT child_class_enrollment_child_id_fkey;

-- Add new foreign key referencing students table
ALTER TABLE public.student_class_enrollment
  ADD CONSTRAINT student_class_enrollment_student_id_fkey
  FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE;

-- Rename indexes for consistency
ALTER INDEX idx_child_enrollment_child RENAME TO idx_student_enrollment_student;
ALTER INDEX idx_child_enrollment_family RENAME TO idx_student_enrollment_family;

-- 4. Update RLS Policies

-- Update articles_class_restricted_read to use the new structure
DROP POLICY IF EXISTS articles_class_restricted_read ON public.articles;

CREATE POLICY articles_class_restricted_read
  ON public.articles FOR SELECT
  USING (
    visibility_type = 'class_restricted'
    AND is_published = true
    AND deleted_at IS NULL
    AND (
      -- Parent Check (New Schema with Students Table)
      auth.uid() IN (
        SELECT fe_parent.parent_id
        FROM family_enrollment fe_parent
        JOIN family_enrollment fe_student ON fe_parent.family_id = fe_student.family_id
        JOIN student_class_enrollment sce ON fe_student.student_id = sce.student_id
        , LATERAL jsonb_array_elements(articles.restricted_to_classes) class_elem
        WHERE
          fe_parent.parent_id IS NOT NULL -- Ensure we are starting from a parent
          AND fe_student.student_id IS NOT NULL -- Ensure we are joining to a student
          AND TRIM(class_elem::text, '"') = sce.class_id
          AND sce.graduated_at IS NULL
      )
      OR
      -- Teacher Check (Restored)
      auth.uid() IN (
        SELECT tca.teacher_id
        FROM teacher_class_assignment tca,
        LATERAL jsonb_array_elements(articles.restricted_to_classes) class_elem
        WHERE TRIM(class_elem::text, '"') = tca.class_id
      )
    )
  );

-- CREATE POLICY articles_class_restricted_read
--   ON public.articles FOR SELECT
--   USING (
--     visibility_type = 'class_restricted'
--     AND is_published = true
--     AND deleted_at IS NULL
--     AND auth.uid() IN (
--       SELECT fe_parent.parent_id
--       FROM family_enrollment fe_parent
--       JOIN family_enrollment fe_student ON fe_parent.family_id = fe_student.family_id
--       JOIN student_class_enrollment sce ON fe_student.student_id = sce.student_id
--       , LATERAL jsonb_array_elements(articles.restricted_to_classes) class_elem
--       WHERE
--         fe_parent.parent_id IS NOT NULL -- Ensure we are starting from a parent
--         AND fe_student.student_id IS NOT NULL -- Ensure we are joining to a student
--         AND TRIM(class_elem::text, '"') = sce.class_id
--         AND sce.graduated_at IS NULL
--     )
--   );

-- Ensure RLS is enabled on family_enrollment (already enabled in initial schema)
-- We can refine the policy if needed, but keeping 'true' for now as per minimal change,
-- unless "family_enrollment should have RLS enabled" implies strictly restricted.
-- Given the dev context, I'll ensure the policy exists.
-- (It exists as 'family_enrollment_read' in initial schema)

-- Enable RLS on student_class_enrollment (renamed table retains RLS status)
-- Policy 'child_class_enrollment_read' needs to be dropped and recreated with new name if we want clean naming,
-- but Postgres renames the policy automatically attached to the table? No, policies are attached to table.
-- When table is renamed, policies stay.
-- Let's rename the policy for clarity.
DROP POLICY IF EXISTS child_class_enrollment_read ON public.student_class_enrollment;

CREATE POLICY student_class_enrollment_read
  ON public.student_class_enrollment FOR SELECT
  USING (true);
