## MODIFIED Requirements

### Requirement: System SHALL synchronize eligible recipients to Kit with deterministic identity mapping
The system SHALL create or update Kit subscribers for eligible guardians using a stable external identity key and SHALL synchronize configured class tags and custom fields (`child_classes`, `child_names`, `parent_type`) from local data, and SHALL consume delivery handoff recipients only from preparation outputs marked ready.

#### Scenario: New eligible guardian is created in Kit
- **WHEN** an eligible guardian has no mapped Kit subscriber id and a sync job is processed from ready delivery handoff input
- **THEN** the system SHALL create a Kit subscriber, persist the returned external id mapping, and mark the job successful.

#### Scenario: Existing subscriber metadata is updated without duplicate subscriber creation
- **WHEN** an eligible guardian already has a mapped Kit subscriber id and local class metadata changes
- **THEN** the system SHALL update tags/custom fields on the existing Kit subscriber and SHALL NOT create a second subscriber record.

#### Scenario: Failed preparation recipients are excluded from Kit send path
- **WHEN** preparation marks a recipient as failed for the batch
- **THEN** the system SHALL preserve that failed recipient for correction and SHALL NOT enqueue that recipient into the Kit-bound send path.
