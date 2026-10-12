BEGIN;
CREATE TABLE IF NOT EXISTS public.article_narration_imports (
  article_id uuid PRIMARY KEY REFERENCES public.articles(id) ON DELETE CASCADE,
  request_id uuid NOT NULL UNIQUE,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.article_narration_parts (
  article_id uuid NOT NULL REFERENCES public.articles(id) ON DELETE CASCADE,
  part_index integer NOT NULL CHECK (part_index >= 0 AND part_index < 40),
  transcript text NOT NULL CHECK (char_length(transcript) BETWEEN 1 AND 600),
  audio bytea CHECK (octet_length(audio) BETWEEN 1 AND 2097152),
  generating_at timestamptz,
  lease_id uuid,
  PRIMARY KEY (article_id, part_index)
);
COMMIT;
