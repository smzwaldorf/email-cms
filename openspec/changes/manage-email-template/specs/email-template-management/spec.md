## ADDED Requirements

### Requirement: Admin can manage email template lifecycle
The system SHALL allow admins to create, edit, duplicate, activate, and deactivate reusable email templates for newsletter and personalized sends.

#### Scenario: Create a new template draft
- **WHEN** an admin creates a new email template with subject and body content
- **THEN** the system SHALL store the template as a draft with an initial revision

#### Scenario: Duplicate template for variant editing
- **WHEN** an admin duplicates an existing template
- **THEN** the system SHALL create a new draft template initialized with the source template content

#### Scenario: Deactivate template without deleting history
- **WHEN** an admin deactivates a template
- **THEN** the system SHALL prevent new selections of that template while preserving historical revisions and usage references

### Requirement: System validates template tokens before activation
The system SHALL validate subject/body template content against the allowed token registry before a template revision can be activated.

#### Scenario: Reject unknown token
- **WHEN** an admin attempts to activate a template revision containing an unsupported token
- **THEN** the system SHALL reject activation and return a validation error identifying the unsupported token

#### Scenario: Activate valid template revision
- **WHEN** an admin activates a template revision with only supported tokens
- **THEN** the system SHALL mark that revision as active and eligible for new send composition

### Requirement: System provides deterministic template preview
The system SHALL provide preview rendering for a selected template revision using a sample recipient/context payload.

#### Scenario: Preview resolves known tokens
- **WHEN** an admin requests preview for a template revision with a sample context
- **THEN** the system SHALL render subject and body with supported tokens resolved deterministically from that context

#### Scenario: Preview surfaces unresolved required data
- **WHEN** preview input is missing required values for supported tokens
- **THEN** the system SHALL return deterministic fallback output and explicit warnings about missing values

### Requirement: Send composition uses pinned template revisions
The system SHALL pin a specific active template revision when composing a send so subsequent template edits do not mutate in-progress or historical composition output.

#### Scenario: In-progress job remains stable after template update
- **WHEN** a send composition job starts with template revision `R1` and a newer revision `R2` is later activated
- **THEN** the in-progress job SHALL continue using `R1`

#### Scenario: New composition uses latest active revision
- **WHEN** a new send composition starts after `R2` becomes active
- **THEN** the system SHALL use `R2` unless an explicit revision override is provided
