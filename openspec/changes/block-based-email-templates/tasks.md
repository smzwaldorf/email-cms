## 1. Schema and types

- [x] 1.1 Implement design Decision: Store blocks as a JSONB column on `email_template_revisions` — create `supabase/migrations/<timestamp>_add_email_template_blocks.sql` adding `blocks JSONB NOT NULL DEFAULT '[]'::jsonb` to `email_template_revisions`, and execute design Decision: One-time backfill of legacy revisions into a single `custom-html` block by populating each existing row's `blocks` with one block whose `bodyHtml` is the existing `body_template`.
- [x] 1.2 Define `EmailTemplateBlock` and `EmailBlockType` in `src/types/emailTemplate.ts` and extend `EmailTemplateRevision` plus `EmailTemplateRevisionRow` in `src/types/database.ts` so Template revisions persist an ordered list of typed blocks (`type`, `order`, `visible`, `bodyHtml`, `config`) end-to-end.
- [x] 1.3 Implement `src/services/emailTemplateBlocks.ts` as the registry that delivers design Decision: Eight block types matching the Canva design — `header`, `shared-article-feature`, `class-article-feature`, `weekly-summary-list`, `section-divider`, `about`, `footer`, `custom-html` — exposing per-type default `bodyHtml`, default `config`, and the inner-scope token allow-list.

## 2. Validator and block-walker renderer

- [x] 2.1 Extend `validateEmailTemplate` in `src/services/emailTemplateTokens.ts` to apply design Decision: Per-block token scopes with block-aware validation so the requirement System validates template tokens before save holds: subject validates against the global scope, each block's `bodyHtml` validates against `global ∪ blockType.allowedScopeTokens`.
- [x] 2.2 Create `src/services/emailTemplateRenderer.ts` implementing design Decision: Block-walker renderer replaces `renderNewsletterContentHtml` in the composer — sort by `order`, skip `visible: false`, dispatch by block `type`, and expand the three repeater blocks; this delivers the requirement System renders per-recipient HTML by walking the pinned template's block list.
- [x] 2.3 Wire `src/services/personalizedEmailComposer.ts` to call the block-walker when the pinned revision's block list is non-empty and to fall back to the legacy single-body render path when it is empty, ensuring Block-based renders preserve composition determinism and fingerprinting (existing fingerprint computation unchanged).

## 3. Service persistence and preview

- [x] 3.1 Update `src/services/emailTemplateService.ts` (`createTemplate`, `updateTemplateRevision`, `duplicateTemplate`, `getCurrentRevision`, `getRevisionById`) to read and write the `blocks` column so callers receive the full block list whenever a revision is created, copied, or loaded — completing the storage half of Template revisions persist an ordered list of typed blocks.
- [x] 3.2 Update `previewRevision` so the System provides deterministic template preview by routing preview through the block walker: render static blocks once with global tokens, expand repeater blocks over sample articles/classes, and surface unresolved-token warnings per block field.

## 4. Canva import detection

- [x] 4.1 Implement `detectCanvaSections(html)` in `src/services/canvaEmailImport.ts` per design Decision: Canva import maps detected sections to typed blocks, falls back to `custom-html`, satisfying the requirement Canva import detects layout sections and maps them to typed template blocks via marker comments first, then heading patterns (`SMZ School News`, `Regarding school`, `Class news & events`, `The weekly news` / `本週重要事情佈達`, `About us` / `認識 善美真`, footer with `TEL` + `FAX`).
- [x] 4.2 Integrate `detectCanvaSections` into the import flow on `src/pages/AdminEmailTemplateEditorPage.tsx` so an Admin can import Canva-authored HTML into an email template revision that produces a typed block list when three or more sections are detected and a single `custom-html` block otherwise, while ensuring the System preserves accepted imported markup for downstream reuse (per-block `bodyHtml` stored exactly as detected and normalized).

## 5. Admin block editor UI

- [x] 5.1 Build `src/components/admin/EmailTemplateBlockList.tsx`, `EmailTemplateBlockEditor.tsx`, and `EmailTemplateBlockConfigPanel.tsx` to deliver design Decision: Block list UI uses the existing TipTap editor per block, with up/down reorder in v1 and to satisfy the requirement Admin can edit, reorder, and toggle visibility of template blocks (visibility toggle, up/down arrows, per-block TipTap/HTML toggle reusing `SimpleEditor`, per-block config form).
- [x] 5.2 Replace the single-body editor in `src/pages/AdminEmailTemplateEditorPage.tsx` with the new block list components, defaulting to the block view when the loaded revision has a non-empty block list and showing a "Convert to blocks" action on legacy `custom-html` single-block revisions.

## 6. Apply-for-merge preview

- [x] 6.1 Rewrite `src/pages/NewsletterEmailPreviewPage.tsx` to deliver design Decision: "Apply for merge" preview replaces the fixture-based preview page — newsletter picker, sample-family picker, dry-run invocation of `composePersonalizedEmails` against the chosen template's block list, inline render of the resulting per-recipient HTML, and a list of `PreparationFinding` and `PersonalizationWarning` items.
- [x] 6.2 Add a "Confirm and publish" action on the rewritten preview that calls `newsletterDeliveryService.createPublishBatch` for the selected newsletter only after the admin approves the rendered output.

## 7. Tests

- [x] 7.1 Add `tests/unit/services/emailTemplateRenderer.test.ts` covering static block rendering, repeater expansion for `shared-article-feature`, `class-article-feature`, and `weekly-summary-list`, `visible: false` skip, and the empty-blocks fallback to the legacy single-body path.
- [x] 7.2 Add a fingerprint regression test in `tests/unit/services/personalization/personalizedEmailComposer.test.ts` asserting that the walker output for a single `custom-html` block produced by design Decision: One-time backfill of legacy revisions into a single `custom-html` block matches the legacy renderer output byte-for-byte for a representative fixture; update `tests/unit/services/emailTemplateTokens.test.ts` to cover block-aware validation accept/reject cases; update `tests/integration/email-content-preparation-flow.test.ts` to cover the apply-for-merge composition path; add `tests/components/admin/EmailTemplateBlockList.test.tsx` covering reorder, visibility toggle, and per-block edit save.
