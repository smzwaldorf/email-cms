## MODIFIED Requirements

### Requirement: Admin can manage email templates
The system SHALL allow admins to create, edit, duplicate, delete, and import reusable email templates for newsletter and personalized sends. When an imported HTML template body is accepted, the system SHALL store the resulting template with an initial or updated revision whose body content matches the preserved imported markup approved during import validation.

#### Scenario: Create a new template
- **WHEN** an admin creates a new email template with subject and body content
- **THEN** the system SHALL store the template with an initial revision

#### Scenario: Create or update a template from imported Canva HTML
- **WHEN** an admin saves a template revision using accepted imported Canva HTML as the body source
- **THEN** the system SHALL persist the template revision with the preserved imported markup as the canonical body content for that revision

#### Scenario: Duplicate template for variant editing
- **WHEN** an admin duplicates an existing template
- **THEN** the system SHALL create a new template initialized with the source template content

#### Scenario: Delete template when no longer needed
- **WHEN** an admin deletes a template
- **THEN** the system SHALL remove that template from future selection in composition workflows

### Requirement: System provides deterministic template preview
The system SHALL provide preview rendering for a selected template revision using a sample recipient/context payload, and SHALL render imported template revisions from the preserved canonical imported HTML stored on that revision.

#### Scenario: Preview resolves known tokens
- **WHEN** an admin requests preview for a template revision with a sample context
- **THEN** the system SHALL render subject and body with supported tokens resolved deterministically from that context

#### Scenario: Preview surfaces unresolved required data
- **WHEN** preview input is missing required values for supported tokens
- **THEN** the system SHALL return deterministic fallback output and explicit warnings about missing values

#### Scenario: Preview uses preserved imported HTML
- **WHEN** an admin requests preview for a template revision created from accepted Canva HTML
- **THEN** the system SHALL render preview from the preserved canonical imported HTML stored on that revision rather than a regenerated editor serialization
