# email-template-management Specification

## Purpose

Admins maintain reusable email templates for newsletter and personalized sends. Templates are versioned as revisions, validated against an allowed token registry before save, previewed deterministically with sample context, and pinned at composition time so in-flight and historical sends stay stable when templates evolve.

## Requirements

### Requirement: Admin can manage email templates
The system SHALL allow admins to create, edit, duplicate, delete, and import reusable email templates for newsletter and personalized sends. When an imported HTML template body is accepted, the system SHALL store the resulting template with an initial or updated revision whose body content matches the preserved imported markup approved during import validation.

#### Scenario: Create a new template
- **WHEN** an admin creates a new email template with subject and body content
- **THEN** the system SHALL store the template with an initial revision

#### Scenario: Create or update a template from imported Canva HTML
- **WHEN** an admin saves a template revision using accepted imported Canva HTML as the body source
- **THEN** the system SHALL persist the template revision with the preserved imported markup as the canonical body content for that revision

#### Scenario: Duplicate template for variant editing
- **WHEN** an admin duplicates an existing template
- **THEN** the system SHALL create a new template initialized with the source template content

#### Scenario: Delete template when no longer needed
- **WHEN** an admin deletes a template
- **THEN** the system SHALL remove that template from future selection in composition workflows


<!-- @trace
source: implement-email-template-from-canva-design
updated: 2026-04-17
code:
  - src/services/emailTemplateService.ts
  - src/services/personalizedEmailComposer.ts
  - src/types/emailPreparation.ts
  - src/services/canvaEmailImport.ts
  - src/services/emailContentPreparationService.ts
  - src/pages/AdminEmailTemplateEditorPage.tsx
tests:
  - tests/unit/services/canvaEmailImport.test.ts
  - tests/pages/AdminEmailTemplateEditorPage.test.tsx
  - tests/unit/services/personalization/emailContentPreparationService.test.ts
  - tests/unit/services/emailTemplateService.test.ts
-->

---
### Requirement: System validates template tokens before save

The system SHALL validate subject template content and each block's `bodyHtml` against the allowed token registry before a template revision can be saved. The subject template SHALL validate against the global token scope. Each block's `bodyHtml` SHALL validate against the global token scope unioned with that block type's allowed inner-scope tokens (for example, `shared-article-feature`, `class-article-feature`, and `weekly-summary-list` blocks SHALL allow `article.*` tokens; `class-article-feature` blocks SHALL additionally allow `class.*` tokens). The legacy `body_template` field on revisions whose block list contains exactly one `custom-html` block SHALL continue to validate against the global token scope.

#### Scenario: Reject unknown token in subject

- **WHEN** an admin attempts to save a revision whose subject template contains an unsupported token
- **THEN** the system SHALL reject the save and return a validation error identifying the unsupported token and the `subject` field

#### Scenario: Reject article token outside a repeater block

- **WHEN** an admin attempts to save a revision whose `header` block `bodyHtml` references `{{article.title}}`
- **THEN** the system SHALL reject the save and return a validation error identifying `article.title` as out-of-scope for the `header` block type

#### Scenario: Accept article token inside a repeater block

- **WHEN** an admin saves a revision whose `shared-article-feature` block `bodyHtml` references `{{article.title}}` and `{{article.url}}`
- **THEN** the system SHALL accept the save because `article.*` tokens are in scope for `shared-article-feature` blocks

#### Scenario: Accept class token inside a class repeater block

- **WHEN** an admin saves a revision whose `class-article-feature` block `bodyHtml` references `{{class.name}}` and `{{article.title}}`
- **THEN** the system SHALL accept the save because both `class.*` and `article.*` tokens are in scope for `class-article-feature` blocks

#### Scenario: Save valid block-based template

- **WHEN** an admin saves a revision whose subject template and every block `bodyHtml` use only tokens that are in scope for their respective fields
- **THEN** the system SHALL persist the new revision successfully


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
### Requirement: System provides deterministic template preview

The system SHALL provide preview rendering for a selected template revision using a sample recipient/context payload, and SHALL render imported template revisions from the preserved canonical imported HTML stored on that revision. When a revision contains a non-empty block list, the system SHALL produce preview output by walking the block list in `order` skipping blocks where `visible` is `false`, expanding repeater blocks (`shared-article-feature`, `class-article-feature`, `weekly-summary-list`) over the sample context's article and class data, and concatenating the rendered HTML.

#### Scenario: Preview resolves global tokens in static blocks

- **WHEN** an admin requests preview for a revision whose `header` block `bodyHtml` references global tokens with values present in the sample context
- **THEN** the system SHALL render that block once with its global tokens deterministically resolved from the sample context

#### Scenario: Preview expands repeater blocks over sample articles

