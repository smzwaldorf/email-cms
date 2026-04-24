-- ============================================================================
-- Migration: enforce a single "active" email template as the publishing default
--
-- Before this migration, every saved template was hard-coded to state='active'
-- and `newsletterDeliveryService.resolveActiveTemplate()` picked whichever one
-- was updated most recently. After this migration:
--   * At most one template is `active` at a time (DB-enforced).
--   * Newly created templates start in `draft`.
--   * Admins promote a template by calling
--     `emailTemplateService.setActiveTemplate(id)`.
--
-- Backfill: keep the existing behavior on first run by picking the
-- most-recently-updated `active` template (with a saved revision) as the
-- singleton, demoting any other actives to `inactive`.
-- ============================================================================

DO $$
DECLARE
  keep_id UUID;
BEGIN
  SELECT id
    INTO keep_id
    FROM public.email_templates
   WHERE state = 'active'
     AND current_revision_id IS NOT NULL
   ORDER BY updated_at DESC
   LIMIT 1;

  IF keep_id IS NOT NULL THEN
    UPDATE public.email_templates
       SET state = 'inactive'
     WHERE state = 'active'
       AND id <> keep_id;
  ELSE
    -- No active template with a revision: demote any leftover actives so the
    -- new partial unique index applies cleanly. Admins will promote one
    -- explicitly through the UI.
    UPDATE public.email_templates
       SET state = 'inactive'
     WHERE state = 'active';
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS email_templates_single_active_idx
  ON public.email_templates ((state))
  WHERE state = 'active';
