-- ============================================================================
-- Migration: Add article taxonomy management (categories/tags)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.article_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deactivated_at TIMESTAMPTZ,
  CONSTRAINT article_categories_name_not_blank CHECK (BTRIM(name) <> '')
);

CREATE TABLE IF NOT EXISTS public.article_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deactivated_at TIMESTAMPTZ,
  CONSTRAINT article_tags_name_not_blank CHECK (BTRIM(name) <> '')
);

CREATE TABLE IF NOT EXISTS public.article_category_assignments (
  article_id UUID NOT NULL REFERENCES public.articles(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES public.article_categories(id) ON DELETE RESTRICT,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (article_id, category_id)
);

CREATE TABLE IF NOT EXISTS public.article_tag_assignments (
  article_id UUID NOT NULL REFERENCES public.articles(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES public.article_tags(id) ON DELETE RESTRICT,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (article_id, tag_id)
);

CREATE OR REPLACE FUNCTION public.update_article_taxonomy_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_article_categories_updated_at ON public.article_categories;
CREATE TRIGGER trigger_article_categories_updated_at
  BEFORE UPDATE ON public.article_categories
  FOR EACH ROW
  EXECUTE FUNCTION public.update_article_taxonomy_updated_at();

DROP TRIGGER IF EXISTS trigger_article_tags_updated_at ON public.article_tags;
CREATE TRIGGER trigger_article_tags_updated_at
  BEFORE UPDATE ON public.article_tags
  FOR EACH ROW
  EXECUTE FUNCTION public.update_article_taxonomy_updated_at();

CREATE OR REPLACE FUNCTION public.sync_article_taxonomy_lifecycle_timestamps()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_active = false AND (OLD.is_active IS DISTINCT FROM NEW.is_active) THEN
    NEW.deactivated_at := COALESCE(NEW.deactivated_at, NOW());
  ELSIF NEW.is_active = true AND (OLD.is_active IS DISTINCT FROM NEW.is_active) THEN
    NEW.deactivated_at := NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_article_categories_lifecycle_timestamps ON public.article_categories;
CREATE TRIGGER trigger_article_categories_lifecycle_timestamps
  BEFORE UPDATE ON public.article_categories
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_article_taxonomy_lifecycle_timestamps();

DROP TRIGGER IF EXISTS trigger_article_tags_lifecycle_timestamps ON public.article_tags;
CREATE TRIGGER trigger_article_tags_lifecycle_timestamps
  BEFORE UPDATE ON public.article_tags
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_article_taxonomy_lifecycle_timestamps();

DROP INDEX IF EXISTS idx_article_categories_active_name_unique;
CREATE UNIQUE INDEX idx_article_categories_active_name_unique
  ON public.article_categories (LOWER(name))
  WHERE is_active = true;

DROP INDEX IF EXISTS idx_article_tags_active_name_unique;
CREATE UNIQUE INDEX idx_article_tags_active_name_unique
  ON public.article_tags (LOWER(name))
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_article_category_assignments_article
  ON public.article_category_assignments (article_id);

CREATE INDEX IF NOT EXISTS idx_article_category_assignments_category
  ON public.article_category_assignments (category_id);

CREATE INDEX IF NOT EXISTS idx_article_tag_assignments_article
  ON public.article_tag_assignments (article_id);

CREATE INDEX IF NOT EXISTS idx_article_tag_assignments_tag
  ON public.article_tag_assignments (tag_id);

ALTER TABLE public.article_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.article_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.article_category_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.article_tag_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS article_categories_admin_read ON public.article_categories;
CREATE POLICY article_categories_admin_read
  ON public.article_categories FOR SELECT
  USING (
    auth.uid() IN (
      SELECT id FROM public.user_roles WHERE role = 'admin'
    )
  );

DROP POLICY IF EXISTS article_categories_admin_write_all ON public.article_categories;
CREATE POLICY article_categories_admin_write_all
  ON public.article_categories FOR ALL
  USING (
    auth.uid() IN (
      SELECT id FROM public.user_roles WHERE role = 'admin'
    )
  )
  WITH CHECK (
    auth.uid() IN (
      SELECT id FROM public.user_roles WHERE role = 'admin'
    )
  );

DROP POLICY IF EXISTS article_tags_admin_read ON public.article_tags;
CREATE POLICY article_tags_admin_read
  ON public.article_tags FOR SELECT
  USING (
    auth.uid() IN (
      SELECT id FROM public.user_roles WHERE role = 'admin'
    )
  );

DROP POLICY IF EXISTS article_tags_admin_write_all ON public.article_tags;
CREATE POLICY article_tags_admin_write_all
  ON public.article_tags FOR ALL
  USING (
    auth.uid() IN (
      SELECT id FROM public.user_roles WHERE role = 'admin'
    )
  )
  WITH CHECK (
    auth.uid() IN (
      SELECT id FROM public.user_roles WHERE role = 'admin'
    )
  );

DROP POLICY IF EXISTS article_category_assignments_admin_read ON public.article_category_assignments;
CREATE POLICY article_category_assignments_admin_read
  ON public.article_category_assignments FOR SELECT
  USING (
    auth.uid() IN (
      SELECT id FROM public.user_roles WHERE role = 'admin'
    )
  );

DROP POLICY IF EXISTS article_category_assignments_admin_write_all ON public.article_category_assignments;
CREATE POLICY article_category_assignments_admin_write_all
  ON public.article_category_assignments FOR ALL
  USING (
    auth.uid() IN (
      SELECT id FROM public.user_roles WHERE role = 'admin'
    )
  )
  WITH CHECK (
    auth.uid() IN (
      SELECT id FROM public.user_roles WHERE role = 'admin'
    )
  );

DROP POLICY IF EXISTS article_tag_assignments_admin_read ON public.article_tag_assignments;
CREATE POLICY article_tag_assignments_admin_read
  ON public.article_tag_assignments FOR SELECT
  USING (
    auth.uid() IN (
      SELECT id FROM public.user_roles WHERE role = 'admin'
    )
  );

DROP POLICY IF EXISTS article_tag_assignments_admin_write_all ON public.article_tag_assignments;
CREATE POLICY article_tag_assignments_admin_write_all
  ON public.article_tag_assignments FOR ALL
  USING (
    auth.uid() IN (
      SELECT id FROM public.user_roles WHERE role = 'admin'
    )
  )
  WITH CHECK (
    auth.uid() IN (
      SELECT id FROM public.user_roles WHERE role = 'admin'
    )
  );
