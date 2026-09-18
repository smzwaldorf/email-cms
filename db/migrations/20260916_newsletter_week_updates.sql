-- Keep the legacy article week reference synchronized when a draft is rescheduled.
-- newsletter_articles continues to own article membership by immutable newsletter ID.
BEGIN;
ALTER TABLE public.articles DROP CONSTRAINT IF EXISTS articles_week_number_fkey;
ALTER TABLE public.articles ADD CONSTRAINT articles_week_number_fkey
  FOREIGN KEY (week_number) REFERENCES public.newsletters(week_number)
  ON UPDATE CASCADE ON DELETE CASCADE;
COMMIT;