- **WHEN** an admin requests preview for a revision whose `shared-article-feature` block `config` sets `maxItems` to `2` and the sample context provides three shared articles
- **THEN** the system SHALL render the block twice, once per article in canonical order, with `article.*` tokens resolved per article

#### Scenario: Preview expands class repeater per sample class

- **WHEN** an admin requests preview for a revision whose `class-article-feature` block iterates over a sample context with two classes
- **THEN** the system SHALL render the block once per class with `class.*` and `article.*` tokens resolved per class iteration in canonical class order

#### Scenario: Preview surfaces unresolved required data

- **WHEN** preview input is missing required values for supported tokens
- **THEN** the system SHALL return deterministic fallback output and explicit warnings about missing values

#### Scenario: Preview uses preserved imported HTML for legacy custom-html blocks

- **WHEN** an admin requests preview for a revision whose block list is a single `custom-html` block created from accepted Canva HTML
- **THEN** the system SHALL render preview from the preserved canonical imported HTML stored on that block rather than a regenerated editor serialization


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
### Requirement: Send composition uses pinned template revisions
The system SHALL pin a specific selected template revision when composing a send so subsequent template edits do not mutate in-progress or historical composition output.

#### Scenario: In-progress job remains stable after template update
- **WHEN** a send composition job starts with template revision `R1` and a newer revision `R2` is later saved and selected for new compositions
- **THEN** the in-progress job SHALL continue using `R1`

#### Scenario: New composition uses latest selected revision
- **WHEN** a new send composition starts after a newer template revision `R2` is selected for composition
- **THEN** the system SHALL use `R2` unless an explicit revision override is provided

---
### Requirement: Template revisions persist an ordered list of typed blocks

The system SHALL persist on each `email_template_revisions` row an ordered list of typed `EmailTemplateBlock` records (`type`, `order`, `visible`, `bodyHtml`, `config`) representing the structural sections of the rendered email. The system SHALL accept the following block types: `header`, `shared-article-feature`, `class-article-feature`, `weekly-summary-list`, `section-divider`, `about`, `footer`, `custom-html`. When a revision is loaded, duplicated, or pinned for delivery, the system SHALL include the complete block list as part of that revision snapshot.

#### Scenario: New revision stores typed blocks

- **WHEN** an admin saves a template revision that contains an ordered list of typed blocks
- **THEN** the system SHALL persist the full block list on that revision and SHALL return the same ordered list when the revision is read back

#### Scenario: Duplicating a template copies its blocks

- **WHEN** an admin duplicates a template
- **THEN** the new template SHALL be initialized with a deep copy of the source revision's block list in the same order

#### Scenario: Legacy revisions expose a single custom-html block

- **WHEN** the system reads a revision that was created before block-based authoring
- **THEN** the system SHALL expose its block list as a single `custom-html` block whose `bodyHtml` matches the legacy `body_template` content


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
### Requirement: Admin can edit, reorder, and toggle visibility of template blocks

The system SHALL allow an admin to add, remove, reorder, edit the `bodyHtml` of, edit the `config` of, and toggle the `visible` flag on individual blocks within a template revision. Saving these changes SHALL produce a new revision that captures the full updated block list.

#### Scenario: Admin reorders blocks

- **WHEN** an admin changes the order of blocks within a template and saves
- **THEN** the system SHALL persist a new revision whose block list reflects the new order, and the previous revision SHALL remain unchanged

#### Scenario: Admin hides a block without deleting it

- **WHEN** an admin toggles a block's `visible` flag to `false` and saves
- **THEN** the system SHALL persist the block on the new revision with `visible: false`, and the renderer SHALL skip that block when producing per-recipient output

#### Scenario: Admin edits a block's config and body

- **WHEN** an admin edits the `bodyHtml` and `config` of a single block and saves
- **THEN** the system SHALL persist a new revision whose block list contains the updated `bodyHtml` and `config` for that block, with all other blocks unchanged

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
### Requirement: Admin can discover read-only file email templates
The system SHALL expose filesystem-authored email template folders as read-only template sources in the admin email template area. A file template source SHALL include a stable source identifier, display name, optional description, subject Handlebars file, ordered block manifest, referenced block Handlebars files, and optional partials. The admin UI SHALL NOT provide controls that write changes back to the template files.

#### Scenario: Admin views file template sources
- **WHEN** an admin opens the email template management area
- **THEN** the system SHALL list available file template sources separately from database-backed editable templates

#### Scenario: File template source is read-only
- **WHEN** an admin selects a file template source
- **THEN** the system SHALL present preview and sync actions and SHALL NOT present save, inline edit, duplicate, or delete actions for the filesystem files


