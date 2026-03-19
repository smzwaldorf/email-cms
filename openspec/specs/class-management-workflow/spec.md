# class-management-workflow Specification

## Purpose

Administrators create and maintain the class catalog: identity validation, uniqueness, non-destructive lifecycle (activate/deactivate), and list APIs that default to active classes while supporting full audit views.

## Requirements

### Requirement: Admin can create and update class records
The system SHALL allow an admin to create and update class records with required identity fields needed for downstream targeting workflows.

#### Scenario: Create class with required fields
- **WHEN** an admin submits a class with all required identity fields
- **THEN** the system SHALL create the class in active state and return it in class listings

#### Scenario: Update class metadata
- **WHEN** an admin edits mutable class fields for an existing class
- **THEN** the system SHALL persist updates and expose the latest class details to dependent workflows

### Requirement: System enforces class identity validation and uniqueness
The system SHALL validate class records and reject writes that violate required field rules or uniqueness constraints for class identity keys.

#### Scenario: Reject duplicate class code
- **WHEN** an admin attempts to create or update a class using a class code already assigned to another class
- **THEN** the system SHALL reject the write with a uniqueness validation error

#### Scenario: Reject missing required class identity fields
- **WHEN** an admin submits a class form without required identity fields
- **THEN** the system SHALL reject the write and return field-level validation errors

### Requirement: Admin can manage class lifecycle without destructive deletion
The system SHALL support class activation and deactivation while preserving historical references to class records.

#### Scenario: Deactivate class with existing historical usage
- **WHEN** an admin deactivates a class already referenced by historical newsletter or recipient data
- **THEN** the system SHALL mark the class inactive without deleting prior references

#### Scenario: Reactivate previously inactive class
- **WHEN** an admin reactivates an inactive class
- **THEN** the system SHALL return the class to active availability for dependent workflows

### Requirement: Class listings support dependent workflow filtering
The system SHALL provide class listing behavior that defaults to active classes while allowing optional retrieval of inactive classes for audit or maintenance workflows.

#### Scenario: Default list shows active classes only
- **WHEN** a dependent workflow requests classes without explicit status filters
- **THEN** the system SHALL return only active classes

#### Scenario: Admin requests full class list including inactive
- **WHEN** an admin requests class listings with include-inactive enabled
- **THEN** the system SHALL return both active and inactive classes with lifecycle status metadata
