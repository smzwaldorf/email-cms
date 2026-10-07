BEGIN;
-- A normal 600-character Mandarin narration can exceed the original 2 MiB cap.
-- Widen the bounded storage limit without changing transcripts or completed audio.
ALTER TABLE public.article_narration_parts
  DROP CONSTRAINT IF EXISTS article_narration_parts_audio_check;
ALTER TABLE public.article_narration_parts
  ADD CONSTRAINT article_narration_parts_audio_check
  CHECK (octet_length(audio) BETWEEN 1 AND 8388608);
COMMIT;
