-- ============================================================================
-- Migration: Add Newsletter-Articles Junction Table
-- Purpose: Enable many-to-many relationship between articles and newsletters
-- This allows the same article to be added to different newsletters
-- ============================================================================

-- ============================================================================
-- Step 1: Create Junction Table
-- ============================================================================

CREATE TABLE public.newsletter_articles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  newsletter_id UUID NOT NULL REFERENCES public.newsletters(id) ON DELETE CASCADE,
  article_id UUID NOT NULL REFERENCES public.articles(id) ON DELETE CASCADE,
  article_order INTEGER NOT NULL,  -- Position within this specific newsletter
  added_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  added_by UUID REFERENCES public.user_roles(id),  -- User who added this article to the newsletter
  
  -- Ensure each article can only be in each newsletter once
  CONSTRAINT unique_article_per_newsletter UNIQUE (newsletter_id, article_id),
  -- Ensure unique order position per newsletter
  CONSTRAINT unique_order_per_newsletter UNIQUE (newsletter_id, article_order)
);

-- Add comment for documentation
COMMENT ON TABLE public.newsletter_articles IS 'Junction table enabling many-to-many relationship between newsletters and articles. Allows the same article to appear in multiple newsletters with different order positions.';
COMMENT ON COLUMN public.newsletter_articles.article_order IS 'Position of the article within this specific newsletter (1-based)';

-- ============================================================================
-- Step 2: Create Indexes for Performance
-- ============================================================================

-- Index for filtering by newsletter
CREATE INDEX idx_newsletter_articles_newsletter 
  ON public.newsletter_articles(newsletter_id);

-- Index for finding all newsletters containing an article
CREATE INDEX idx_newsletter_articles_article 
  ON public.newsletter_articles(article_id);

-- Index for ordering articles within a newsletter
CREATE INDEX idx_newsletter_articles_order 
  ON public.newsletter_articles(newsletter_id, article_order);

-- ============================================================================
-- Step 3: Enable Row Level Security
-- ============================================================================

ALTER TABLE public.newsletter_articles ENABLE ROW LEVEL SECURITY;

-- Public can read newsletter article associations for published newsletters
CREATE POLICY newsletter_articles_public_read 
  ON public.newsletter_articles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.newsletters n
      WHERE n.id = newsletter_id AND n.status = 'published'
    )
  );

-- Admins can read all newsletter article associations
CREATE POLICY newsletter_articles_admin_read 
  ON public.newsletter_articles FOR SELECT
  USING (
    auth.uid() IN (SELECT id FROM public.user_roles WHERE role = 'admin')
  );

-- Teachers can read all newsletter article associations (for content they authored)
CREATE POLICY newsletter_articles_teacher_read 
  ON public.newsletter_articles FOR SELECT
  USING (
    auth.uid() IN (SELECT id FROM public.user_roles WHERE role = 'teacher')
  );

-- Admins can insert newsletter article associations
CREATE POLICY newsletter_articles_admin_insert 
  ON public.newsletter_articles FOR INSERT
  WITH CHECK (
    auth.uid() IN (SELECT id FROM public.user_roles WHERE role = 'admin')
  );

-- Admins can update newsletter article associations
CREATE POLICY newsletter_articles_admin_update 
  ON public.newsletter_articles FOR UPDATE
  USING (
    auth.uid() IN (SELECT id FROM public.user_roles WHERE role = 'admin')
  );

-- Admins can delete newsletter article associations
CREATE POLICY newsletter_articles_admin_delete 
  ON public.newsletter_articles FOR DELETE
  USING (
    auth.uid() IN (SELECT id FROM public.user_roles WHERE role = 'admin')
  );

-- ============================================================================
-- Step 4: Create Helper Function for Getting Article Newsletters
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_article_newsletters(p_article_id UUID)
RETURNS TABLE (
  newsletter_id UUID,
  article_order INTEGER,
  week_number VARCHAR(10),
  title TEXT,
  release_date DATE,
  status VARCHAR(20)
)
LANGUAGE sql
STABLE
AS $$
  SELECT 
    na.newsletter_id,
    na.article_order,
    n.week_number,
    n.title,
    n.release_date,
    n.status
  FROM public.newsletter_articles na
  JOIN public.newsletters n ON n.id = na.newsletter_id
  WHERE na.article_id = p_article_id
  ORDER BY n.release_date DESC;
$$;

COMMENT ON FUNCTION public.get_article_newsletters IS 'Returns all newsletters that contain a specific article, ordered by release date descending';

-- ============================================================================
-- Step 5: Create Helper Function for Getting Newsletter Articles
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_newsletter_articles(p_newsletter_id UUID)
RETURNS TABLE (
  article_id UUID,
  article_order INTEGER,
  title TEXT,
  content TEXT,
  author_id UUID,
  status VARCHAR(20),
  created_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE sql
STABLE
AS $$
  SELECT 
    a.id,
    na.article_order,
    a.title,
    a.content,
    a.author_id,
    a.status,
    a.created_at
  FROM public.newsletter_articles na
  JOIN public.articles a ON a.id = na.article_id
  WHERE na.newsletter_id = p_newsletter_id
    AND a.deleted_at IS NULL
  ORDER BY na.article_order ASC;
$$;

COMMENT ON FUNCTION public.get_newsletter_articles IS 'Returns all articles in a newsletter ordered by their position';
