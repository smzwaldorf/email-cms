BEGIN;
ALTER TABLE public.article_narration_parts
  ADD COLUMN IF NOT EXISTS audio_object_key text,
  ADD COLUMN IF NOT EXISTS audio_bucket text;
ALTER TABLE public.article_narration_parts
  ADD CONSTRAINT narration_r2_reference_complete CHECK (
    (audio_object_key IS NULL AND audio_bucket IS NULL) OR
    (audio_object_key IS NOT NULL AND audio_bucket IS NOT NULL AND audio IS NULL)
  );
COMMIT;
