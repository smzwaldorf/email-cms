## ADDED Requirements

### Requirement: System SHALL provide an admin workflow to manage user roles and class restrictions
The system SHALL provide an admin interface for assigning/removing roles and editing class-level access restrictions for eligible users, with validation that prevents invalid or ambiguous configurations.

#### Scenario: Admin updates a user's role set and class restrictions
- **WHEN** an admin submits role and class restriction changes for a user
- **THEN** the system SHALL validate the request, persist the new configuration, and return the updated effective-permission summary

#### Scenario: Validation blocks invalid permission configuration
- **WHEN** an admin submits a permission change that violates policy constraints
- **THEN** the system SHALL reject the change, preserve the previous configuration, and return actionable validation errors

### Requirement: System SHALL support safe bulk permission updates
The system SHALL support batch permission changes across multiple users with a mandatory preview step that shows impacted users and effective-permission diffs before apply.

#### Scenario: Bulk update preview shows permission impact
- **WHEN** an admin prepares a bulk permission update
- **THEN** the system SHALL generate a preview containing per-user before/after effective permissions and any blocking validation issues

#### Scenario: Bulk apply commits validated updates only
- **WHEN** an admin confirms a validated bulk update
- **THEN** the system SHALL apply the permitted changes, report per-user outcomes, and capture an auditable operation record

### Requirement: System SHALL expose access-control audit visibility in admin workflows
The system SHALL provide access-control logs that include permission mutation history and authorization decision traces with actor, target, change context, and timestamp metadata.

#### Scenario: Admin inspects permission mutation history for a user
- **WHEN** an admin opens access logs for a specific user
- **THEN** the system SHALL show chronological permission change events with actor identity and before/after summaries

#### Scenario: Admin filters authorization decision traces
- **WHEN** an admin filters logs by action, role, or date range
- **THEN** the system SHALL return matching decision-trace records with resolution rationale and policy version
