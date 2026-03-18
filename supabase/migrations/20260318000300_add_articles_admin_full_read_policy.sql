-- Ensure admins can read all article rows, including draft/template-copied rows.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'articles'
      AND policyname = 'articles_admin_read_all'
  ) THEN
    CREATE POLICY articles_admin_read_all
      ON public.articles FOR SELECT
      USING (
        auth.uid() IN (
          SELECT id FROM public.user_roles WHERE role = 'admin'
        )
      );
  END IF;
END
$$;
