-- Enable Teacher Editing for Class-Restricted Articles
-- Feature: 004-enable-teacher-editing

-- Allow teachers to UPDATE articles where they are assigned to one of the restricted classes
-- Note: Teachers can only edit class-restricted articles, not public ones
CREATE POLICY articles_teacher_update
  ON public.articles FOR UPDATE
  USING (
    visibility_type = 'class_restricted'
    AND auth.uid() IN (
      SELECT tca.teacher_id
      FROM teacher_class_assignment tca,
      LATERAL jsonb_array_elements(articles.restricted_to_classes) class_elem
      WHERE TRIM(class_elem::text, '"') = tca.class_id
    )
  )
  WITH CHECK (
    visibility_type = 'class_restricted'
    AND auth.uid() IN (
      SELECT tca.teacher_id
      FROM teacher_class_assignment tca,
      LATERAL jsonb_array_elements(articles.restricted_to_classes) class_elem
      WHERE TRIM(class_elem::text, '"') = tca.class_id
    )
  );
