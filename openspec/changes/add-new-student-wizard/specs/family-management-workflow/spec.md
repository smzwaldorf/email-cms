## MODIFIED Requirements

### Requirement: Admin can manage family-child associations with integrity checks
The system SHALL allow admins to add and remove child associations for a family while enforcing referential integrity, including association requests initiated by student onboarding wizard completion.

#### Scenario: Add valid child association to family
- **WHEN** an admin links a valid child record to a family
- **THEN** the system SHALL persist the association and expose it in family detail responses

#### Scenario: Prevent association to unknown child record
- **WHEN** an admin attempts to link a child identifier that does not exist
- **THEN** the system SHALL reject the association request and return an integrity validation error

#### Scenario: Wizard links newly created student to selected active family
- **WHEN** an admin completes student onboarding wizard with a selected active family
- **THEN** the system SHALL create the family-child association for the newly created student and include it in subsequent family detail reads
