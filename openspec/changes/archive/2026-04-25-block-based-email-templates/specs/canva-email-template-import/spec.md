## ADDED Requirements

### Requirement: Canva import detects layout sections and maps them to typed template blocks

The system SHALL attempt to detect structural sections inside imported Canva HTML and map each detected section to a typed `EmailTemplateBlock`. Detection SHALL use, in order: explicit HTML comment markers `<!-- block:<type> -->` ... `<!-- /block -->`; then heading or text patterns matching the design's labelled sections (`SMZ School News` for `header`; `Regarding school` for `shared-article-feature`; `Class news & events` for `class-article-feature`; `The weekly news` or `本週重要事情佈達` for `weekly-summary-list`; `About us` or `認識 善美真` for `about`; a trailing block containing both `TEL` and `FAX` for `footer`). When at least three sections are matched, the system SHALL emit a typed block list whose `bodyHtml` for each block is the normalized HTML of that detected section and whose `config` is initialized from the registry defaults for that block type. When fewer than three sections are matched, the system SHALL fall back to producing a single `custom-html` block whose `bodyHtml` is the full normalized import.

#### Scenario: Marker comments produce typed blocks

- **WHEN** an admin imports Canva HTML that contains `<!-- block:header -->...<!-- /block -->` and `<!-- block:footer -->...<!-- /block -->` plus one heading-pattern match
- **THEN** the system SHALL emit a block list containing a `header` block, the heading-pattern block, and a `footer` block in source order, each with `bodyHtml` set to its detected segment

#### Scenario: Heading patterns alone produce typed blocks

- **WHEN** an admin imports Canva HTML that contains the headings `SMZ School News`, `Regarding school`, `Class news & events`, and `About us` without comment markers
- **THEN** the system SHALL emit a block list containing `header`, `shared-article-feature`, `class-article-feature`, and `about` blocks in source order

#### Scenario: Insufficient matches fall back to a single custom-html block

- **WHEN** an admin imports Canva HTML in which the system detects fewer than three sections via markers or heading patterns
- **THEN** the system SHALL emit a block list containing exactly one `custom-html` block whose `bodyHtml` is the full normalized import

#### Scenario: Detection preserves existing compatibility validation

- **WHEN** Canva HTML is imported and detection identifies typed sections
- **THEN** the system SHALL still apply the existing import compatibility validation to the full normalized HTML and SHALL block the save with the same findings if validation fails, regardless of whether detection succeeded

## MODIFIED Requirements

### Requirement: Admin can import Canva-authored HTML into an email template revision

The system SHALL allow an admin to paste or upload Canva-exported HTML while creating or editing an email template, and SHALL convert that import into a saveable template revision candidate whose body is represented as a typed block list. When section detection produces a typed block list of three or more blocks, the system SHALL present the typed block list as the revision candidate so the admin can edit individual blocks before save. When section detection does not produce three or more blocks, the system SHALL present a single `custom-html` block containing the normalized import as the revision candidate, preserving the existing import experience.

#### Scenario: Admin pastes a Canva export that yields typed blocks

- **WHEN** an admin pastes a full Canva-exported HTML document whose sections detect into three or more typed blocks
- **THEN** the system SHALL present a typed block list as the revision candidate for preview and save, with each block independently editable

#### Scenario: Admin pastes a Canva export that does not yield typed blocks

- **WHEN** an admin pastes a full Canva-exported HTML document whose sections cannot be detected into three or more typed blocks
- **THEN** the system SHALL present a single `custom-html` block containing the normalized import as the revision candidate for preview and save

#### Scenario: Admin uploads an HTML file exported from Canva

- **WHEN** an admin uploads a `.html` file exported from Canva
- **THEN** the system SHALL load the file contents into the same import detection and validation flow used for pasted HTML and SHALL produce either a typed block list or a single `custom-html` block according to the detection rule

### Requirement: System preserves accepted imported markup for downstream reuse

The system SHALL preserve accepted imported HTML markup as the canonical source for the produced block list after normalization, and SHALL reuse that stored markup for later preview and send preparation. When a typed block list is produced from import, the system SHALL persist each block's `bodyHtml` exactly as detected and normalized, without regenerating the markup from an editor serialization round-trip. When a single `custom-html` block is produced from import, the system SHALL persist that block's `bodyHtml` as the full normalized import for later preview and send preparation.

#### Scenario: Imported typed-block revision is reopened later

- **WHEN** an admin reopens an email template revision that was created from a Canva import that produced typed blocks
- **THEN** the system SHALL load each block's preserved `bodyHtml` for further preview or per-block editing without regenerating a different block structure

#### Scenario: Imported custom-html revision is reopened later

- **WHEN** an admin reopens an email template revision that was created from a Canva import that produced a single `custom-html` block
- **THEN** the system SHALL load that block's preserved `bodyHtml` for further preview or editing without regenerating a different body structure

#### Scenario: Imported revision is selected for downstream reuse

- **WHEN** a Canva-imported template revision is selected by a later preview or preparation workflow
- **THEN** the system SHALL render output by walking the preserved block list rather than substituting editor-generated HTML
