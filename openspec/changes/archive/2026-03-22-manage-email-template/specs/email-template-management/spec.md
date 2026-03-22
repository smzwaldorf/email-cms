## ADDED Requirements

### Requirement: Admin can manage email templates
The system SHALL allow admins to create, edit, duplicate, and delete reusable email templates for newsletter and personalized sends.

#### Scenario: Create a new template
- **WHEN** an admin creates a new email template with subject and body content
- **THEN** the system SHALL store the template with an initial revision

#### Scenario: Duplicate template for variant editing
- **WHEN** an admin duplicates an existing template
- **THEN** the system SHALL create a new template initialized with the source template content

#### Scenario: Delete template when no longer needed
- **WHEN** an admin deletes a template
- **THEN** the system SHALL remove that template from future selection in composition workflows

### Requirement: System validates template tokens before save
The system SHALL validate subject/body template content against the allowed token registry before a template can be saved.

#### Scenario: Reject unknown token
- **WHEN** an admin attempts to save a template containing an unsupported token
- **THEN** the system SHALL reject the save and return a validation error identifying the unsupported token

#### Scenario: Save valid template
- **WHEN** an admin saves a template with only supported tokens
- **THEN** the system SHALL persist the revision successfully

### Requirement: System provides deterministic template preview
The system SHALL provide preview rendering for a selected template revision using a sample recipient/context payload.

#### Scenario: Preview resolves known tokens
- **WHEN** an admin requests preview for a template revision with a sample context
- **THEN** the system SHALL render subject and body with supported tokens resolved deterministically from that context

#### Scenario: Preview surfaces unresolved required data
- **WHEN** preview input is missing required values for supported tokens
- **THEN** the system SHALL return deterministic fallback output and explicit warnings about missing values

### Requirement: Send composition uses pinned template revisions
The system SHALL pin a specific selected template revision when composing a send so subsequent template edits do not mutate in-progress or historical composition output.

#### Scenario: In-progress job remains stable after template update
- **WHEN** a send composition job starts with template revision `R1` and a newer revision `R2` is later saved and selected for new compositions
- **THEN** the in-progress job SHALL continue using `R1`

#### Scenario: New composition uses latest selected revision
- **WHEN** a new send composition starts after a newer template revision `R2` is selected for composition
- **THEN** the system SHALL use `R2` unless an explicit revision override is provided
