-- Fix Teacher RLS for Class-Restricted Articles
-- Feature: 003-fix-teacher-rls

-- Fix 1: Add RLS policy for teacher_class_assignment to allow teachers to read their own assignments
-- This was missing, preventing the teacher check in the articles policy from working
CREATE POLICY teacher_class_assignment_read_own
  ON public.teacher_class_assignment FOR SELECT
  USING (teacher_id = auth.uid());

-- Fix 2: Update articles_class_restricted_read policy to include teachers
-- Previous policy only checked for parents
DROP POLICY IF EXISTS articles_class_restricted_read ON public.articles;

CREATE POLICY articles_class_restricted_read
  ON public.articles FOR SELECT
  USING (
    visibility_type = 'class_restricted'
    AND is_published = true
    AND deleted_at IS NULL
    AND (
      -- Parent check: User is a parent in a family with an active child in the restricted class
      auth.uid() IN (
        SELECT fe.parent_id
        FROM family_enrollment fe
        JOIN child_class_enrollment cce ON fe.family_id = cce.family_id,
        LATERAL jsonb_array_elements(articles.restricted_to_classes) class_elem
        WHERE TRIM(class_elem::text, '"') = cce.class_id
          AND cce.graduated_at IS NULL
      )
      OR
      -- Teacher check: User is a teacher assigned to the restricted class
      auth.uid() IN (
        SELECT tca.teacher_id
        FROM teacher_class_assignment tca,
        LATERAL jsonb_array_elements(articles.restricted_to_classes) class_elem
        WHERE TRIM(class_elem::text, '"') = tca.class_id
      )
    )
  );
