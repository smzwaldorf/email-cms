## MODIFIED Requirements

### Requirement: System SHALL synchronize eligible recipients to Kit with deterministic identity mapping

The system SHALL create or update Kit subscribers for eligible guardians using a stable external identity key and SHALL synchronize configured class tags, stable custom fields (`child_classes`, `child_names`, `parent_type`), identity merge fields (`first_name`, `last_name`), and newsletter-scoped merge property fields required by the selected campaign from local data. The system SHALL consume delivery handoff recipients only from preparation outputs marked ready, and SHALL preserve the preparation payload as the source of truth for all newsletter-scoped merge properties.

#### Scenario: New eligible guardian is created in Kit

- **WHEN** an eligible guardian has no mapped Kit subscriber id and a sync job is processed from ready delivery handoff input
- **THEN** the system SHALL create a Kit subscriber, persist the returned external id mapping, synchronize stable identity and household fields, and mark the job successful.

#### Scenario: Existing subscriber metadata is updated without duplicate subscriber creation

- **WHEN** an eligible guardian already has a mapped Kit subscriber id and local class metadata changes
- **THEN** the system SHALL update tags/custom fields on the existing Kit subscriber and SHALL NOT create a second subscriber record.

#### Scenario: Failed preparation recipients are excluded from Kit send path

- **WHEN** preparation marks a recipient as failed for the batch
- **THEN** the system SHALL preserve that failed recipient for correction and SHALL NOT enqueue that recipient into the Kit-bound send path.

#### Scenario: Ready recipient receives identity merge fields

- **WHEN** ready recipient `G-1` has first name `Mei` and last name `Chen`
- **THEN** the system SHALL sync Kit merge fields `first_name=Mei` and `last_name=Chen` for the mapped subscriber before campaign send readiness is granted.

## ADDED Requirements

### Requirement: System SHALL sync newsletter-scoped class article merge properties to Kit

The system SHALL sync newsletter-scoped merge properties for each ready recipient that contain the CMS-prepared class-dependent article excerpt sets required by the newsletter campaign template. These properties SHALL be namespaced by delivery batch or campaign, SHALL be derived from pinned preparation output, and SHALL include a payload fingerprint for idempotent retry and reconciliation.

#### Scenario: Single-child recipient receives class article excerpts

- **WHEN** ready recipient `G-1` belongs to class `oak` and preparation output for newsletter `N-2026-04` contains two `oak` article excerpts
- **THEN** the system SHALL sync a newsletter-scoped Kit merge property for `G-1` containing exactly those two `oak` excerpts in prepared order

#### Scenario: Multi-class recipient receives merged excerpt set

- **WHEN** ready recipient `G-2` belongs to classes `oak` and `willow` and preparation output contains class article excerpts for both classes
- **THEN** the system SHALL sync one recipient property payload containing the `oak` and `willow` excerpt sets in canonical class order

##### Example: recipient property payloads

| Recipient | Prepared classes | Synced newsletter-scoped property content |
| --------- | ---------------- | ----------------------------------------- |
| G-1 | oak | oak excerpts only |
| G-2 | oak, willow | oak excerpts followed by willow excerpts |
| G-3 | none | empty class excerpt set with shared identity fields |

#### Scenario: Changed prepared content creates a new payload fingerprint

- **WHEN** the CMS updates the prepared excerpt text for recipient `G-1` in a new preparation run
- **THEN** the system SHALL compute a new merge property payload fingerprint and SHALL enqueue a Kit property re-sync for `G-1`

### Requirement: System SHALL support one Kit campaign with per-recipient CMS personalization

The system SHALL allow a newsletter to use one Kit campaign audience for all successfully synced ready recipients while relying on recipient-level Kit merge properties for personalized values such as first name, last name, and CMS-prepared class article excerpt sets. The system SHALL mark a recipient as campaign-ready only after subscriber identity, stable metadata, and newsletter-scoped merge properties have synced successfully.

#### Scenario: One campaign covers recipients with different class content

- **WHEN** newsletter `N-2026-04` targets recipients `G-1` and `G-2`, `G-1` has `oak` excerpts, and `G-2` has `willow` excerpts
- **THEN** the system SHALL prepare one Kit campaign audience containing both recipients and SHALL sync different newsletter-scoped merge property values for each mapped subscriber

#### Scenario: Recipient with failed property sync is excluded from campaign-ready audience

- **WHEN** recipient `G-1` syncs subscriber identity successfully but newsletter-scoped article excerpt property sync fails
- **THEN** the system SHALL mark `G-1` as not campaign-ready and SHALL NOT include `G-1` in the campaign-ready recipient set until the property sync succeeds

### Requirement: System SHALL validate Kit merge property payload limits before provider sync

The system SHALL validate article count, excerpt length, serialized property size, and required field presence before writing newsletter-scoped merge properties to Kit. If a recipient payload exceeds configured limits or lacks required prepared content, the system SHALL mark that recipient as not sync-ready with explicit validation errors and SHALL NOT silently truncate required CMS content.

#### Scenario: Oversized excerpt payload blocks only affected recipient

- **WHEN** recipient `G-1` has a newsletter-scoped article excerpt payload larger than the configured Kit field size limit and recipient `G-2` has a valid payload
- **THEN** the system SHALL mark `G-1` as not sync-ready with a payload size error and SHALL allow `G-2` to continue through Kit sync

#### Scenario: Missing required article excerpt blocks property sync

- **WHEN** the campaign template requires `class_article_excerpts` and recipient `G-1` preparation output lacks that property
- **THEN** the system SHALL mark `G-1` as not sync-ready, SHALL NOT write an empty replacement to Kit, and SHALL record the missing required property

### Requirement: System SHALL reconcile newsletter-scoped Kit merge properties

The system SHALL persist provider field identifiers, local payload fingerprints, last successful sync timestamps, and provider error details for each recipient's newsletter-scoped merge property sync. Reconciliation SHALL enqueue re-sync when local fingerprints differ from the last successful Kit sync metadata.

#### Scenario: Unchanged payload skips duplicate provider update

- **WHEN** recipient `G-1` already has a successful Kit merge property sync for delivery batch `B-1` with the same payload fingerprint
- **THEN** the system SHALL reuse the successful sync metadata and SHALL NOT submit a duplicate Kit property update

#### Scenario: Drift queues re-sync

- **WHEN** reconciliation detects that recipient `G-1` has local payload fingerprint `fp-new` and last successful Kit payload fingerprint `fp-old`
- **THEN** the system SHALL enqueue a newsletter-scoped merge property re-sync for `G-1` and annotate the drift reason
