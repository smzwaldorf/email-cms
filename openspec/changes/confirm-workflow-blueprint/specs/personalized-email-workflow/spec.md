## MODIFIED Requirements

### Requirement: Personalization output is deterministic for identical inputs
The system SHALL produce identical personalization output for repeated renders when newsletter revision, recipient identity, class membership snapshot, template revision, and rules version are unchanged, and SHALL expose readiness status per recipient for delivery handoff decisions.

#### Scenario: Repeated renders with same inputs are identical
- **WHEN** the system renders payloads twice for the same guardian using the same newsletter revision, class membership snapshot, template revision, and rules version
- **THEN** both payloads SHALL match exactly in block order, content selection, and personalization metadata.

#### Scenario: Rules version change is explicit in output metadata
- **WHEN** personalization logic changes to a new rules version
- **THEN** the system SHALL include the new rules version identifier in each generated payload.

#### Scenario: Non-ready recipients are excluded from delivery handoff input
- **WHEN** personalization/validation marks a recipient as warning or failed for the current policy
- **THEN** the system SHALL mark that recipient as non-ready in preparation output and SHALL NOT include that payload in ready delivery handoff input.

## ADDED Requirements

### Requirement: System SHALL provide recipient-level review outputs for send decisions
The system SHALL produce review outputs with ready, warning, and failed counts plus recipient-level validation findings for operator review before send handoff.

#### Scenario: Review summary is available after preparation
- **WHEN** preparation completes for a batch
- **THEN** the system SHALL return a summary containing counts for ready, warning, and failed recipients with actionable error details.

#### Scenario: Recipient preview includes findings
- **WHEN** an operator requests a recipient preview from a completed preparation job
- **THEN** the system SHALL return prepared subject/body with that recipient's validation findings and readiness status.
