## 1. File Source Loader

- [ ] 1.1 Add Handlebars dependency and create src/types/fileEmailTemplate.ts with source metadata, manifest block modes, validation issue types, preview result types, and sync input types.
- [ ] 1.2 Implement Load file templates through controlled bundled sources in src/services/fileEmailTemplateLoader.ts using the templates/email root, raw template file imports, source discovery, and stable source identifiers.
- [ ] 1.3 Create an initial templates/email sample folder with metadata, subject Handlebars file, ordered block files, and partials that exercise static, article-repeat, class-article-repeat, custom-html, and footer rendering.

## 2. Rendering And Block Conversion

- [ ] 2.1 Implement Render Handlebars with restricted context and escaped defaults in src/services/fileEmailTemplateLoader.ts, exposing only global template tokens, block config, article data, class data, weekly item data, and named injected HTML values.
- [ ] 2.2 Implement Use a manifest-to-EmailTemplateBlock conversion boundary so static, article-repeat, class-article-repeat, weekly-repeat, and custom-html manifest entries produce ordered EmailTemplateBlock-compatible records with visible true, bodyHtml, and config.
- [ ] 2.3 Implement validation diagnostics for missing metadata fields, missing subject or block files, invalid block order, unsupported block mode, missing partial references, and Handlebars compile failures.
- [ ] 2.4 Cover File template blocks map to the existing block model with unit tests for mixed block ordering, article repeat render counts, class article repeat ordering, and custom-html rendering exactly once.

## 3. Email Template Sync Service

- [ ] 3.1 Extend src/services/emailTemplateService.ts with sync APIs that accept a valid file template preview result and create or update database-backed templates through the existing revision creation path.
- [ ] 3.2 Implement Sync by creating immutable database revisions so each file template sync creates a new email_template_revisions row, updates current_revision_id, and leaves active, draft, or inactive state unchanged.
- [ ] 3.3 Add service tests proving Admin can sync file email templates into immutable revisions for both existing template revision 3 to revision 4 and new file source to draft template plus initial revision.

## 4. Admin Preview And Sync UI

- [ ] 4.1 Update src/pages/AdminEmailTemplatesPage.tsx to satisfy Admin can discover read-only file email templates by listing file sources separately from database templates with preview and sync actions.
- [ ] 4.2 Update src/pages/AdminEmailTemplateEditorPage.tsx or add a route-level preview component so Admin can preview file email templates before sync with rendered subject, assembled HTML body, warnings, and blocking validation errors.
- [ ] 4.3 Implement Keep admin filesystem sources read-only by omitting save, inline edit, duplicate, and delete controls for file sources and labeling content edits as external filesystem changes.
- [ ] 4.4 Add integration tests for previewing a valid file source, blocking sync for a missing block file, syncing into an existing template, and confirming delivery-facing database revisions remain the synced source of truth.

## 5. Regression Verification

- [ ] 5.1 Run focused unit tests for fileEmailTemplateLoader, emailTemplateService sync behavior, and existing emailTemplateRenderer behavior.
- [ ] 5.2 Run focused admin integration tests covering database templates, Canva import, file template preview, and file template sync so existing template management behavior remains intact.
