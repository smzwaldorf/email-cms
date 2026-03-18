-- Allow admins to insert articles under RLS.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'articles'
      AND policyname = 'articles_admin_insert'
  ) THEN
    CREATE POLICY articles_admin_insert
      ON public.articles FOR INSERT
      WITH CHECK (
        auth.uid() IN (
          SELECT id FROM public.user_roles WHERE role = 'admin'
        )
      );
  END IF;
END
$$;
