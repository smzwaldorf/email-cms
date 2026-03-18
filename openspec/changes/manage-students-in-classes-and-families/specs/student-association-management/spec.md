## ADDED Requirements

### Requirement: Admin can create and update student records
The system SHALL allow admins to create and update student records with required identity fields used for class and family association workflows.

#### Scenario: Create active student with required fields
- **WHEN** an admin submits a student record with all required identity fields
- **THEN** the system SHALL create the student in active status and expose it in active student listings

#### Scenario: Update student metadata
- **WHEN** an admin updates editable metadata for an existing student
- **THEN** the system SHALL persist the changes and return updated student details in subsequent reads

### Requirement: System validates student identity and prevents duplicate active records
The system SHALL enforce required-field validation and configured uniqueness constraints for student identity keys.

#### Scenario: Reject missing required student field
- **WHEN** an admin submits a student record missing a required identity field
- **THEN** the system SHALL reject the write with field-level validation errors

#### Scenario: Reject duplicate active student identity
- **WHEN** an admin attempts to create or update a student using an identity key that conflicts with another active student
- **THEN** the system SHALL reject the write with a uniqueness conflict error

### Requirement: Admin can manage student-class enrollment associations with integrity checks
The system SHALL allow adding and removing student-class enrollments while enforcing that each referenced student and class exists.

#### Scenario: Add valid student-class enrollment
- **WHEN** an admin links an existing student to an existing class
- **THEN** the system SHALL persist the enrollment association and expose it in student and class enrollment views

#### Scenario: Reject enrollment for unknown class
- **WHEN** an admin attempts to enroll a student into a class that does not exist
- **THEN** the system SHALL reject the association request with referential integrity validation errors

### Requirement: Admin can manage student-family associations with integrity checks
The system SHALL allow linking and unlinking students to family records while enforcing referential integrity.

#### Scenario: Link student to an existing family
- **WHEN** an admin links a student to a valid family record
- **THEN** the system SHALL persist the student-family association and expose it in family and student detail views

#### Scenario: Reject link to unknown family
- **WHEN** an admin attempts to link a student to a family identifier that does not exist
- **THEN** the system SHALL reject the association request with integrity validation errors

### Requirement: Student lifecycle supports safe deactivation and reactivation
The system SHALL support student deactivation/reactivation without deleting historical class/family associations or historical send references.

#### Scenario: Deactivate student with historical personalization usage
- **WHEN** an admin deactivates a student referenced by historical personalization/send data
- **THEN** the system SHALL mark the student inactive while preserving historical references

#### Scenario: Reactivate previously inactive student
- **WHEN** an admin reactivates an inactive student
- **THEN** the system SHALL return the student to active availability for enrollment and recipient workflows

### Requirement: Student listing supports active-default retrieval with include-inactive option
The system SHALL return active students by default and allow optional inclusion of inactive students for maintenance workflows.

#### Scenario: Default student list excludes inactive records
- **WHEN** a workflow requests student listings without status flags
- **THEN** the system SHALL return only active students

#### Scenario: Include-inactive query returns both statuses
- **WHEN** an admin requests student listings with include-inactive enabled
- **THEN** the system SHALL return active and inactive students with lifecycle status metadata
