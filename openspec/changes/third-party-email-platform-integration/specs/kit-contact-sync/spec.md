## ADDED Requirements

### Requirement: System SHALL synchronize eligible recipients to Kit with deterministic identity mapping
The system SHALL create or update Kit subscribers for eligible guardians using a stable external identity key and SHALL synchronize configured class tags and custom fields (`child_classes`, `child_names`, `parent_type`) from local data.

#### Scenario: New eligible guardian is created in Kit
- **WHEN** an eligible guardian has no mapped Kit subscriber id and a sync job is processed
- **THEN** the system SHALL create a Kit subscriber, persist the returned external id mapping, and mark the job successful

#### Scenario: Existing subscriber metadata is updated without duplicate subscriber creation
- **WHEN** an eligible guardian already has a mapped Kit subscriber id and local class metadata changes
- **THEN** the system SHALL update tags/custom fields on the existing Kit subscriber and SHALL NOT create a second subscriber record

### Requirement: System SHALL handle outbound sync failures with bounded retries and terminal visibility
The system SHALL process outbound Kit sync jobs with retryable/non-retryable error classification, exponential backoff for retryable failures, and terminal failed state after max attempts.

#### Scenario: Rate-limit response schedules a retry
- **WHEN** Kit returns a retryable failure (including HTTP 429 or transient network timeout)
- **THEN** the system SHALL increment attempt count, compute the next retry time with exponential backoff, and keep the job in a retryable state

#### Scenario: Job exceeds retry budget
- **WHEN** a sync job reaches the configured maximum attempts without success
- **THEN** the system SHALL mark the job as failed, record the final error context, and surface it for operator follow-up/reconciliation

### Requirement: System SHALL keep sync consistency metadata for reconciliation
The system SHALL persist sync metadata required for drift detection, including last successful sync timestamp, payload fingerprint, and last known Kit-side version marker for each mapped recipient.

#### Scenario: Successful sync updates reconciliation metadata
- **WHEN** a sync job completes successfully
- **THEN** the system SHALL update the recipient mapping with fresh sync timestamp and payload fingerprint values used for future drift checks

#### Scenario: Drift detection queues re-sync
- **WHEN** reconciliation detects a mismatch between local payload fingerprint and last known Kit state marker
- **THEN** the system SHALL enqueue a new sync job for that recipient and annotate the mismatch reason
