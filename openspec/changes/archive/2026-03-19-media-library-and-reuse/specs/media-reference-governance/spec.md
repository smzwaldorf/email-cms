## ADDED Requirements

### Requirement: System SHALL track media usage references across content lifecycle operations
The system SHALL persist media usage references for insert, remove, article delete, and article copy operations so each media asset has an accurate active-reference count.

#### Scenario: Reference is created on media insertion
- **WHEN** an editor inserts a media asset into article content
- **THEN** the system SHALL create an active usage record linked to the target article context

#### Scenario: Reference is removed on content deletion
- **WHEN** a referenced media block is removed from article content or the article is deleted
- **THEN** the system SHALL deactivate or remove the associated usage record and update active-reference counts

### Requirement: System SHALL prevent deletion of in-use media assets
The system SHALL block media deletion when an asset has one or more active usage references and SHALL return the referencing contexts needed for remediation.

#### Scenario: Delete is blocked for in-use media
- **WHEN** an operator attempts to delete a media asset with active references
- **THEN** the system SHALL deny the delete request and show the list of referencing content contexts

#### Scenario: Delete succeeds for unused media
- **WHEN** an operator confirms deletion for a media asset with zero active references
- **THEN** the system SHALL delete the media asset and record an auditable deletion event

### Requirement: System SHALL support reuse-first insertion and copy-safe reference preservation
The system SHALL provide an "insert existing media" workflow and SHALL preserve valid media references when article copy workflows duplicate content.

#### Scenario: Editor inserts existing media from library
- **WHEN** an editor chooses an asset from the media library picker within the editor
- **THEN** the system SHALL insert the selected media and register usage for the target article context

#### Scenario: Article copy retains media references
- **WHEN** an article containing media references is copied
- **THEN** the system SHALL create corresponding usage references for the copied article without breaking source-article references
