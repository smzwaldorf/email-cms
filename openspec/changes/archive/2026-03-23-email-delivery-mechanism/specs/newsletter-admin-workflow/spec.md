## MODIFIED Requirements

### Requirement: Admin can manage newsletter lifecycle from draft to archive
The system SHALL provide newsletter-level lifecycle actions and validation for draft, published, and archived states, and SHALL treat a successful publish action as the start of newsletter delivery to all eligible families by default unless the admin explicitly narrows the audience before confirmation.

#### Scenario: Publish-ready validation
- **WHEN** an admin attempts to publish a newsletter
- **THEN** the system SHALL validate newsletter-level publish requirements and show blocking issues before or during the publish action

#### Scenario: Publish defaults to send all eligible families
- **WHEN** an admin publishes a valid draft newsletter without changing the audience selection
- **THEN** the system SHALL change the newsletter state to published, make the issue available through its existing public route, and start delivery for all eligible families

#### Scenario: Publish can narrow the delivery audience
- **WHEN** an admin publishes a valid draft newsletter after narrowing the audience to selected classes, selected families, or one family
- **THEN** the system SHALL change the newsletter state to published, make the issue available through its existing public route, and start delivery only for the selected eligible audience

#### Scenario: Archive a published newsletter
- **WHEN** an admin archives a published newsletter
- **THEN** the system SHALL mark the newsletter as archived without deleting its historical content
