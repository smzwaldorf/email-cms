## ADDED Requirements

### Requirement: Admin can discover read-only file email templates
The system SHALL expose filesystem-authored email template folders as read-only template sources in the admin email template area. A file template source SHALL include a stable source identifier, display name, optional description, subject Handlebars file, ordered block manifest, referenced block Handlebars files, and optional partials. The admin UI SHALL NOT provide controls that write changes back to the template files.

#### Scenario: Admin views file template sources
- **WHEN** an admin opens the email template management area
- **THEN** the system SHALL list available file template sources separately from database-backed editable templates

#### Scenario: File template source is read-only
- **WHEN** an admin selects a file template source
- **THEN** the system SHALL present preview and sync actions and SHALL NOT present save, inline edit, duplicate, or delete actions for the filesystem files

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
