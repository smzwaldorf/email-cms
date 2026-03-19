-- Email platform integration tables for Kit sync, webhooks, and reconciliation.

CREATE EXTENSION IF NOT EXISTS "pg_cron";

DO $$ BEGIN
  CREATE TYPE email_platform_provider AS ENUM ('kit');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE email_platform_sync_job_status AS ENUM (
    'pending',
    'processing',
    'retryable',
    'succeeded',
    'failed',
    'dead_lettered'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE email_platform_webhook_status AS ENUM (
    'received',
    'processing',
    'retryable',
    'processed',
    'unresolved',
    'failed',
    'dead_lettered'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE newsletter_subscription_status AS ENUM (
    'pending',
    'subscribed',
    'unsubscribed',
    'bounced',
    'complained'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

ALTER TABLE public.families
  ADD COLUMN IF NOT EXISTS newsletter_subscription_status newsletter_subscription_status NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS newsletter_subscription_source TEXT,
  ADD COLUMN IF NOT EXISTS newsletter_subscription_updated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS newsletter_subscribed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS newsletter_unsubscribed_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS public.email_platform_subscriber_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id UUID NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  provider email_platform_provider NOT NULL DEFAULT 'kit',
  external_identity_key TEXT NOT NULL,
  external_subscriber_id TEXT,
  external_email_address TEXT,
  provider_state TEXT,
  last_synced_at TIMESTAMPTZ,
  last_payload_fingerprint TEXT,
  last_provider_version_marker TEXT,
  last_reconciled_at TIMESTAMPTZ,
  last_drift_reason TEXT,
  sync_metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.email_platform_sync_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id UUID REFERENCES public.families(id) ON DELETE CASCADE,
  mapping_id UUID REFERENCES public.email_platform_subscriber_mappings(id) ON DELETE SET NULL,
  provider email_platform_provider NOT NULL DEFAULT 'kit',
  job_type TEXT NOT NULL CHECK (job_type IN ('upsert_subscriber', 'reconcile_subscriber')),
  status email_platform_sync_job_status NOT NULL DEFAULT 'pending',
  enqueue_reason TEXT NOT NULL DEFAULT 'unspecified',
  payload JSONB NOT NULL DEFAULT '{}'::JSONB,
  payload_fingerprint TEXT,
  attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  max_attempts INTEGER NOT NULL DEFAULT 5 CHECK (max_attempts > 0),
  next_retry_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processing_started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  dead_lettered_at TIMESTAMPTZ,
  mismatch_reason TEXT,
  last_error_code TEXT,
  last_error_message TEXT,
  metrics JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.email_platform_webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider email_platform_provider NOT NULL DEFAULT 'kit',
  provider_event_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  delivery_key TEXT NOT NULL,
  signature_valid BOOLEAN NOT NULL DEFAULT false,
  signature_failure_reason TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::JSONB,
  payload_hash TEXT NOT NULL,
  occurred_at TIMESTAMPTZ,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status email_platform_webhook_status NOT NULL DEFAULT 'received',
  attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  max_attempts INTEGER NOT NULL DEFAULT 5 CHECK (max_attempts > 0),
  next_retry_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processing_started_at TIMESTAMPTZ,
  processed_at TIMESTAMPTZ,
  dead_lettered_at TIMESTAMPTZ,
  resolved_family_id UUID REFERENCES public.families(id) ON DELETE SET NULL,
  resolved_mapping_id UUID REFERENCES public.email_platform_subscriber_mappings(id) ON DELETE SET NULL,
  unresolved_reason TEXT,
  last_error_code TEXT,
  last_error_message TEXT,
  metrics JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.email_platform_subscription_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id UUID NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  provider email_platform_provider NOT NULL DEFAULT 'kit',
  mapping_id UUID REFERENCES public.email_platform_subscriber_mappings(id) ON DELETE SET NULL,
  webhook_event_id UUID REFERENCES public.email_platform_webhook_events(id) ON DELETE SET NULL,
  old_status newsletter_subscription_status,
  new_status newsletter_subscription_status NOT NULL,
  source TEXT NOT NULL,
  event_type TEXT,
  occurred_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_email_platform_mappings_family_provider
  ON public.email_platform_subscriber_mappings(provider, family_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_email_platform_mappings_external_identity
  ON public.email_platform_subscriber_mappings(provider, external_identity_key);

CREATE UNIQUE INDEX IF NOT EXISTS idx_email_platform_mappings_external_subscriber
  ON public.email_platform_subscriber_mappings(provider, external_subscriber_id)
  WHERE external_subscriber_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_email_platform_mappings_reconciliation
  ON public.email_platform_subscriber_mappings(provider, last_reconciled_at, last_synced_at);

CREATE INDEX IF NOT EXISTS idx_email_platform_sync_jobs_status_retry
  ON public.email_platform_sync_jobs(provider, status, next_retry_at);

CREATE INDEX IF NOT EXISTS idx_email_platform_sync_jobs_family
  ON public.email_platform_sync_jobs(family_id, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_email_platform_sync_jobs_pending_dedupe
  ON public.email_platform_sync_jobs(
    provider,
    COALESCE(family_id::TEXT, 'unknown-family'),
    job_type,
    COALESCE(payload_fingerprint, ''),
    status
  )
  WHERE status IN ('pending', 'processing', 'retryable');

CREATE UNIQUE INDEX IF NOT EXISTS idx_email_platform_webhook_delivery
  ON public.email_platform_webhook_events(provider, delivery_key);

CREATE INDEX IF NOT EXISTS idx_email_platform_webhooks_status_retry
  ON public.email_platform_webhook_events(provider, status, next_retry_at);

CREATE INDEX IF NOT EXISTS idx_email_platform_webhooks_resolved_family
  ON public.email_platform_webhook_events(resolved_family_id, received_at DESC);

CREATE INDEX IF NOT EXISTS idx_email_platform_subscription_audit_family
  ON public.email_platform_subscription_audit(family_id, created_at DESC);

ALTER TABLE public.email_platform_subscriber_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_platform_sync_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_platform_webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_platform_subscription_audit ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'email_platform_subscriber_mappings'
      AND policyname = 'email_platform_subscriber_mappings_admin_read'
  ) THEN
    CREATE POLICY email_platform_subscriber_mappings_admin_read
      ON public.email_platform_subscriber_mappings
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
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'email_platform_sync_jobs'
      AND policyname = 'email_platform_sync_jobs_admin_read'
  ) THEN
    CREATE POLICY email_platform_sync_jobs_admin_read
      ON public.email_platform_sync_jobs
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
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'email_platform_webhook_events'
      AND policyname = 'email_platform_webhook_events_admin_read'
  ) THEN
    CREATE POLICY email_platform_webhook_events_admin_read
      ON public.email_platform_webhook_events
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
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'email_platform_subscription_audit'
      AND policyname = 'email_platform_subscription_audit_admin_read'
  ) THEN
    CREATE POLICY email_platform_subscription_audit_admin_read
      ON public.email_platform_subscription_audit
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

DROP TRIGGER IF EXISTS update_email_platform_subscriber_mappings_updated_at
  ON public.email_platform_subscriber_mappings;
CREATE TRIGGER update_email_platform_subscriber_mappings_updated_at
  BEFORE UPDATE ON public.email_platform_subscriber_mappings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_email_platform_sync_jobs_updated_at
  ON public.email_platform_sync_jobs;
CREATE TRIGGER update_email_platform_sync_jobs_updated_at
  BEFORE UPDATE ON public.email_platform_sync_jobs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_email_platform_webhook_events_updated_at
  ON public.email_platform_webhook_events;
CREATE TRIGGER update_email_platform_webhook_events_updated_at
  BEFORE UPDATE ON public.email_platform_webhook_events
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM cron.job
    WHERE jobname = 'enqueue-email-platform-reconciliation'
  ) THEN
    PERFORM cron.schedule(
      'enqueue-email-platform-reconciliation',
      '*/30 * * * *',
      $cron$
      INSERT INTO public.email_platform_sync_jobs (
        family_id,
        mapping_id,
        provider,
        job_type,
        status,
        enqueue_reason,
        payload,
        payload_fingerprint,
        mismatch_reason
      )
      SELECT
        mapping.family_id,
        mapping.id,
        mapping.provider,
        'reconcile_subscriber',
        'pending',
        'scheduled_reconciliation',
        jsonb_build_object(
          'family_id', mapping.family_id,
          'external_subscriber_id', mapping.external_subscriber_id
        ),
        COALESCE(mapping.last_payload_fingerprint, ''),
        'scheduled_reconciliation'
      FROM public.email_platform_subscriber_mappings AS mapping
      INNER JOIN public.families AS family
        ON family.id = mapping.family_id
      WHERE family.is_active = true
        AND (
          mapping.last_reconciled_at IS NULL
          OR mapping.last_reconciled_at < NOW() - INTERVAL '6 hours'
        )
        AND NOT EXISTS (
          SELECT 1
          FROM public.email_platform_sync_jobs AS job
          WHERE job.mapping_id = mapping.id
            AND job.job_type = 'reconcile_subscriber'
            AND job.status IN ('pending', 'processing', 'retryable')
        );
      $cron$
    );
  END IF;
END $$;