<!-- @trace
source: file-based-email-template-handlebars-support
updated: 2026-04-25
code:
  - src/pages/AdminFileEmailTemplatePreviewPage.tsx
  - src/pages/AdminEmailTemplatesPage.tsx
  - package.json
  - templates/email/smzwaldorf-weekly/blocks/header.hbs
  - templates/email/smzwaldorf-weekly/partials/section-title.hbs
  - src/App.tsx
  - src/types/fileEmailTemplate.ts
  - templates/email/smzwaldorf-weekly/blocks/custom-html.hbs
  - templates/email/smzwaldorf-weekly/blocks/class-article.hbs
  - templates/email/smzwaldorf-weekly/blocks/footer.hbs
  - src/services/fileEmailTemplatePreviewContext.ts
  - templates/email/smzwaldorf-weekly/blocks/shared-article.hbs
  - src/services/fileEmailTemplateLoader.ts
  - src/services/emailTemplateService.ts
  - templates/email/smzwaldorf-weekly/blocks/weekly-item.hbs
  - templates/email/smzwaldorf-weekly/metadata.json
  - templates/email/smzwaldorf-weekly/partials/cta-button.hbs
  - templates/email/smzwaldorf-weekly/subject.hbs
  - src/types/index.ts
tests:
  - tests/integration/admin-file-email-template-sync.test.tsx
  - tests/unit/services/emailTemplateService.test.ts
  - tests/unit/services/fileEmailTemplateLoader.test.ts
-->

---
### Requirement: Admin can preview file email templates before sync
The system SHALL render a file email template preview using its Handlebars subject, ordered block files, partials, and the same deterministic sample recipient, shared article, class article, and weekly item data used by database template previews. Preview rendering SHALL report template validation errors, missing template files, invalid manifest entries, unsupported block types, missing partials, and unresolved required values without creating or updating database template revisions.

#### Scenario: Preview valid file template
- **WHEN** an admin previews a valid file template source
- **THEN** the system SHALL display the rendered subject, assembled HTML body, and any non-blocking warnings without writing a database revision

##### Example: article repeat preview
- **GIVEN** a file template block with type article-repeat, source sharedArticles, and preview sharedArticles containing A, B, and C
- **WHEN** the admin previews the file template source
- **THEN** the rendered preview SHALL contain one rendered block fragment for A, one for B, and one for C in the preview article order

#### Scenario: Preview invalid file template
- **WHEN** an admin previews a file template source whose manifest references blocks/missing-footer.hbs and that file is unavailable
- **THEN** the system SHALL show a blocking validation error naming blocks/missing-footer.hbs and SHALL NOT offer sync for that preview result


<!-- @trace
source: file-based-email-template-handlebars-support
updated: 2026-04-25
code:
  - src/pages/AdminFileEmailTemplatePreviewPage.tsx
  - src/pages/AdminEmailTemplatesPage.tsx
  - package.json
  - templates/email/smzwaldorf-weekly/blocks/header.hbs
  - templates/email/smzwaldorf-weekly/partials/section-title.hbs
  - src/App.tsx
  - src/types/fileEmailTemplate.ts
  - templates/email/smzwaldorf-weekly/blocks/custom-html.hbs
  - templates/email/smzwaldorf-weekly/blocks/class-article.hbs
  - templates/email/smzwaldorf-weekly/blocks/footer.hbs
  - src/services/fileEmailTemplatePreviewContext.ts
  - templates/email/smzwaldorf-weekly/blocks/shared-article.hbs
  - src/services/fileEmailTemplateLoader.ts
  - src/services/emailTemplateService.ts
  - templates/email/smzwaldorf-weekly/blocks/weekly-item.hbs
  - templates/email/smzwaldorf-weekly/metadata.json
  - templates/email/smzwaldorf-weekly/partials/cta-button.hbs
  - templates/email/smzwaldorf-weekly/subject.hbs
  - src/types/index.ts
tests:
  - tests/integration/admin-file-email-template-sync.test.tsx
  - tests/unit/services/emailTemplateService.test.ts
  - tests/unit/services/fileEmailTemplateLoader.test.ts
-->

---
### Requirement: Admin can sync file email templates into immutable revisions
The system SHALL allow an admin to sync a valid file template source into the existing email template lifecycle. Each sync SHALL create a new email_template_revisions row containing the rendered subject template and an EmailTemplateBlock list derived from the file manifest, SHALL update the target email_templates row current_revision_id, and SHALL preserve existing active/inactive state rules. The delivery system SHALL continue to render from the pinned database revision and SHALL NOT read template files during newsletter delivery.

#### Scenario: Sync creates new revision
- **WHEN** an admin syncs a valid file template source into an existing database template that currently has revision 3
- **THEN** the system SHALL create revision 4, set current_revision_id to revision 4, and leave the template state unchanged

