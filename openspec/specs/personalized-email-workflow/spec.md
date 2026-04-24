# personalized-email-workflow Specification

## Purpose

Guardian-facing newsletters are composed from shared and class-targeted content blocks. The system merges eligible class sections per guardian (including multi-child households), deduplicates consistently, and renders deterministically from a single membership snapshot.

## Requirements

### Requirement: System composes personalized email content from shared and class-targeted blocks
The system SHALL build each guardian email from a combination of newsletter shared content blocks and class-targeted content blocks selected from the guardian's eligible class set.

#### Scenario: Single-child guardian receives shared and class content
- **WHEN** a guardian has one child enrolled in class `A` and newsletter `N` contains shared blocks plus class `A` blocks
- **THEN** the system SHALL compose one personalized email payload containing all shared blocks and class `A` blocks in canonical section order

#### Scenario: Guardian with no eligible class blocks still receives shared content
- **WHEN** a guardian is eligible for newsletter `N` but has no matching class-targeted blocks for that issue
- **THEN** the system SHALL still compose a valid payload containing shared blocks and deterministic class-section fallback behavior

---
### Requirement: System merges multi-child class content into one deterministic email per guardian
The system SHALL produce exactly one personalized email per guardian and merge all eligible class-targeted content for that guardian's children without duplicate block rendering.

#### Scenario: Multi-child guardian receives one merged email
- **WHEN** a guardian has children in classes `A` and `B` for newsletter `N`
- **THEN** the system SHALL generate one payload for that guardian that includes class `A` and class `B` content using deterministic class ordering

#### Scenario: Duplicate blocks are deduplicated by stable personalization key
- **WHEN** two eligible class sections reference blocks with the same personalization key
- **THEN** the system SHALL render that block once in the merged payload according to canonical ordering rules

---
### Requirement: Personalization output is deterministic for identical inputs
The system SHALL produce identical personalization output for repeated renders when newsletter revision, recipient identity, class membership snapshot, template revision, and rules version are unchanged, and SHALL expose readiness status per recipient for delivery handoff decisions.

#### Scenario: Repeated renders with same inputs are identical
- **WHEN** the system renders payloads twice for the same guardian using the same newsletter revision, class membership snapshot, template revision, and rules version
- **THEN** both payloads SHALL match exactly in block order, content selection, and personalization metadata.

#### Scenario: Rules version change is explicit in output metadata
- **WHEN** personalization logic changes to a new rules version
- **THEN** the system SHALL include the new rules version identifier in each generated payload.

#### Scenario: Non-ready recipients are excluded from delivery handoff input
- **WHEN** personalization/validation marks a recipient as warning or failed for the current policy
- **THEN** the system SHALL mark that recipient as non-ready in preparation output and SHALL NOT include that payload in ready delivery handoff input.


<!-- @trace
source: confirm-workflow-blueprint
updated: 2026-04-09
code:
  - src/components/admin/FamilyList.tsx
  - README.md
  - src/context/AuthContext.tsx
  - src/pages/FamilyManagementPage.tsx
  - src/types/database.ts
  - vite.config.ts
  - supabase/functions/tracking-click/index.ts
  - src/services/adminService.ts
  - src/types/emailDelivery.ts
  - src/services/emailContentPreparationService.ts
  - supabase/migrations/20260322000001_allow_admin_write_email_sync_jobs.sql
  - src/types/index.ts
  - supabase/migrations/20260323000001_make_family_guardian_email_nullable.sql
  - src/components/ProtectedRoute.tsx
  - src/types/emailPreparation.ts
  - src/services/personalizedEmailComposer.ts
  - .agents/skills/spectra-ingest/SKILL.md
  - src/pages/AuthCallbackPage.tsx
  - supabase/functions/tracking-pixel/index.ts
  - src/components/admin/NewsletterTable.tsx
  - src/services/authService.ts
  - src/services/emailPlatform/kitAdapter.ts
  - src/hooks/useAnalyticsTracking.ts
  - supabase/functions/kit-send-newsletter/index.ts
  - supabase/migrations/20260322000000_add_newsletter_delivery_batches.sql
  - src/lib/supabase.ts
  - src/services/emailPlatform/kitMapping.ts
  - src/utils/urlUtils.ts
  - .agents/skills/spectra-debug/SKILL.md
  - .agents/skills/spectra-archive/SKILL.md
  - src/pages/LoginPage.tsx
  - src/pages/AdminArticleListPage.tsx
  - src/services/newsletterDeliveryService.ts
  - .agents/skills/spectra-audit/SKILL.md
  - src/pages/WeeklyReaderPage.tsx
  - src/types/personalization.ts
  - src/components/GoogleButton.tsx
  - src/pages/StudentManagementPage.tsx
  - src/components/admin/FamilyForm.tsx
  - src/types/admin.ts
  - src/types/emailPlatform.ts
  - .agents/skills/spectra-discuss/SKILL.md
  - specs/docs/EMAIL_PLATFORM_OPERATIONS.md
  - .spectra.yaml
  - supabase/migrations/20260322000002_delivery_parent_recipients.sql
  - src/services/emailPlatform/runtime.ts
  - supabase/migrations/20260323000000_add_delivery_recipient_contract_fields.sql
  - .agents/skills/spectra-propose/SKILL.md
  - .agents/skills/spectra-apply/SKILL.md
  - .agents/skills/spectra-ask/SKILL.md
  - src/types/emailJourney.ts
