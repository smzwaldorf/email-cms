# family-management-workflow Specification

## Purpose

Administrators create and maintain family records for guardian contact data, child associations, validation and uniqueness of contact identifiers, non-destructive lifecycle (activate/deactivate), and list APIs that default to active families while supporting audit views.

## Requirements

### Requirement: Admin can create and update family records
The system SHALL allow admins to create and update family records containing required guardian contact and family identity fields used for personalized recipient resolution.

#### Scenario: Create family with required contact fields
- **WHEN** an admin submits a family record with required identity and guardian contact fields
- **THEN** the system SHALL create the family in active status and make it available to recipient workflows

#### Scenario: Update family metadata
- **WHEN** an admin updates editable fields on an existing family
- **THEN** the system SHALL persist the updated family details and expose them in subsequent reads

### Requirement: System validates family data and prevents duplicate contact conflicts
The system SHALL enforce required-field validation and configured uniqueness constraints for family contact identifiers.

#### Scenario: Reject missing required contact field
- **WHEN** an admin submits a family record missing a required contact field
- **THEN** the system SHALL reject the write and return field-level validation errors

#### Scenario: Reject duplicate unique contact identifier
- **WHEN** an admin attempts to create or update a family using a contact identifier already bound to another active family
- **THEN** the system SHALL reject the write with a uniqueness conflict error

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

### Requirement: Family lifecycle supports safe deactivation and reactivation
The system SHALL support deactivating and reactivating families without deleting historical relationships or send references.

#### Scenario: Deactivate family with historical send references
- **WHEN** an admin deactivates a family that appears in historical personalization/send records
- **THEN** the system SHALL mark the family inactive while preserving those historical references

#### Scenario: Reactivate previously inactive family
- **WHEN** an admin reactivates an inactive family
- **THEN** the system SHALL return the family to active availability for recipient selection workflows

### Requirement: Family listing supports active-default and include-inactive queries
The system SHALL return active families by default and allow optional retrieval of inactive records for maintenance/audit workflows.

#### Scenario: Default list returns active families
- **WHEN** a workflow requests family listings without status flags
- **THEN** the system SHALL return only active families

#### Scenario: Include-inactive query returns full status set
- **WHEN** an admin requests family listings with include-inactive enabled
- **THEN** the system SHALL return active and inactive families with lifecycle status metadata

