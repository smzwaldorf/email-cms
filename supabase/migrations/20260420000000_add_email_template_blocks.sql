-- ============================================================================
-- Migration: Add ordered typed-block column to email_template_revisions
-- ----------------------------------------------------------------------------
-- Adds a `blocks` JSONB column that stores the ordered list of typed
-- EmailTemplateBlock records for each revision. Backfills every existing
-- revision with a single `custom-html` block whose `bodyHtml` is the existing
-- `body_template`, preserving byte-for-byte render output for any legacy
-- revision that has never been re-saved through the block editor.
-- ============================================================================

ALTER TABLE public.email_template_revisions
  ADD COLUMN IF NOT EXISTS blocks JSONB NOT NULL DEFAULT '[]'::jsonb;

UPDATE public.email_template_revisions
SET blocks = jsonb_build_array(
  jsonb_build_object(
    'type', 'custom-html',
    'order', 0,
    'visible', true,
    'bodyHtml', COALESCE(body_template, ''),
    'config', '{}'::jsonb
  )
)
WHERE blocks IS NULL
   OR jsonb_typeof(blocks) <> 'array'
   OR jsonb_array_length(blocks) = 0;

CREATE INDEX IF NOT EXISTS idx_email_template_revisions_blocks_gin
  ON public.email_template_revisions USING GIN (blocks);
