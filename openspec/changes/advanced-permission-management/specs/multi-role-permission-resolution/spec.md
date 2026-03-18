## ADDED Requirements

### Requirement: System SHALL resolve effective permissions deterministically for multi-role users
The system SHALL evaluate authorization requests for users with multiple roles using a deterministic precedence model (`Admin > Teacher > Parent > Student`) and action-level highest-grant semantics.

#### Scenario: Dual-role user receives deterministic permission result
- **WHEN** a user has both teacher and parent roles and attempts an action
- **THEN** the system SHALL return the same grant/deny result for identical inputs regardless of query or processing order

#### Scenario: Higher-precedence role grant wins for an action
- **WHEN** two assigned roles produce different grants for the same action within scope
- **THEN** the system SHALL apply the grant from the highest-precedence role that is valid for the evaluated scope

### Requirement: System SHALL apply deterministic scope resolution for class-based access
The system SHALL resolve class scope using explicit union rules for visibility and role-constrained eligibility rules for write actions.

#### Scenario: Multi-class family visibility remains stable
- **WHEN** a dual-role user is related to multiple classes through children and teaching assignments
- **THEN** the system SHALL produce a stable, deduplicated class visibility set in canonical order

#### Scenario: Write action denied outside eligible class scope
- **WHEN** a user attempts a write action in a class not granted by the resolved write-eligible scope
- **THEN** the system SHALL deny the action even if the user has broader read visibility in other classes

### Requirement: System SHALL return explainable authorization outcomes for admin diagnostics
The system SHALL include decision rationale metadata for each authorization evaluation, including winning role, evaluated scope, and policy version.

#### Scenario: Denied action includes diagnostic rationale
- **WHEN** an authorization request is denied
- **THEN** the system SHALL provide a structured denial reason that identifies missing grant or out-of-scope conditions

#### Scenario: Granted action includes policy trace metadata
- **WHEN** an authorization request is granted
- **THEN** the system SHALL record decision metadata containing winning role, scope source, and rule version for audit and troubleshooting
