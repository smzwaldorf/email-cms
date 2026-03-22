-- Allow admin workflows to enqueue email platform sync jobs.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'email_platform_sync_jobs'
      AND policyname = 'email_platform_sync_jobs_admin_write'
  ) THEN
    CREATE POLICY email_platform_sync_jobs_admin_write
      ON public.email_platform_sync_jobs
      FOR ALL
      USING (
        EXISTS (
          SELECT 1 FROM public.user_roles
          WHERE user_roles.id = auth.uid()
            AND user_roles.role = 'admin'
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.user_roles
          WHERE user_roles.id = auth.uid()
            AND user_roles.role = 'admin'
        )
      );
  END IF;
END $$;
