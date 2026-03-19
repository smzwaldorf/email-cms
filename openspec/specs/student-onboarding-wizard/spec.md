# student-onboarding-wizard Specification

## Purpose

Administrators create students through a guided, multi-step flow with per-step validation, optional family and class association (including inline family creation), and clear reporting when student creation succeeds but optional association writes fail.

## Requirements

### Requirement: Admin can create a student through a guided wizard
The system SHALL provide a multi-step wizard that guides admins through student creation, validates each step, and submits the final payload only after required fields pass validation.

#### Scenario: Step validation blocks forward navigation
- **WHEN** an admin attempts to continue from a wizard step with missing required fields
- **THEN** the system SHALL keep the admin on the same step and show field-level validation messages

#### Scenario: Successful wizard completion creates student
- **WHEN** an admin completes required steps and submits the wizard
- **THEN** the system SHALL create the student and show a success state with the created student summary

### Requirement: Wizard supports optional family and class setup
The system SHALL allow admins to optionally link a newly created student to an active family, optionally create a new family inline, and optionally create initial class enrollment during the same wizard flow.

#### Scenario: Admin skips optional association steps
- **WHEN** an admin skips family and class steps and submits the wizard
- **THEN** the system SHALL create the student without creating family or class associations

#### Scenario: Wizard applies selected optional associations
- **WHEN** an admin selects an active family and class during wizard setup
- **THEN** the system SHALL create the student and persist the selected family/class associations

#### Scenario: Wizard creates new family inline before association
- **WHEN** an admin chooses to create a new family in the wizard and provides valid family details
- **THEN** the system SHALL create the family, link the new student to that family, and use that family for optional class enrollment

#### Scenario: Class assignment deferred when family is not yet available
- **WHEN** an admin does not provide or create a family during wizard setup
- **THEN** the system SHALL allow student creation and mark class assignment as deferred/skipped

### Requirement: Wizard surfaces partial-failure outcomes clearly
The system SHALL report per-operation outcomes when student creation succeeds but optional association writes fail.

#### Scenario: Student created but family linking fails
- **WHEN** student creation succeeds and the family-link operation fails
- **THEN** the system SHALL show the student as created, mark family linking as failed, and provide retry guidance
