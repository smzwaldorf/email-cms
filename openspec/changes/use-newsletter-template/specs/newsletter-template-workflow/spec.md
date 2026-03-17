## ADDED Requirements

### Requirement: Admin can create a draft newsletter from a source newsletter
The system SHALL allow an admin to create a new draft newsletter by selecting an existing newsletter as the template source.

#### Scenario: Start new newsletter from template
- **WHEN** an admin selects a source newsletter during newsletter creation
- **THEN** the system SHALL create a new draft newsletter derived from that source newsletter

#### Scenario: Blank creation remains available
- **WHEN** an admin chooses not to use a template
- **THEN** the system SHALL continue to allow creation of a blank draft newsletter

### Requirement: Template use copies newsletter composition into editable draft content
The system SHALL copy the source newsletter's composition into the new newsletter in a form that can be edited independently.

#### Scenario: Copy article structure and ordering
- **WHEN** the system creates a new newsletter from a template
- **THEN** it SHALL copy the source newsletter's article composition and preserve newsletter article ordering in the new draft

#### Scenario: Copied issue is independently editable
- **WHEN** an admin edits content in a template-created newsletter
- **THEN** the system SHALL apply those edits only to the new draft newsletter and its copied articles

### Requirement: Template use resets publication state and operational metadata
The system SHALL create template-derived newsletters and copied articles in a safe draft state with reset publication metadata.

#### Scenario: Copied newsletter starts as draft
- **WHEN** a source newsletter has published or archived state
- **THEN** the new newsletter created from that source SHALL start in draft state

#### Scenario: Copied articles start as draft
- **WHEN** source articles have published state or historical metadata
- **THEN** the copied articles SHALL be created as draft content without inheriting publish timestamps

### Requirement: Source newsletter remains unchanged after template use
The system SHALL preserve the source newsletter and source articles when a template is used.

#### Scenario: Source newsletter is not mutated
- **WHEN** an admin creates a new newsletter from a source newsletter
- **THEN** the system SHALL leave the source newsletter metadata and composition unchanged

#### Scenario: Source articles are not mutated by edits in the copy
- **WHEN** an admin edits articles in a template-created newsletter
- **THEN** the system SHALL leave the source newsletter's article records unchanged

### Requirement: Admin UI exposes a template-selection entry point
The system SHALL provide an admin UI path for choosing a source newsletter as part of newsletter creation.

#### Scenario: Template option visible in creation workflow
- **WHEN** an admin begins creating a newsletter from the admin UI
- **THEN** the system SHALL provide an option to start from an existing newsletter template

#### Scenario: Source newsletter can be identified clearly
- **WHEN** the admin is choosing a newsletter template
- **THEN** the system SHALL present enough source newsletter information to distinguish the intended template from other newsletters
