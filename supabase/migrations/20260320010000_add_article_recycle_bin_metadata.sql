-- ============================================================================
-- Migration: Add article recycle-bin metadata
-- Purpose: Track who deleted content and when it is scheduled for purge
-- ============================================================================

ALTER TABLE public.articles
  ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES public.user_roles(id),
  ADD COLUMN IF NOT EXISTS purge_scheduled_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_articles_recycle_bin_schedule
  ON public.articles (deleted_at DESC, purge_scheduled_at ASC)
  WHERE deleted_at IS NOT NULL;
