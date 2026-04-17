## MODIFIED Requirements

### Requirement: System prepares send-ready email payloads from pinned inputs
The system SHALL create a preparation job that composes send-ready recipient payloads using pinned references to newsletter content revision, template revision, and recipient membership snapshot. When the pinned template revision was created from accepted imported Canva HTML, the system SHALL render recipient payloads from the preserved canonical imported HTML stored on that revision.

#### Scenario: Preparation job captures immutable input references
- **WHEN** an admin starts email-content preparation for newsletter `N`
- **THEN** the system SHALL persist a preparation job with immutable references to the selected content revision, template revision, and recipient snapshot

#### Scenario: Re-run with same pinned inputs is deterministic
- **WHEN** the system prepares content twice with identical pinned input references and rules version
- **THEN** the prepared payloads and preparation metadata SHALL match exactly for each recipient

#### Scenario: Imported template revision is replayed exactly
- **WHEN** a preparation job pins a template revision created from accepted Canva HTML
- **THEN** the system SHALL compose each recipient payload from the preserved canonical imported HTML stored on that revision and SHALL NOT substitute regenerated editor HTML for that revision

### Requirement: System validates required content and token resolution before handoff
The system SHALL validate each prepared payload for required sections, supported token usage, mandatory resolved values, and compatibility with the pinned imported template revision before marking it ready for delivery handoff.

#### Scenario: Invalid token usage blocks recipient payload readiness
- **WHEN** a prepared payload contains unsupported or malformed template tokens
- **THEN** the system SHALL mark that recipient payload as failed validation with explicit error details

#### Scenario: Missing required section is reported during preparation
- **WHEN** required email sections are missing after composition for a recipient
- **THEN** the system SHALL emit a validation error for that recipient and exclude it from ready-to-send output

#### Scenario: Pinned imported template revision is incompatible
- **WHEN** a preparation job references an imported template revision whose stored canonical HTML no longer satisfies import compatibility rules
- **THEN** the system SHALL mark affected recipient payloads as failed validation and report the template revision as incompatible for handoff
