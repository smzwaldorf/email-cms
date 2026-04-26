-- Newsletter-scoped Kit merge property sync state.

ALTER TABLE public.newsletter_delivery_batch_recipients
  ADD COLUMN IF NOT EXISTS kit_merge_sync_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (kit_merge_sync_status IN ('pending', 'skipped', 'syncing', 'synced', 'failed', 'drifted')),
  ADD COLUMN IF NOT EXISTS kit_merge_payload JSONB,
  ADD COLUMN IF NOT EXISTS kit_merge_payload_fingerprint TEXT,
  ADD COLUMN IF NOT EXISTS kit_merge_provider_field_ids JSONB NOT NULL DEFAULT '{}'::JSONB,
  ADD COLUMN IF NOT EXISTS kit_merge_last_synced_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS kit_merge_provider_error TEXT,
  ADD COLUMN IF NOT EXISTS campaign_ready BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.email_platform_sync_jobs
  DROP CONSTRAINT IF EXISTS email_platform_sync_jobs_job_type_check;

ALTER TABLE public.email_platform_sync_jobs
  ADD CONSTRAINT email_platform_sync_jobs_job_type_check
  CHECK (job_type IN (
    'upsert_subscriber',
    'reconcile_subscriber',
    'sync_newsletter_merge_properties'
  ));

CREATE INDEX IF NOT EXISTS idx_delivery_recipients_kit_merge_status
  ON public.newsletter_delivery_batch_recipients(batch_id, kit_merge_sync_status, campaign_ready);

CREATE INDEX IF NOT EXISTS idx_delivery_recipients_kit_merge_fingerprint
  ON public.newsletter_delivery_batch_recipients(batch_id, kit_merge_payload_fingerprint)
  WHERE kit_merge_payload_fingerprint IS NOT NULL;

