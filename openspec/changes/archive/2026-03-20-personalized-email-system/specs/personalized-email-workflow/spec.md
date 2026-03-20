## ADDED Requirements

### Requirement: System composes personalized email content from shared and class-targeted blocks
The system SHALL build each guardian email from a combination of newsletter shared content blocks and class-targeted content blocks selected from the guardian's eligible class set.

#### Scenario: Single-child guardian receives shared and class content
- **WHEN** a guardian has one child enrolled in class `A` and newsletter `N` contains shared blocks plus class `A` blocks
- **THEN** the system SHALL compose one personalized email payload containing all shared blocks and class `A` blocks in canonical section order

#### Scenario: Guardian with no eligible class blocks still receives shared content
- **WHEN** a guardian is eligible for newsletter `N` but has no matching class-targeted blocks for that issue
- **THEN** the system SHALL still compose a valid payload containing shared blocks and deterministic class-section fallback behavior

### Requirement: System merges multi-child class content into one deterministic email per guardian
The system SHALL produce exactly one personalized email per guardian and merge all eligible class-targeted content for that guardian's children without duplicate block rendering.

#### Scenario: Multi-child guardian receives one merged email
- **WHEN** a guardian has children in classes `A` and `B` for newsletter `N`
- **THEN** the system SHALL generate one payload for that guardian that includes class `A` and class `B` content using deterministic class ordering

#### Scenario: Duplicate blocks are deduplicated by stable personalization key
- **WHEN** two eligible class sections reference blocks with the same personalization key
- **THEN** the system SHALL render that block once in the merged payload according to canonical ordering rules

### Requirement: Personalization output is deterministic for identical inputs
The system SHALL produce identical personalization output for repeated renders when newsletter revision, recipient identity, class membership snapshot, and rules version are unchanged.

#### Scenario: Repeated renders with same inputs are identical
- **WHEN** the system renders payloads twice for the same guardian using the same newsletter revision, class membership snapshot, and rules version
- **THEN** both payloads SHALL match exactly in block order, content selection, and personalization metadata

#### Scenario: Rules version change is explicit in output metadata
- **WHEN** personalization logic changes to a new rules version
- **THEN** the system SHALL include the new rules version identifier in each generated payload

### Requirement: Personalization uses a consistent membership snapshot during render
The system SHALL resolve recipient eligibility and class memberships from a single render-time snapshot to prevent in-flight data drift from changing payload composition mid-render.

#### Scenario: Membership changes after render start do not alter in-progress composition
- **WHEN** a guardian-child class association changes after render processing has begun
- **THEN** the in-progress payload SHALL continue using the membership snapshot captured at render start

#### Scenario: New render reflects latest membership snapshot
- **WHEN** a subsequent render starts after membership data changes
- **THEN** the new payload SHALL use the latest snapshot and recompute eligible class content deterministically
