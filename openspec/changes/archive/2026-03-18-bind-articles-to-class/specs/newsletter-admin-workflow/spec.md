## MODIFIED Requirements

### Requirement: Admin can compose the article list for a newsletter
The system SHALL allow an admin to manage the set, class targeting, and order of articles within a newsletter from the newsletter management workflow.

#### Scenario: View articles in newsletter order
- **WHEN** an admin opens a newsletter composition view
- **THEN** the system SHALL display the newsletter's articles in their current newsletter order

#### Scenario: Reorder newsletter articles
- **WHEN** an admin changes the order of articles in a newsletter
- **THEN** the system SHALL save the new newsletter order and use that order in subsequent admin and reader views

#### Scenario: Manage issue composition from newsletter context
- **WHEN** an admin needs to continue composing an issue
- **THEN** the system SHALL provide newsletter-context actions to add, remove, or edit articles without forcing the admin back through unrelated dashboard flows

#### Scenario: Configure class targeting in newsletter composition
- **WHEN** an admin updates an article in newsletter composition to shared targeting or targeted class bindings
- **THEN** the system SHALL persist the targeting configuration and keep the admin in the same newsletter management context
