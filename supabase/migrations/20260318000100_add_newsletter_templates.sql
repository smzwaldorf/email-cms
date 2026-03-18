-- Add template support to newsletters.
ALTER TABLE public.newsletters
ADD COLUMN IF NOT EXISTS is_template BOOLEAN NOT NULL DEFAULT FALSE;

-- Speed up admin template/newsletter listing filters.
CREATE INDEX IF NOT EXISTS idx_newsletters_is_template
  ON public.newsletters(is_template, release_date DESC);
