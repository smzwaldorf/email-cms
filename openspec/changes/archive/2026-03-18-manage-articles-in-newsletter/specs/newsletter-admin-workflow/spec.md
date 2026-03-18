## MODIFIED Requirements

### Requirement: Admin can compose the article list for a newsletter
The system SHALL allow an admin to manage the set and order of articles within a newsletter from the newsletter management workflow, including adding, creating, editing, removing, and reordering newsletter articles while preserving newsletter context.

#### Scenario: View articles in newsletter order
- **WHEN** an admin opens a newsletter composition view
- **THEN** the system SHALL display the newsletter's articles in their current newsletter order

#### Scenario: Reorder newsletter articles
- **WHEN** an admin changes the order of articles in a newsletter
- **THEN** the system SHALL save the new newsletter order and use that order in subsequent admin and reader views

#### Scenario: Add existing draft article to newsletter composition
- **WHEN** an admin adds an existing draft article from within a newsletter composition workflow
- **THEN** the system SHALL link that article into the newsletter composition and display it in newsletter order without leaving newsletter context

#### Scenario: Create and attach a new article from newsletter context
- **WHEN** an admin creates a new article from newsletter composition actions
- **THEN** the system SHALL create the article and attach it to the current newsletter composition so the admin can continue composing the same newsletter

#### Scenario: Edit linked article without losing newsletter context
- **WHEN** an admin opens article editing from a newsletter composition workflow
- **THEN** the system SHALL return the admin to the same newsletter composition context after saving or exiting article editing

#### Scenario: Remove article from newsletter composition safely
- **WHEN** an admin removes an article from a newsletter composition
- **THEN** the system SHALL unlink the article from that newsletter composition without deleting the underlying article record by default

#### Scenario: Manage issue composition from newsletter context
- **WHEN** an admin needs to continue composing an issue
- **THEN** the system SHALL provide newsletter-context actions to add, remove, or edit articles without forcing the admin back through unrelated dashboard flows
