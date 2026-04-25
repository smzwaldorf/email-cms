## Context

The application already has database-backed email_templates and immutable email_template_revisions, an admin template editor with deterministic preview, typed EmailTemplateBlock rendering, Canva HTML import, and newsletter delivery that pins active database revisions. The new requirement adds a filesystem-authored source for templates, but the application is a Vite React frontend with Supabase rather than a general-purpose server that can read arbitrary runtime paths. File templates therefore need a controlled source boundary that can be previewed in admin and synced into the existing database lifecycle.

## Goals / Non-Goals

**Goals:**

- Support externally-authored template folders under a project-owned template root.
- Preview file templates in admin with deterministic sample data before persistence.
- Convert ordered file block manifests into the existing EmailTemplateBlock revision model.
- Create a new immutable database revision every time an admin syncs a valid file template.
- Keep newsletter delivery reading from pinned database revisions, not live files.

**Non-Goals:**

- The admin UI will not edit or write filesystem template files.
- The browser will not read arbitrary local paths chosen at runtime.
- This change will not replace the current database-backed template editor, Canva import flow, active-template selection, or delivery pinning behavior.
- This change will not add a new delivery-time rendering path that bypasses email_template_revisions.

## Decisions

### Load file templates through controlled bundled sources

File templates will live under templates/email/<source-id>/ and be loaded through a controlled application module, for example a Vite raw import map or equivalent build/dev-server loader. This keeps the browser security model intact and prevents arbitrary path reads while still allowing source-controlled template files to be externally edited and previewed after the app reloads.

Alternatives considered:

- Direct browser filesystem reads: rejected because admin preview needs predictable deployed behavior and the browser cannot safely read project paths without explicit user file selection.
- Supabase storage as the primary source: rejected because the requirement is filesystem-authored templates and because storage would duplicate the database lifecycle instead of preserving file review workflows.

### Use a manifest-to-EmailTemplateBlock conversion boundary

Each template folder will include metadata that declares the subject file, optional partials, and an ordered list of blocks. The loader will validate that every referenced file exists, compile each block with Handlebars, and produce an EmailTemplateBlock-compatible structure for preview and sync. Static, article-repeat, class-article-repeat, weekly-repeat, and custom-html manifest block modes will map onto the current typed block concepts and configs.

Alternatives considered:

- One large body.hbs file: rejected because it hides block intent, weakens preview diagnostics, and does not match the existing block editor and delivery renderer.
- Fully free-form Handlebars loops inside every block: rejected for the first implementation because declared block modes give predictable repeat behavior, validation, and tests.

### Sync by creating immutable database revisions

A successful sync will call the existing email template persistence boundary or a narrow extension of it to create a new revision. Existing templates retain their active, draft, or inactive state unless the admin separately uses the active-template flow. Delivery continues to pin and render the database revision, which makes sent batches stable even when filesystem templates change later.

Alternatives considered:

- Updating the current revision in place: rejected because revisions are already immutable and are used for auditability and rollback.
- Rendering files during delivery: rejected because delivery must remain stable, deterministic, and independent of deployed filesystem changes after a batch is prepared.

### Keep admin filesystem sources read-only

The admin UI will present file sources as previewable and syncable, not editable. All content edits happen externally through the file authoring workflow. This avoids building a browser-to-filesystem write API and keeps template source changes reviewable in normal source control.

Alternatives considered:

- Adding write-back from admin to files: rejected because it requires a trusted server write surface, conflict handling, and source-control semantics outside the current app architecture.

### Render Handlebars with restricted context and escaped defaults

The file template renderer will expose only the explicit preview/sync context needed by subject and block templates: global template tokens, block config values, article data, class data, weekly item data, and named injected HTML values. Normal Handlebars interpolation will escape values by default; custom-html blocks and explicit triple-stash output will be limited to validated template sources and existing email HTML sanitization/compatibility checks where applicable.

Alternatives considered:

- Passing the full application state into templates: rejected because templates need a stable contract and narrower inputs make validation and tests reliable.
- Treating all Handlebars output as trusted raw HTML: rejected because mixed trusted template markup and dynamic article values need clear escaping behavior.

## Risks / Trade-offs

- Build-time source loading can hide filesystem changes until the dev server reloads or production is redeployed -> The admin UI will label file sources as deployed/read-only sources and sync will persist a revision snapshot.
- Declared block modes are less flexible than arbitrary Handlebars loops -> The first implementation gains deterministic mapping and can add new manifest block modes later.
- Handlebars introduces a new dependency and template syntax surface -> Loader tests will cover escaping, partial resolution, missing files, invalid manifests, and repeat expansion.
- Syncing creates a new revision for every valid sync, including identical content -> Revision history stays simple and immutable; duplicate-content detection can be added later without changing delivery semantics.

## Migration Plan

1. Add file-template types, loader, renderer, and sample template fixtures without changing active delivery behavior.
2. Add admin list/preview/sync UI for file sources alongside existing database templates.
3. Route sync through the existing email template revision lifecycle so synced revisions appear like any other database template revision.
4. Verify current template creation, Canva import, active-template selection, and delivery flows continue to work.
5. Rollback by hiding the file-source admin entry points; previously synced database revisions remain valid because delivery does not depend on file loading.

## Open Questions

None for the first implementation. Future changes can add richer manifest block modes, source-to-template linking metadata, or duplicate-content detection after the basic preview and sync workflow is working.
