BEGIN;

ALTER TABLE public.media_files ADD COLUMN IF NOT EXISTS storage_bucket text;
ALTER TABLE public.media_files ADD COLUMN IF NOT EXISTS storage_environment text;
ALTER TABLE public.media_files ADD COLUMN IF NOT EXISTS content_hash text;
CREATE UNIQUE INDEX IF NOT EXISTS idx_media_files_r2_object
  ON public.media_files(storage_bucket, storage_path) WHERE storage_bucket IS NOT NULL;

-- Article content is authoritative. This covers editor saves, imports, copies and restores
-- in the same transaction as the article write, regardless of which API writes it.
CREATE OR REPLACE FUNCTION public.sync_article_media_from_content() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  paths text[];
  desired uuid[];
  missing_path text;
BEGIN
  IF TG_OP = 'DELETE' THEN
    UPDATE public.media_usage SET active = false, deactivated_at = now(), updated_at = now()
      WHERE target_type = 'article' AND target_id = OLD.id AND active;
    RETURN OLD;
  END IF;

  SELECT coalesce(array_agg(path ORDER BY first_position), '{}'::text[]) INTO paths
    FROM (
      SELECT rtrim(token[1], ')') AS path, min(ordinal) AS first_position
        FROM regexp_matches(NEW.content, 'storage://media/([^"''<>[:space:]\\]+)', 'g') WITH ORDINALITY AS matches(token, ordinal)
        GROUP BY rtrim(token[1], ')')
    ) extracted;

  IF NEW.deleted_at IS NOT NULL THEN
    desired := '{}'::uuid[];
  ELSE
    SELECT path INTO missing_path FROM unnest(paths) AS path
      WHERE NOT EXISTS (SELECT 1 FROM public.media_files m WHERE m.storage_path = path) LIMIT 1;
    IF missing_path IS NOT NULL THEN
      RAISE EXCEPTION 'Article references an unregistered media object: %', missing_path USING ERRCODE = '23503';
    END IF;
    SELECT coalesce(array_agg(id ORDER BY id), '{}'::uuid[]) INTO desired
      FROM public.media_files WHERE storage_path = ANY(paths);
  END IF;

  DELETE FROM public.article_media_references
    WHERE article_id = NEW.id AND NOT (media_id = ANY(desired));

  INSERT INTO public.article_media_references(article_id, media_id, reference_type, position)
    SELECT NEW.id, m.id, 'inline', array_position(paths, m.storage_path) - 1
      FROM public.media_files m WHERE m.id = ANY(desired)
    ON CONFLICT (article_id, media_id) DO UPDATE SET position = EXCLUDED.position;

  UPDATE public.media_usage SET active = false, deactivated_at = now(), updated_at = now()
    WHERE target_type = 'article' AND target_id = NEW.id AND active AND NOT (media_id = ANY(desired));

  INSERT INTO public.media_usage(media_id, target_type, target_id, context_key, active, created_by)
    SELECT media_id, 'article', NEW.id, 'article_media:' || media_id::text, true, NEW.last_edited_by
      FROM unnest(desired) AS media_id
    ON CONFLICT (media_id, target_type, target_id, context_key)
      DO UPDATE SET active = true, deactivated_at = NULL, updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_sync_article_media_content ON public.articles;
CREATE TRIGGER trigger_sync_article_media_content
  AFTER INSERT OR UPDATE OF content, deleted_at ON public.articles
  FOR EACH ROW EXECUTE FUNCTION public.sync_article_media_from_content();
DROP TRIGGER IF EXISTS trigger_deactivate_deleted_article_media ON public.articles;
CREATE TRIGGER trigger_deactivate_deleted_article_media AFTER DELETE ON public.articles
  FOR EACH ROW EXECUTE FUNCTION public.sync_article_media_from_content();

COMMIT;