tests:
  - tests/unit/services/emailPlatform/kitAdapter.test.ts
  - tests/unit/services/personalization/personalizedEmailComposer.test.ts
  - tests/unit/authService.test.ts
  - tests/unit/hooks/useAnalyticsTracking.test.tsx
  - tests/unit/services/personalization/emailContentPreparationService.test.ts
  - tests/integration/email-content-preparation-flow.test.ts
  - tests/unit/services/newsletterDeliveryService.test.ts
  - tests/unit/utils/urlUtils.test.ts
  - tests/integration/admin-newsletter-workflow.test.tsx
  - tests/integration/phase5-completion.test.tsx
  - tests/services/adminService.spec.ts
  - tests/unit/services/emailPlatform/kitMapping.test.ts
  - tests/components/admin/ArticleForm.test.tsx
  - tests/pages/AuthCallbackPage.test.tsx
-->

---
### Requirement: System SHALL provide recipient-level review outputs for send decisions
The system SHALL produce review outputs with ready, warning, and failed counts plus recipient-level validation findings for operator review before send handoff.

#### Scenario: Review summary is available after preparation
- **WHEN** preparation completes for a batch
- **THEN** the system SHALL return a summary containing counts for ready, warning, and failed recipients with actionable error details

#### Scenario: Recipient preview includes findings
- **WHEN** an operator requests a recipient preview from a completed preparation job
- **THEN** the system SHALL return prepared subject/body with that recipient's validation findings and readiness status


<!-- @trace
source: confirm-workflow-blueprint
updated: 2026-04-09
code:
  - src/components/admin/FamilyList.tsx
  - README.md
  - src/context/AuthContext.tsx
  - src/pages/FamilyManagementPage.tsx
  - src/types/database.ts
  - vite.config.ts
  - supabase/functions/tracking-click/index.ts
  - src/services/adminService.ts
  - src/types/emailDelivery.ts
  - src/services/emailContentPreparationService.ts
  - supabase/migrations/20260322000001_allow_admin_write_email_sync_jobs.sql
  - src/types/index.ts
  - supabase/migrations/20260323000001_make_family_guardian_email_nullable.sql
  - src/components/ProtectedRoute.tsx
  - src/types/emailPreparation.ts
  - src/services/personalizedEmailComposer.ts
  - .agents/skills/spectra-ingest/SKILL.md
  - src/pages/AuthCallbackPage.tsx
  - supabase/functions/tracking-pixel/index.ts
  - src/components/admin/NewsletterTable.tsx
  - src/services/authService.ts
  - src/services/emailPlatform/kitAdapter.ts
  - src/hooks/useAnalyticsTracking.ts
  - supabase/functions/kit-send-newsletter/index.ts
  - supabase/migrations/20260322000000_add_newsletter_delivery_batches.sql
  - src/lib/supabase.ts
  - src/services/emailPlatform/kitMapping.ts
  - src/utils/urlUtils.ts
  - .agents/skills/spectra-debug/SKILL.md
  - .agents/skills/spectra-archive/SKILL.md
  - src/pages/LoginPage.tsx
  - src/pages/AdminArticleListPage.tsx
  - src/services/newsletterDeliveryService.ts
  - .agents/skills/spectra-audit/SKILL.md
  - src/pages/WeeklyReaderPage.tsx
  - src/types/personalization.ts
  - src/components/GoogleButton.tsx
  - src/pages/StudentManagementPage.tsx
  - src/components/admin/FamilyForm.tsx
  - src/types/admin.ts
  - src/types/emailPlatform.ts
  - .agents/skills/spectra-discuss/SKILL.md
  - specs/docs/EMAIL_PLATFORM_OPERATIONS.md
  - .spectra.yaml
  - supabase/migrations/20260322000002_delivery_parent_recipients.sql
  - src/services/emailPlatform/runtime.ts
  - supabase/migrations/20260323000000_add_delivery_recipient_contract_fields.sql
  - .agents/skills/spectra-propose/SKILL.md
  - .agents/skills/spectra-apply/SKILL.md
  - .agents/skills/spectra-ask/SKILL.md
  - src/types/emailJourney.ts
