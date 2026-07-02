-- Queue table for backend newsletter delivery workers.

CREATE TABLE IF NOT EXISTS public.newsletter_delivery_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID NOT NULL REFERENCES public.newsletter_delivery_batches(id) ON DELETE CASCADE,
  job_type TEXT NOT NULL CHECK (job_type IN ('prepare_batch')),
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'succeeded', 'failed')),
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 3,
  run_after TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  locked_at TIMESTAMPTZ,
  locked_by TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  last_error TEXT,
  details JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_newsletter_delivery_jobs_status_run_after
  ON public.newsletter_delivery_jobs(status, run_after, created_at);

CREATE INDEX IF NOT EXISTS idx_newsletter_delivery_jobs_batch
  ON public.newsletter_delivery_jobs(batch_id);

ALTER TABLE public.newsletter_delivery_jobs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'newsletter_delivery_jobs'
      AND policyname = 'newsletter_delivery_jobs_admin_read'
  ) THEN
    CREATE POLICY newsletter_delivery_jobs_admin_read
      ON public.newsletter_delivery_jobs
      FOR SELECT
      USING (
        EXISTS (
          SELECT 1 FROM public.user_roles
          WHERE user_roles.id = auth.uid()
            AND user_roles.role = 'admin'
        )
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'newsletter_delivery_jobs'
      AND policyname = 'newsletter_delivery_jobs_admin_write'
  ) THEN
    CREATE POLICY newsletter_delivery_jobs_admin_write
      ON public.newsletter_delivery_jobs
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

DROP TRIGGER IF EXISTS update_newsletter_delivery_jobs_updated_at
  ON public.newsletter_delivery_jobs;
CREATE TRIGGER update_newsletter_delivery_jobs_updated_at
  BEFORE UPDATE ON public.newsletter_delivery_jobs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
