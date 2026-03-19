## ADDED Requirements

### Requirement: Admin can create a student through a guided wizard
The system SHALL provide a multi-step wizard that guides admins through student creation, validates each step, and submits the final payload only after required fields pass validation.

#### Scenario: Step validation blocks forward navigation
- **WHEN** an admin attempts to continue from a wizard step with missing required fields
- **THEN** the system SHALL keep the admin on the same step and show field-level validation messages

#### Scenario: Successful wizard completion creates student
- **WHEN** an admin completes required steps and submits the wizard
- **THEN** the system SHALL create the student and show a success state with the created student summary

### Requirement: Wizard supports optional family and class setup
The system SHALL allow admins to optionally link a newly created student to an active family and optionally create initial class enrollment during the same wizard flow.

#### Scenario: Admin skips optional association steps
- **WHEN** an admin skips family and class steps and submits the wizard
- **THEN** the system SHALL create the student without creating family or class associations

#### Scenario: Wizard applies selected optional associations
- **WHEN** an admin selects an active family and class during wizard setup
- **THEN** the system SHALL create the student and persist the selected family/class associations

### Requirement: Wizard surfaces partial-failure outcomes clearly
The system SHALL report per-operation outcomes when student creation succeeds but optional association writes fail.

#### Scenario: Student created but family linking fails
- **WHEN** student creation succeeds and the family-link operation fails
- **THEN** the system SHALL show the student as created, mark family linking as failed, and provide retry guidance