tests:
  - tests/unit/services/emailPlatform/kitAdapter.test.ts
  - tests/unit/services/personalization/personalizedEmailComposer.test.ts
  - tests/unit/authService.test.ts
  - tests/unit/hooks/useAnalyticsTracking.test.tsx
  - tests/unit/services/personalization/emailContentPreparationService.test.ts
  - tests/integration/email-content-preparation-flow.test.ts
  - tests/unit/services/newsletterDeliveryService.test.ts
  - tests/unit/utils/urlUtils.test.ts
  - tests/integration/admin-newsletter-workflow.test.tsx
  - tests/integration/phase5-completion.test.tsx
  - tests/services/adminService.spec.ts
  - tests/unit/services/emailPlatform/kitMapping.test.ts
  - tests/components/admin/ArticleForm.test.tsx
  - tests/pages/AuthCallbackPage.test.tsx
-->

---
### Requirement: Personalization uses a consistent membership snapshot during render
The system SHALL resolve recipient eligibility and class memberships from a single render-time snapshot to prevent in-flight data drift from changing payload composition mid-render.

#### Scenario: Membership changes after render start do not alter in-progress composition
- **WHEN** a guardian-child class association changes after render processing has begun
- **THEN** the in-progress payload SHALL continue using the membership snapshot captured at render start

#### Scenario: New render reflects latest membership snapshot
- **WHEN** a subsequent render starts after membership data changes
- **THEN** the new payload SHALL use the latest snapshot and recompute eligible class content deterministically

---
### Requirement: System renders per-recipient HTML by walking the pinned template's block list

The system SHALL produce each recipient's `renderedBody` HTML by walking the pinned template revision's block list in `order`, skipping blocks where `visible` is `false`, dispatching by block `type`, and concatenating the resulting HTML fragments. Static blocks (`header`, `section-divider`, `about`, `footer`, `custom-html`) SHALL be rendered once per recipient with the global token scope resolved from the recipient's context. Repeater blocks SHALL iterate over recipient-scoped data slices as follows: `shared-article-feature` SHALL iterate over the recipient's resolved shared articles capped by `config.maxItems`; `class-article-feature` SHALL iterate over the recipient's eligible classes in canonical class order, then iterate over each class's articles capped by `config.maxItemsPerClass`; `weekly-summary-list` SHALL iterate over the recipient's weekly items filtered by `config.sourceTag`. The walker SHALL resolve `article.*` tokens per article iteration and `class.*` tokens per class iteration in addition to the global token scope. When a pinned revision's block list is empty, the system SHALL fall back to the legacy single-body render path so that revisions created before block-based authoring continue to produce identical output.

#### Scenario: Walker renders static blocks once per recipient

- **WHEN** the renderer walks a recipient's blocks and encounters a `header` block
- **THEN** the system SHALL emit one rendered HTML fragment for that block with global tokens resolved from the recipient's context

#### Scenario: Walker expands shared article repeater per article

- **WHEN** the renderer walks a `shared-article-feature` block whose `config.maxItems` is `3` for a recipient with five shared articles
- **THEN** the system SHALL emit three rendered HTML fragments in canonical article order, each with `article.*` tokens resolved for that article

#### Scenario: Walker expands class repeater per eligible class then per article

- **WHEN** the renderer walks a `class-article-feature` block whose `config.maxItemsPerClass` is `1` for a recipient eligible for classes `A` and `B` with two articles each
- **THEN** the system SHALL emit one rendered HTML fragment for class `A` followed by one rendered HTML fragment for class `B` in canonical class order, each with `class.*` and `article.*` tokens resolved for that iteration

#### Scenario: Walker skips invisible blocks

- **WHEN** the renderer walks a block list that contains a block with `visible` set to `false`
- **THEN** the system SHALL omit that block from the recipient's `renderedBody`

#### Scenario: Walker falls back for legacy revisions with empty block list

- **WHEN** the renderer composes output for a recipient using a pinned revision whose block list is empty
- **THEN** the system SHALL produce `renderedBody` using the legacy single-body render path so that the resulting HTML matches what the prior renderer would have produced for the same inputs