#### Scenario: Sync creates database template for new source
- **WHEN** an admin syncs a valid file template source that is not linked to an existing database template
- **THEN** the system SHALL create a draft email_templates row and an initial email_template_revisions row derived from the file source

#### Scenario: Delivery uses synced revision
- **WHEN** a newsletter delivery batch is prepared after a file template source has been synced and activated through the existing active-template flow
- **THEN** the delivery payload SHALL use the active database revision content and SHALL NOT depend on the current filesystem contents


<!-- @trace
source: file-based-email-template-handlebars-support
updated: 2026-04-25
code:
  - src/pages/AdminFileEmailTemplatePreviewPage.tsx
  - src/pages/AdminEmailTemplatesPage.tsx
  - package.json
  - templates/email/smzwaldorf-weekly/blocks/header.hbs
  - templates/email/smzwaldorf-weekly/partials/section-title.hbs
  - src/App.tsx
  - src/types/fileEmailTemplate.ts
  - templates/email/smzwaldorf-weekly/blocks/custom-html.hbs
  - templates/email/smzwaldorf-weekly/blocks/class-article.hbs
  - templates/email/smzwaldorf-weekly/blocks/footer.hbs
  - src/services/fileEmailTemplatePreviewContext.ts
  - templates/email/smzwaldorf-weekly/blocks/shared-article.hbs
  - src/services/fileEmailTemplateLoader.ts
  - src/services/emailTemplateService.ts
  - templates/email/smzwaldorf-weekly/blocks/weekly-item.hbs
  - templates/email/smzwaldorf-weekly/metadata.json
  - templates/email/smzwaldorf-weekly/partials/cta-button.hbs
  - templates/email/smzwaldorf-weekly/subject.hbs
  - src/types/index.ts
tests:
  - tests/integration/admin-file-email-template-sync.test.tsx
  - tests/unit/services/emailTemplateService.test.ts
  - tests/unit/services/fileEmailTemplateLoader.test.ts
-->

---
### Requirement: File template blocks map to the existing block model
The system SHALL convert each ordered manifest block into an EmailTemplateBlock-compatible revision block. Static blocks SHALL render once. Article repeat blocks SHALL render once per item from the declared article source. Class article repeat blocks SHALL render once per eligible class article in deterministic class and article order. Custom HTML blocks SHALL inject their file content once as a custom-html block and SHALL NOT expand over article collections.

#### Scenario: Manifest maps mixed block types
- **WHEN** a file template manifest declares static header, article-repeat featured, class-article-repeat class-news, custom-html body-slot, and static footer blocks in that order
- **THEN** the synced revision SHALL contain five EmailTemplateBlock entries in the same order with equivalent block types, visibility enabled, compiled bodyHtml values, and block config derived from the manifest

##### Example: mixed block rendering
| Manifest Block | Input Data | Expected Render Count |
| -------------- | ---------- | --------------------- |
| static header | one recipient | 1 |
| article-repeat featured | 3 shared articles | 3 |
| class-article-repeat class-news | 2 eligible class articles | 2 |
| custom-html body-slot | injected HTML file | 1 |
| static footer | one recipient | 1 |

#### Scenario: Custom HTML block does not repeat
- **WHEN** a file template contains a custom-html block and preview sample data contains three shared articles
- **THEN** the custom-html block SHALL render exactly once in the assembled preview

<!-- @trace
source: file-based-email-template-handlebars-support
updated: 2026-04-25
code:
  - src/pages/AdminFileEmailTemplatePreviewPage.tsx
  - src/pages/AdminEmailTemplatesPage.tsx
  - package.json
  - templates/email/smzwaldorf-weekly/blocks/header.hbs
  - templates/email/smzwaldorf-weekly/partials/section-title.hbs
  - src/App.tsx
  - src/types/fileEmailTemplate.ts
  - templates/email/smzwaldorf-weekly/blocks/custom-html.hbs
  - templates/email/smzwaldorf-weekly/blocks/class-article.hbs
  - templates/email/smzwaldorf-weekly/blocks/footer.hbs
  - src/services/fileEmailTemplatePreviewContext.ts
  - templates/email/smzwaldorf-weekly/blocks/shared-article.hbs
  - src/services/fileEmailTemplateLoader.ts
  - src/services/emailTemplateService.ts
  - templates/email/smzwaldorf-weekly/blocks/weekly-item.hbs
  - templates/email/smzwaldorf-weekly/metadata.json
  - templates/email/smzwaldorf-weekly/partials/cta-button.hbs
  - templates/email/smzwaldorf-weekly/subject.hbs
  - src/types/index.ts
tests:
  - tests/integration/admin-file-email-template-sync.test.tsx
  - tests/unit/services/emailTemplateService.test.ts
  - tests/unit/services/fileEmailTemplateLoader.test.ts
-->