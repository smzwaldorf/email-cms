-- Newsletter delivery orchestration schema.

DO $$ BEGIN
  CREATE TYPE newsletter_delivery_trigger AS ENUM ('publish', 'resend');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE newsletter_delivery_audience_mode AS ENUM ('all', 'classes', 'families', 'family');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE newsletter_delivery_batch_state AS ENUM (
    'queued',
    'preparing',
    'sending',
    'completed',
    'completed_with_failures',
    'failed'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE newsletter_delivery_eligibility_status AS ENUM ('eligible', 'ineligible');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE newsletter_delivery_preparation_status AS ENUM ('pending', 'ready', 'warning', 'failed', 'skipped');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE newsletter_delivery_send_status AS ENUM ('pending', 'handoff_pending', 'sent', 'failed', 'skipped');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS public.newsletter_delivery_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  newsletter_id UUID NOT NULL REFERENCES public.newsletters(id) ON DELETE CASCADE,
  trigger newsletter_delivery_trigger NOT NULL DEFAULT 'publish',
  audience_mode newsletter_delivery_audience_mode NOT NULL DEFAULT 'all',
  selected_class_ids TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  selected_family_ids UUID[] NOT NULL DEFAULT ARRAY[]::UUID[],
  parent_batch_id UUID REFERENCES public.newsletter_delivery_batches(id) ON DELETE SET NULL,
  state newsletter_delivery_batch_state NOT NULL DEFAULT 'queued',
  pinned_newsletter_revision_id TEXT NOT NULL,
  pinned_template_id UUID,
  pinned_template_revision_id UUID,
  recipient_snapshot_captured_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  rules_version TEXT NOT NULL DEFAULT 'v1',
  preparation_job_id TEXT,
  total_recipients INTEGER NOT NULL DEFAULT 0,
  eligible_recipients INTEGER NOT NULL DEFAULT 0,
  ready_recipients INTEGER NOT NULL DEFAULT 0,
  sent_recipients INTEGER NOT NULL DEFAULT 0,
  failed_recipients INTEGER NOT NULL DEFAULT 0,
  invalid_recipients INTEGER NOT NULL DEFAULT 0,
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.newsletter_delivery_batch_recipients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID NOT NULL REFERENCES public.newsletter_delivery_batches(id) ON DELETE CASCADE,
  family_id UUID NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  guardian_email TEXT,
  eligibility_status newsletter_delivery_eligibility_status NOT NULL DEFAULT 'eligible',
  preparation_status newsletter_delivery_preparation_status NOT NULL DEFAULT 'pending',
  send_status newsletter_delivery_send_status NOT NULL DEFAULT 'pending',
  failure_reason TEXT,
  prepared_payload JSONB,
  provider_message_id TEXT,
  provider_error TEXT,
  last_attempted_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(batch_id, family_id)
);

CREATE INDEX IF NOT EXISTS idx_delivery_batches_newsletter_created
  ON public.newsletter_delivery_batches(newsletter_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_delivery_batches_parent
  ON public.newsletter_delivery_batches(parent_batch_id);

CREATE INDEX IF NOT EXISTS idx_delivery_recipients_batch
  ON public.newsletter_delivery_batch_recipients(batch_id);

CREATE INDEX IF NOT EXISTS idx_delivery_recipients_family
  ON public.newsletter_delivery_batch_recipients(family_id, created_at DESC);

ALTER TABLE public.newsletter_delivery_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.newsletter_delivery_batch_recipients ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'newsletter_delivery_batches'
      AND policyname = 'newsletter_delivery_batches_admin_read'
  ) THEN
    CREATE POLICY newsletter_delivery_batches_admin_read
      ON public.newsletter_delivery_batches
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
      AND tablename = 'newsletter_delivery_batches'
      AND policyname = 'newsletter_delivery_batches_admin_write'
  ) THEN
    CREATE POLICY newsletter_delivery_batches_admin_write
      ON public.newsletter_delivery_batches
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

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'newsletter_delivery_batch_recipients'
      AND policyname = 'newsletter_delivery_batch_recipients_admin_read'
  ) THEN
    CREATE POLICY newsletter_delivery_batch_recipients_admin_read
      ON public.newsletter_delivery_batch_recipients
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
      AND tablename = 'newsletter_delivery_batch_recipients'
      AND policyname = 'newsletter_delivery_batch_recipients_admin_write'
  ) THEN
    CREATE POLICY newsletter_delivery_batch_recipients_admin_write
      ON public.newsletter_delivery_batch_recipients
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

DROP TRIGGER IF EXISTS update_newsletter_delivery_batches_updated_at
  ON public.newsletter_delivery_batches;
CREATE TRIGGER update_newsletter_delivery_batches_updated_at
  BEFORE UPDATE ON public.newsletter_delivery_batches
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_newsletter_delivery_batch_recipients_updated_at
  ON public.newsletter_delivery_batch_recipients;
CREATE TRIGGER update_newsletter_delivery_batch_recipients_updated_at
  BEFORE UPDATE ON public.newsletter_delivery_batch_recipients
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
