-- Align delivery recipient persistence with confirmed workflow contract.

ALTER TABLE public.newsletter_delivery_batch_recipients
  ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES public.user_roles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS parent_email TEXT,
  ADD COLUMN IF NOT EXISTS journey_correlation_id TEXT,
  ADD COLUMN IF NOT EXISTS preparation_findings JSONB NOT NULL DEFAULT '[]'::JSONB;

UPDATE public.newsletter_delivery_batch_recipients
SET journey_correlation_id = COALESCE(journey_correlation_id, ('journey-' || gen_random_uuid()::text))
WHERE journey_correlation_id IS NULL;

ALTER TABLE public.newsletter_delivery_batch_recipients
  ALTER COLUMN journey_correlation_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_delivery_recipients_journey_correlation
  ON public.newsletter_delivery_batch_recipients(journey_correlation_id);
