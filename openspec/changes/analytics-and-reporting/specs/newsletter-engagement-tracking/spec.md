## ADDED Requirements

### Requirement: System SHALL capture newsletter open events via tracking pixel with deterministic attribution
The system SHALL expose a tracking pixel endpoint that records open events with newsletter-send attribution fields (newsletter id, recipient mapping id, class/family context, campaign/send id, timestamp, user-agent context) before returning the pixel response.

#### Scenario: Valid pixel request records open event
- **WHEN** a tracking pixel request contains a valid tracking token for a sent newsletter recipient
- **THEN** the system SHALL persist an open engagement event with normalized attribution fields and return a successful pixel response

#### Scenario: Invalid tracking token does not create engagement record
- **WHEN** a tracking pixel request contains an expired, malformed, or unknown token
- **THEN** the system SHALL reject attribution, avoid mutating engagement metrics, and return a non-success tracking response consistent with security policy

### Requirement: System SHALL capture newsletter click events through tracked redirect links
The system SHALL route tracked links through a click endpoint that records click engagement data (including article attribution when present) and then redirects to the destination URL.

#### Scenario: Valid tracked link records click and redirects
- **WHEN** a recipient follows a valid tracked redirect link
- **THEN** the system SHALL persist a click engagement event with link/newsletter/recipient attribution (plus `article_id` when available) and redirect the user to the resolved target URL

#### Scenario: Redirect target fails validation
- **WHEN** a tracked link resolves to a disallowed destination based on URL safety policy
- **THEN** the system SHALL block redirect completion, record a validation failure event, and avoid counting the request as a successful click metric

### Requirement: System SHALL enforce idempotent engagement ingestion
The system SHALL deduplicate repeated open/click requests using deterministic idempotency keys so duplicate deliveries do not inflate metrics.

#### Scenario: Duplicate open request does not double-count
- **WHEN** the same open tracking request is received multiple times with equivalent idempotency attributes
- **THEN** the system SHALL retain one canonical engagement event for metric aggregation and mark later deliveries as duplicates

#### Scenario: Duplicate click request after successful capture
- **WHEN** a click request with an already-processed idempotency key is received
- **THEN** the system SHALL acknowledge the request flow without creating an additional counted click event

### Requirement: System SHALL classify raw and qualified engagement outcomes
The system SHALL preserve raw engagement events and assign quality classification metadata used to derive qualified metrics.

#### Scenario: Scanner traffic is excluded from qualified metrics
- **WHEN** an engagement event matches configured scanner/bot heuristics
- **THEN** the system SHALL keep the event in raw storage and mark it as excluded from qualified KPI rollups

#### Scenario: Human-eligible event contributes to qualified metrics
- **WHEN** an engagement event passes qualification heuristics
- **THEN** the system SHALL mark the event as qualified and include it in dashboard/report KPI aggregations

### Requirement: System SHALL reconcile engagement gaps against expected sends
The system SHALL detect missing or drifted engagement attribution relative to expected send records and queue reconciliation actions.

#### Scenario: Missing attribution is flagged for reconciliation
- **WHEN** expected send records exist but engagement events cannot be attributed due to mapping drift
- **THEN** the system SHALL record a discrepancy and queue a reconciliation task with mismatch context

#### Scenario: Reconciliation restores attribution consistency
- **WHEN** reconciliation finds a recoverable mapping for unresolved events
- **THEN** the system SHALL update event attribution links and mark the discrepancy as resolved