<!-- @trace
source: block-based-email-templates
updated: 2026-04-25
code:
  - src/components/admin/AdminLayout.tsx
  - src/services/emailTemplateService.ts
  - src/pages/NewsletterEmailPreviewPage.tsx
  - src/services/emailTemplateRenderer.ts
  - src/services/emailTemplateBlocks.ts
  - src/utils/contentParser.ts
  - src/App.tsx
  - src/services/emailContentPreparationService.ts
  - src/pages/AdminEmailTemplateEditorPage.tsx
  - src/components/admin/EmailTemplateBlockConfigPanel.tsx
  - src/services/newsletterDeliveryService.ts
  - src/services/newsletterEmailRenderer.ts
  - supabase/migrations/20260423000000_email_template_active_singleton.sql
  - supabase/migrations/20260420000000_add_email_template_blocks.sql
  - src/components/admin/EmailTemplateBlockEditor.tsx
  - src/services/emailTemplateTokens.ts
  - src/pages/AdminEmailTemplatesPage.tsx
  - src/types/personalization.ts
  - src/services/canvaEmailImport.ts
  - src/components/admin/EmailTemplateBlockList.tsx
  - src/types/emailTemplate.ts
  - src/services/personalizedEmailComposer.ts
  - src/types/database.ts
tests:
  - tests/unit/services/personalization/personalizedEmailComposer.test.ts
  - tests/unit/services/emailTemplateService.test.ts
  - tests/unit/services/personalization/emailContentPreparationService.test.ts
  - tests/unit/services/emailTemplateTokens.test.ts
  - tests/integration/email-content-preparation-flow.test.ts
  - tests/components/admin/EmailTemplateBlockList.test.tsx
  - tests/unit/services/emailTemplateRenderer.test.ts
-->

---
### Requirement: Block-based renders preserve composition determinism and fingerprinting

The system SHALL ensure that walking a fixed block list with the same recipient context, newsletter revision, template revision, and rules version produces byte-identical `renderedBody` HTML and an identical `renderedHtmlFingerprint` across repeated renders. The pinned template revision identifier on a delivery batch SHALL pin the complete block list snapshot used for that batch.

#### Scenario: Repeated walker renders are byte-identical

- **WHEN** the system walks the same pinned block list for the same recipient context twice
- **THEN** both renders SHALL produce the same `renderedBody` HTML and the same `renderedHtmlFingerprint`

#### Scenario: Edits to a template after batch creation do not change pinned output

- **WHEN** a delivery batch was created with pinned template revision `R1` and an admin later saves a new revision `R2` with a different block list
- **THEN** the batch SHALL continue to render every recipient's `renderedBody` from `R1`'s block list and produce the same `renderedHtmlFingerprint` as the initial render

#### Scenario: Fingerprint changes only when pinned inputs change

- **WHEN** the recipient context, newsletter revision, template revision, or rules version changes between two renders for the same guardian
- **THEN** the `renderedHtmlFingerprint` MAY differ; otherwise it SHALL be identical

<!-- @trace
source: block-based-email-templates
updated: 2026-04-25
code:
  - src/components/admin/AdminLayout.tsx
  - src/services/emailTemplateService.ts
  - src/pages/NewsletterEmailPreviewPage.tsx
  - src/services/emailTemplateRenderer.ts
  - src/services/emailTemplateBlocks.ts
  - src/utils/contentParser.ts
  - src/App.tsx
  - src/services/emailContentPreparationService.ts
  - src/pages/AdminEmailTemplateEditorPage.tsx
  - src/components/admin/EmailTemplateBlockConfigPanel.tsx
  - src/services/newsletterDeliveryService.ts
  - src/services/newsletterEmailRenderer.ts
  - supabase/migrations/20260423000000_email_template_active_singleton.sql
  - supabase/migrations/20260420000000_add_email_template_blocks.sql
  - src/components/admin/EmailTemplateBlockEditor.tsx
  - src/services/emailTemplateTokens.ts
  - src/pages/AdminEmailTemplatesPage.tsx
  - src/types/personalization.ts
  - src/services/canvaEmailImport.ts
  - src/components/admin/EmailTemplateBlockList.tsx
  - src/types/emailTemplate.ts
  - src/services/personalizedEmailComposer.ts
  - src/types/database.ts
tests:
  - tests/unit/services/personalization/personalizedEmailComposer.test.ts
  - tests/unit/services/emailTemplateService.test.ts
  - tests/unit/services/personalization/emailContentPreparationService.test.ts
  - tests/unit/services/emailTemplateTokens.test.ts
  - tests/integration/email-content-preparation-flow.test.ts
  - tests/components/admin/EmailTemplateBlockList.test.tsx
  - tests/unit/services/emailTemplateRenderer.test.ts
-->