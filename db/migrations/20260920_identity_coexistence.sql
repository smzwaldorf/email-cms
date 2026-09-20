-- Add the CMS-owned reference and preference tables without retiring the
-- legacy identity masters. Retirement remains a separate, explicitly approved
-- migration with a verified backup requirement.
CREATE TABLE IF NOT EXISTS public.identity_reference_mappings (
  entity_type text NOT NULL CHECK (entity_type IN ('person','family','class','student')),
  legacy_id text NOT NULL,
  auth_id uuid,
  PRIMARY KEY (entity_type, legacy_id)
);

CREATE TABLE IF NOT EXISTS public.newsletter_family_preferences (
  family_id uuid PRIMARY KEY,
  auth_family_id uuid UNIQUE,
  newsletter_subscription_status public.newsletter_subscription_status NOT NULL DEFAULT 'subscribed',
  newsletter_subscription_source text,
  newsletter_subscription_updated_at timestamptz,
  newsletter_subscribed_at timestamptz,
  newsletter_unsubscribed_at timestamptz,
  related_topics jsonb NOT NULL DEFAULT '[]'::jsonb
);

COMMENT ON TABLE public.newsletter_family_preferences IS 'CMS newsletter preferences only; family identity and membership are owned by Auth.';
COMMENT ON TABLE public.identity_reference_mappings IS 'Identifier-only aliases for legacy CMS references; no directory profiles or authority.';
