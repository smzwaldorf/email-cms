-- Add short_id column to articles table
-- Feature: 005-short-urls

-- 1. Create a function to generate a random short ID (base62-like)
CREATE OR REPLACE FUNCTION generate_short_id()
RETURNS TEXT AS $$
DECLARE
  chars TEXT := '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
  result TEXT := '';
  i INTEGER;
BEGIN
  FOR i IN 1..6 LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::integer, 1);
  END LOOP;
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- 2. Add the column (nullable first to allow backfill)
ALTER TABLE public.articles ADD COLUMN IF NOT EXISTS short_id VARCHAR(10);

-- 3. Backfill existing articles with unique short_ids
DO $$
DECLARE
  r RECORD;
  new_short_id TEXT;
  done BOOLEAN;
BEGIN
  FOR r IN SELECT id FROM public.articles WHERE short_id IS NULL LOOP
    done := FALSE;
    WHILE NOT done LOOP
      new_short_id := generate_short_id();
      -- Check for collision (unlikely but possible)
      IF NOT EXISTS (SELECT 1 FROM public.articles WHERE short_id = new_short_id) THEN
        UPDATE public.articles SET short_id = new_short_id WHERE id = r.id;
        done := TRUE;
      END IF;
    END LOOP;
  END LOOP;
END $$;

-- 4. Make it required and unique
ALTER TABLE public.articles ALTER COLUMN short_id SET NOT NULL;
ALTER TABLE public.articles ADD CONSTRAINT articles_short_id_key UNIQUE (short_id);

-- 5. Create a trigger to automatically assign short_id on insert
CREATE OR REPLACE FUNCTION public.set_article_short_id()
RETURNS TRIGGER AS $$
DECLARE
  new_short_id TEXT;
  done BOOLEAN := FALSE;
BEGIN
  IF NEW.short_id IS NULL THEN
    WHILE NOT done LOOP
      new_short_id := generate_short_id();
      IF NOT EXISTS (SELECT 1 FROM public.articles WHERE short_id = new_short_id) THEN
        NEW.short_id := new_short_id;
        done := TRUE;
      END IF;
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_set_article_short_id
  BEFORE INSERT ON public.articles
  FOR EACH ROW
  EXECUTE FUNCTION public.set_article_short_id();

-- 6. Add index for fast lookup
CREATE INDEX idx_articles_short_id ON public.articles(short_id);
