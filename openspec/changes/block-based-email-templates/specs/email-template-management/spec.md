## ADDED Requirements

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

## MODIFIED Requirements

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
