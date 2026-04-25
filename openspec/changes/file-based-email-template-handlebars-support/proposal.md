## Why

Email templates are currently authored through the admin UI or imported from HTML, which makes larger layout changes harder to review, version, and maintain alongside the codebase. A read-only filesystem template source lets externally-authored Handlebars templates be previewed by admins and synced into immutable database revisions without changing the stable delivery path.

## What Changes

- Add a read-only file template source for email templates stored as project folders with metadata, subject, ordered block manifest entries, Handlebars block files, and optional partials.
- Allow admins to preview file-based templates with the existing sample recipient/article context before syncing.
- Allow admins to sync a file-based template into the existing email_templates and email_template_revisions lifecycle, creating a new immutable revision on each sync.
- Map file block declarations into the existing EmailTemplateBlock model: static blocks render once, article repeater blocks render over shared or class article collections, and custom HTML blocks inject prepared HTML once.
- Preserve the existing active template and delivery behavior so newsletter delivery continues to use pinned database revisions, not live filesystem files.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- email-template-management: Admins can preview read-only filesystem-authored Handlebars templates and sync them into versioned email template revisions.

## Impact

- Affected specs: email-template-management
- Affected code:
  - New: templates/email, src/types/fileEmailTemplate.ts, src/services/fileEmailTemplateLoader.ts, tests/unit/services/fileEmailTemplateLoader.test.ts, tests/integration/admin-file-email-template-sync.test.tsx
  - Modified: package.json, package-lock.json, src/types/emailTemplate.ts, src/services/emailTemplateService.ts, src/services/emailTemplateRenderer.ts, src/pages/AdminEmailTemplatesPage.tsx, src/pages/AdminEmailTemplateEditorPage.tsx, src/App.tsx
  - Removed: none
- Dependencies: add a Handlebars-compatible renderer for compiling file templates and partials in preview and sync flows.
