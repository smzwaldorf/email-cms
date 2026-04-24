## Why

Today the parent newsletter email body is produced by a hard-coded TypeScript renderer (`src/services/newsletterEmailRenderer.ts`) that locks in the header, feature-card layout, weekly summary, About section, and footer. Admins can edit a single HTML body around it and a fixed token list, but cannot reorder layout sections, change per-article card presentation, or align the email to the existing Canva design (`善美真email Newsletter`) without engineering work. This blocks designers from iterating in Canva and admins from maintaining the structure that articles get merged into before sending through Kit.

## What Changes

- Add an ordered, typed **block list** (`blocks JSONB`) to `email_template_revisions`, alongside the existing `body_template`, so a template revision is `{ subject_template, blocks[], body_template }`.
- Define **eight block types** that mirror the Canva design: `header`, `shared-article-feature`, `class-article-feature`, `weekly-summary-list`, `about`, `footer`, `section-divider`, `custom-html`. Each block stores `type`, `order`, `visible`, `bodyHtml`, `config`.
- Replace `renderNewsletterContentHtml` invocation inside `composePersonalizedEmails` with a **block-walker renderer** that iterates `visible` blocks in `order`, expands repeater blocks (`shared-article-feature`, `class-article-feature`, `weekly-summary-list`) over the recipient's resolved articles, and returns final HTML used by preview, preparation, and delivery.
- Extend the token registry with a **per-article scope** valid only inside repeater blocks: `article.title`, `article.excerpt`, `article.url`, `article.image_url`, `class.id`, `class.code`, `class.name`. Existing top-level tokens remain unchanged.
- Update `validateEmailTemplate` so subject/body tokens stay in the global scope and per-block `bodyHtml` tokens are validated against the block type's allowed scope (block-aware validation).
- Migrate existing template revisions one-time into `blocks: [{ type: 'custom-html', order: 0, visible: true, bodyHtml: <existing body_template>, config: {} }]` so legacy revisions render identically through the new walker.
- Replace the single-body editor in `AdminEmailTemplateEditorPage.tsx` with a **block list UI** (drag-to-reorder, per-block TipTap or HTML editor, per-block config sidebar, visibility toggle).
- Extend `canvaEmailImport.ts` with a **section-aware import wizard** that maps the Canva design's eight visual sections to the eight block types, falling back to a single `custom-html` block when sections cannot be detected.
- Replace the fixture-based `NewsletterEmailPreviewPage.tsx` with an **"Apply for merge" preview** that picks a real newsletter + sample family, renders the personalized email through the block walker, and surfaces validation/preview warnings before the admin triggers `createPublishBatch`.
- Pin the full `blocks[]` snapshot inside the pinned `template_revision_id` so delivery batches stay deterministic; the existing fingerprint check in `kit-send-newsletter` continues to verify the rendered HTML server-side.

## Non-Goals (optional)

(none)

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `email-template-management`: template revisions add an ordered `blocks[]` structure and per-block validation; subject/body single-template behavior is preserved through a `custom-html` block.
- `personalized-email-workflow`: per-recipient HTML is produced by walking the pinned template `blocks[]` (with article and class repeaters) instead of calling a hard-coded renderer; pinning, fingerprinting, and merge logic for shared/class blocks remain intact.
- `canva-email-template-import`: import flow can map Canva-exported HTML into typed blocks (header / shared-article-feature / class-article-feature / weekly-summary-list / about / footer) and falls back to a single `custom-html` block when section markers are absent.

## Impact

- Affected specs: `email-template-management`, `personalized-email-workflow`, `canva-email-template-import`
- Affected code:
  - `supabase/migrations/<timestamp>_add_email_template_blocks.sql` (new) — adds `blocks JSONB` column on `email_template_revisions`, one-time backfill into `[{ type: 'custom-html', ... }]`.
  - `src/types/emailTemplate.ts` — add `EmailTemplateBlock`, `EmailBlockType`, extend `EmailTemplateRevision` with `blocks`.
  - `src/types/database.ts` — add `blocks` column on `EmailTemplateRevisionRow`.
  - `src/services/emailTemplateBlocks.ts` (new) — block registry: defaults, allowed tokens per block type, default `bodyHtml` per type.
  - `src/services/emailTemplateRenderer.ts` (new) — block-walker renderer used by composer.
  - `src/services/emailTemplateTokens.ts` — extend `EMAIL_TEMPLATE_TOKENS` with article/class scope tokens; add scope-aware `validateEmailTemplate(subjectTemplate, bodyTemplate, blocks)`.
  - `src/services/emailTemplateService.ts` — persist/read `blocks` on create/update/duplicate, return `blocks` from `getCurrentRevision`.
  - `src/services/personalizedEmailComposer.ts` — replace `renderNewsletterContentHtml` call with block-walker call; keep fingerprint computation unchanged.
  - `src/services/newsletterEmailRenderer.ts` — extract default block bodies into seed data consumed by `emailTemplateBlocks.ts`; keep file as the source of default `bodyHtml` strings for backward compatibility.
  - `src/services/canvaEmailImport.ts` — add section detection (`detectCanvaSections(html)`) returning a typed block list; existing normalization remains the fallback.
  - `src/components/admin/EmailTemplateBlockList.tsx` (new), `src/components/admin/EmailTemplateBlockEditor.tsx` (new), `src/components/admin/EmailTemplateBlockConfigPanel.tsx` (new) — block editor UI.
  - `src/pages/AdminEmailTemplateEditorPage.tsx` — replace single-body editor with block list + per-block editor; keep "Import HTML" but route output through the section-aware importer.
  - `src/pages/NewsletterEmailPreviewPage.tsx` — replace fixture with newsletter+family picker that renders via the block walker; add "Confirm and send" button that calls `newsletterDeliveryService.createPublishBatch`.
  - `supabase/functions/kit-send-newsletter/index.ts` — no behavior change; verifies fingerprint as today (assertion-only update if needed).
  - Tests: `tests/unit/services/emailTemplateTokens.test.ts`, `tests/unit/services/personalization/personalizedEmailComposer.test.ts`, `tests/integration/email-content-preparation-flow.test.ts`, `tests/unit/services/newsletterEmailRenderer.test.ts`, plus new `tests/unit/services/emailTemplateRenderer.test.ts` and `tests/components/admin/EmailTemplateBlockList.test.tsx`.
