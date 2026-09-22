BEGIN;
CREATE TABLE IF NOT EXISTS public.resend_webhook_events (
  event_id text PRIMARY KEY,
  email_id text NOT NULL,
  event_type text NOT NULL,
  occurred_at timestamptz NOT NULL,
  payload jsonb NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_resend_webhook_email ON public.resend_webhook_events (email_id);
CREATE INDEX IF NOT EXISTS idx_delivery_recipients_provider_message
  ON public.newsletter_delivery_batch_recipients (provider_message_id)
  WHERE provider_message_id IS NOT NULL;
COMMIT;
