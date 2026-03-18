-- ============================================================================
-- Migration: Add class targeting metadata for newsletter_articles
-- Purpose: Support shared vs targeted class delivery per newsletter article link
-- ============================================================================

ALTER TABLE public.newsletter_articles
ADD COLUMN IF NOT EXISTS targeting_mode TEXT NOT NULL DEFAULT 'shared',
ADD COLUMN IF NOT EXISTS target_class_ids TEXT[] NOT NULL DEFAULT '{}';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'newsletter_articles_targeting_mode_check'
  ) THEN
    ALTER TABLE public.newsletter_articles
    ADD CONSTRAINT newsletter_articles_targeting_mode_check
    CHECK (targeting_mode IN ('shared', 'targeted'));
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'newsletter_articles_targeting_consistency_check'
  ) THEN
    ALTER TABLE public.newsletter_articles
    ADD CONSTRAINT newsletter_articles_targeting_consistency_check
    CHECK (
      (targeting_mode = 'shared' AND cardinality(target_class_ids) = 0)
      OR (targeting_mode = 'targeted' AND cardinality(target_class_ids) > 0)
    );
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_newsletter_articles_targeting_mode
  ON public.newsletter_articles (newsletter_id, targeting_mode);

CREATE INDEX IF NOT EXISTS idx_newsletter_articles_target_class_ids
  ON public.newsletter_articles USING GIN (target_class_ids);
