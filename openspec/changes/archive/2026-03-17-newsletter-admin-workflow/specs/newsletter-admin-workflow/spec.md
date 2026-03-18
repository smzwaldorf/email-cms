## ADDED Requirements

### Requirement: Admin can manage newsletter metadata
The system SHALL provide an admin workflow to create and update newsletter metadata for draft newsletters, including release date and identifiers needed for weekly newsletters or special editions.

#### Scenario: Create a weekly newsletter draft
- **WHEN** an admin creates a newsletter with a valid `week_number` and release date
- **THEN** the system creates a draft newsletter and returns the admin to a newsletter management workflow for that issue

#### Scenario: Create a special edition draft
- **WHEN** an admin creates a newsletter without a `week_number`
- **THEN** the system SHALL create a draft special-edition newsletter that can still be managed through the same admin workflow

#### Scenario: Update newsletter metadata
- **WHEN** an admin edits the metadata of a draft newsletter
- **THEN** the system SHALL persist the updated metadata without changing the public URL behavior of already published newsletters

### Requirement: Admin can compose the article list for a newsletter
The system SHALL allow an admin to manage the set and order of articles within a newsletter from the newsletter management workflow.

#### Scenario: View articles in newsletter order
- **WHEN** an admin opens a newsletter composition view
- **THEN** the system SHALL display the newsletter's articles in their current newsletter order

#### Scenario: Reorder newsletter articles
- **WHEN** an admin changes the order of articles in a newsletter
- **THEN** the system SHALL save the new newsletter order and use that order in subsequent admin and reader views

#### Scenario: Manage issue composition from newsletter context
- **WHEN** an admin needs to continue composing an issue
- **THEN** the system SHALL provide newsletter-context actions to add, remove, or edit articles without forcing the admin back through unrelated dashboard flows

### Requirement: Admin can create a newsletter from an existing issue template
The system SHALL provide a template-copy workflow that creates a new draft newsletter from an existing newsletter.

#### Scenario: Copy previous issue into a new draft
- **WHEN** an admin starts a new newsletter from an existing issue template
- **THEN** the system SHALL create a new draft newsletter with copied newsletter composition suitable for editing

#### Scenario: Template copy does not mutate source issue content
- **WHEN** an admin edits articles in a newsletter created from a template
- **THEN** the system SHALL preserve the source newsletter and its article content unchanged

### Requirement: Admin can manage newsletter lifecycle from draft to archive
The system SHALL provide newsletter-level lifecycle actions and validation for draft, published, and archived states.

#### Scenario: Publish-ready validation
- **WHEN** an admin attempts to publish a newsletter
- **THEN** the system SHALL validate newsletter-level publish requirements and show blocking issues before or during the publish action

#### Scenario: Publish a composed newsletter
- **WHEN** an admin publishes a valid draft newsletter
- **THEN** the system SHALL change the newsletter state to published and make the issue available through its existing public route

#### Scenario: Archive a published newsletter
- **WHEN** an admin archives a published newsletter
- **THEN** the system SHALL mark the newsletter as archived without deleting its historical content

### Requirement: Admin workflow supports weekly newsletters and special editions consistently
The system SHALL provide a unified admin workflow for newsletters with `week_number` and newsletters managed only by ID.

#### Scenario: Navigate weekly newsletter management
- **WHEN** an admin opens a week-based newsletter from the dashboard
- **THEN** the system SHALL route the admin into the newsletter management workflow using the newsletter's weekly identifier where applicable

#### Scenario: Navigate special-edition newsletter management
- **WHEN** an admin opens a special-edition newsletter from the dashboard
- **THEN** the system SHALL route the admin into the same newsletter management workflow using the newsletter ID when no `week_number` exists
