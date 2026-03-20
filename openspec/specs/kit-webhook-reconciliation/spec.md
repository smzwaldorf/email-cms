# kit-webhook-reconciliation Specification

## Purpose

Inbound Kit webhook handling: authenticity validation before processing, idempotent deduplication, reconciliation of local subscription eligibility with Kit lifecycle events (subscribe, unsubscribe, profile updates), auditable transition history, and retry/terminal failure visibility for operators.

## Requirements

### Requirement: System SHALL authenticate inbound Kit webhooks before processing
The system SHALL validate each inbound webhook using configured provider authenticity controls and SHALL reject requests that fail validation.

#### Scenario: Valid webhook is accepted
- **WHEN** a webhook request contains a valid signature/token according to configured Kit webhook verification rules
- **THEN** the system SHALL persist the event envelope and continue to idempotent processing

#### Scenario: Invalid webhook is rejected
- **WHEN** a webhook request fails signature/token verification
- **THEN** the system SHALL reject the request, avoid mutating subscription state, and log the validation failure reason

### Requirement: System SHALL process webhook events idempotently
The system SHALL deduplicate webhook events using provider event identity (or derived idempotency key + payload hash) and SHALL ensure repeated deliveries do not produce repeated side effects.

#### Scenario: Duplicate delivery is ignored after first success
- **WHEN** the same webhook event is delivered again after successful processing
- **THEN** the system SHALL detect the duplicate event idempotency key and skip state mutation while returning a successful acknowledgment

#### Scenario: Previously failed event can be retried safely
- **WHEN** a webhook event previously failed before applying side effects and is redelivered
- **THEN** the system SHALL resume processing for that event key without creating duplicate audit records or conflicting state transitions

### Requirement: System SHALL reconcile local subscription eligibility with webhook lifecycle events
The system SHALL update local recipient subscription state from Kit lifecycle events (subscribe, unsubscribe, profile updates) and SHALL preserve an auditable transition history.

#### Scenario: Unsubscribe event disables local send eligibility
- **WHEN** a valid unsubscribe webhook is processed for a mapped guardian subscriber
- **THEN** the system SHALL mark the local subscription status as unsubscribed and exclude that recipient from future sends until a valid resubscribe event is processed

#### Scenario: Unknown subscriber event is queued for reconciliation
- **WHEN** a valid webhook references a subscriber that has no local mapping
- **THEN** the system SHALL record the event as unresolved and queue a reconciliation task instead of dropping the event silently

### Requirement: System SHALL surface webhook processing failures with retry state
The system SHALL record webhook processing attempts, classify retryability, and transition events to a terminal failed state when retries are exhausted.

#### Scenario: Retryable processing error schedules reprocessing
- **WHEN** a webhook event processing attempt fails due to transient dependency failure
- **THEN** the system SHALL increment attempt count, schedule the next processing attempt with backoff, and retain event payload for replay

#### Scenario: Exhausted retries mark event failed
- **WHEN** a webhook event reaches the maximum processing attempts without success
- **THEN** the system SHALL mark the event as failed and expose the failure details for operator intervention
