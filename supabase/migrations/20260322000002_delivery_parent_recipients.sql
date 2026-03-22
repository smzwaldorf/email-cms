-- Shift newsletter delivery recipients from family-email to parent/guardian recipients.

ALTER TABLE public.newsletter_delivery_batch_recipients
  ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES public.user_roles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS parent_email TEXT;

-- Replace prior uniqueness (one row per family) with parent-aware uniqueness.
ALTER TABLE public.newsletter_delivery_batch_recipients
  DROP CONSTRAINT IF EXISTS newsletter_delivery_batch_recipients_batch_id_family_id_key;

CREATE INDEX IF NOT EXISTS idx_delivery_recipients_batch_parent_email
  ON public.newsletter_delivery_batch_recipients(batch_id, COALESCE(parent_id::TEXT, ''), COALESCE(parent_email, ''));
