-- ============================================================================
-- Add compatibility columns expected by current article services
-- Version: 1.0.0
-- Purpose: Keep fresh environments compatible with article/admin write paths
-- while newsletter/article junction refactors are still being phased through
-- the application layer.
-- ============================================================================

ALTER TABLE public.articles
  ADD COLUMN IF NOT EXISTS week_number VARCHAR(10) REFERENCES public.newsletters(week_number) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS author TEXT,
  ADD COLUMN IF NOT EXISTS summary TEXT,
  ADD COLUMN IF NOT EXISTS article_order INTEGER,
  ADD COLUMN IF NOT EXISTS class_ids TEXT[],
  ADD COLUMN IF NOT EXISTS family_ids UUID[],
  ADD COLUMN IF NOT EXISTS published_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS edited_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS last_edited_by UUID REFERENCES public.user_roles(id);

COMMENT ON COLUMN public.articles.week_number IS
  'Legacy compatibility column retained for services still resolving newsletters by ISO week number.';

COMMENT ON COLUMN public.articles.article_order IS
  'Legacy compatibility column retained for services still reading or writing per-newsletter order directly on articles.';
