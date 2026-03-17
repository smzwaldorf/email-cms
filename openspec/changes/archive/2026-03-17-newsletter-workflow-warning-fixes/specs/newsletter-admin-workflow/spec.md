## ADDED Requirements

### Requirement: Admin workflow proves lifecycle transitions within newsletter management
The system SHALL allow an admin to complete newsletter lifecycle transitions from the newsletter management workflow with user-visible state updates that reflect the new lifecycle state.

#### Scenario: Archive becomes available after publish from management workflow
- **WHEN** an admin publishes a valid draft newsletter from the newsletter management page
- **THEN** the system SHALL refresh the page state so the newsletter shows as published and exposes the archive action in the same workflow

#### Scenario: Archive completes within newsletter management workflow
- **WHEN** an admin archives a published newsletter from the newsletter management page
- **THEN** the system SHALL show the archived state and remove publish/archive actions that no longer apply

### Requirement: Admin workflow handles special-edition newsletters with the same management affordances
The system SHALL provide the same newsletter management workflow for newsletters addressed only by ID, including metadata editing, article composition actions, lifecycle visibility, and public-link behavior.

#### Scenario: Open special-edition newsletter management by ID
- **WHEN** an admin opens a special-edition newsletter that has no `week_number`
- **THEN** the system SHALL load the newsletter by ID and display the newsletter management workflow without redirecting to a week-based route

#### Scenario: Public link uses newsletter ID for special editions
- **WHEN** an admin views a published special-edition newsletter in the management workflow
- **THEN** the system SHALL expose the public newsletter link using the newsletter-ID route rather than a week-based route
