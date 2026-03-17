## ADDED Requirements

### Requirement: System SHALL provide dashboard-ready engagement metrics by campaign, class, and period
The system SHALL compute and expose aggregated analytics metrics (send count, unique opens, open rate, unique clicks, click-through rate, unsubscribe rate) with filtering by newsletter campaign, class segment, and date range.

#### Scenario: Operator views campaign analytics
- **WHEN** an operator requests metrics for a selected campaign/date range
- **THEN** the system SHALL return aggregated raw and qualified KPI values with calculation timestamps and metric rule-version metadata

#### Scenario: Requested segment has no events
- **WHEN** an operator requests metrics for a class/date segment with no qualifying events
- **THEN** the system SHALL return zero-valued metrics with explicit empty-state metadata instead of failing the request

### Requirement: System SHALL maintain freshness metadata for analytics queries
The system SHALL expose freshness indicators (last ingestion time, last rollup time, reconciliation lag state) with dashboard metric responses.

#### Scenario: Fresh rollup status is available
- **WHEN** the latest aggregation job completed within configured freshness SLA
- **THEN** the system SHALL mark analytics output as current and include the last successful rollup timestamp

#### Scenario: Analytics data is stale
- **WHEN** rollup lag exceeds configured freshness thresholds
- **THEN** the system SHALL mark analytics output as stale and provide lag metadata for operator awareness

### Requirement: System SHALL generate filterable report exports with auditability
The system SHALL support asynchronous report export jobs (CSV and spreadsheet-compatible format) that honor the same filtering scope as dashboards and produce auditable job metadata.

#### Scenario: Export job completes successfully
- **WHEN** an authorized operator requests an export with valid filters
- **THEN** the system SHALL create an export job record, generate the output artifact, and mark the job completed with file metadata and requester audit fields

#### Scenario: Export job fails during generation
- **WHEN** export generation fails due to dependency or processing error
- **THEN** the system SHALL mark the export job as failed, persist failure context, and expose retry eligibility to operators

### Requirement: System SHALL enforce privacy-safe report field policies
The system SHALL restrict export/report fields according to role and data-governance policy, including default minimization of personally identifiable data.

#### Scenario: Standard operator receives minimized data fields
- **WHEN** a non-admin operator generates or views analytics reports
- **THEN** the system SHALL include only policy-approved summarized fields and exclude restricted personal identifiers

#### Scenario: Unauthorized field request is blocked
- **WHEN** a request includes fields outside the caller's policy scope
- **THEN** the system SHALL reject the request and record an authorization-policy violation event

### Requirement: System SHALL reconcile local metrics with provider-side engagement sources
The system SHALL compare local aggregated metrics against configured provider-side counters/events and queue corrective backfills for significant drift.

#### Scenario: Drift threshold exceeded
- **WHEN** reconciliation detects divergence beyond configured tolerance between local and provider engagement totals
- **THEN** the system SHALL create a reconciliation discrepancy record and enqueue backfill/recompute tasks

#### Scenario: Reconciliation confirms convergence
- **WHEN** local and provider metrics are within tolerance after backfill
- **THEN** the system SHALL close the discrepancy and record reconciliation completion metadata
