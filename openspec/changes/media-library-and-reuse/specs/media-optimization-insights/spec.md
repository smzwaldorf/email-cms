## ADDED Requirements

### Requirement: System SHALL generate and store media optimization variants
The system SHALL generate configured optimization variants for uploaded media (including image thumbnails and WebP derivatives, plus audio conversion when required) and persist variant metadata with readiness status.

#### Scenario: Image upload creates thumbnail and WebP variants
- **WHEN** an editor uploads an image eligible for optimization
- **THEN** the system SHALL enqueue and produce configured thumbnail widths and a WebP variant linked to the original media asset

#### Scenario: Variant processing failure is visible
- **WHEN** variant generation fails for an uploaded media asset
- **THEN** the system SHALL mark variant status as failed and expose retry/error state without deleting the original asset

### Requirement: System SHALL expose optimization and usage summaries in a media dashboard
The system SHALL provide a media dashboard with storage utilization, media-type distribution, and top-used media rankings derived from authoritative media and usage records.

#### Scenario: Operator views storage and distribution metrics
- **WHEN** an operator opens the media dashboard
- **THEN** the system SHALL display current storage totals and media-type distribution based on persisted media metadata

#### Scenario: Operator views top-used assets
- **WHEN** an operator opens the media usage ranking section
- **THEN** the system SHALL show media assets ordered by active usage count with stable tie-breaking rules

### Requirement: System SHALL provide an unused-media cleanup list aligned with safe-deletion logic
The system SHALL provide an unused-media list based on zero active references and SHALL only allow cleanup actions that pass the same deletion safety checks used elsewhere.

#### Scenario: Unused list includes only zero-reference assets
- **WHEN** the dashboard generates cleanup candidates
- **THEN** the system SHALL include only assets that have no active usage references

#### Scenario: Cleanup action re-validates before delete
- **WHEN** an operator triggers deletion from the unused-media list
- **THEN** the system SHALL re-run in-use validation and block deletion if new references appeared since list generation
