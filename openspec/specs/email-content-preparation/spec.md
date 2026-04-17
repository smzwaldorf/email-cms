# email-content-preparation Specification

## Purpose

Turn pinned newsletter inputs (content revision, template revision, recipient membership snapshot) into per-recipient send-ready email payloads with deterministic re-runs, pre-handoff validation, admin preview and aggregate summaries, and per-recipient status so partial success and targeted retries are supported.

## Requirements

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


<!-- @trace
source: implement-email-template-from-canva-design
updated: 2026-04-17
code:
  - src/services/emailTemplateService.ts
  - src/services/personalizedEmailComposer.ts
  - src/types/emailPreparation.ts
  - src/services/canvaEmailImport.ts
  - src/services/emailContentPreparationService.ts
  - src/pages/AdminEmailTemplateEditorPage.tsx
tests:
  - tests/unit/services/canvaEmailImport.test.ts
  - tests/pages/AdminEmailTemplateEditorPage.test.tsx
  - tests/unit/services/personalization/emailContentPreparationService.test.ts
  - tests/unit/services/emailTemplateService.test.ts
-->

---
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


<!-- @trace
source: implement-email-template-from-canva-design
updated: 2026-04-17
code:
  - src/services/emailTemplateService.ts
  - src/services/personalizedEmailComposer.ts
  - src/types/emailPreparation.ts
  - src/services/canvaEmailImport.ts
  - src/services/emailContentPreparationService.ts
  - src/pages/AdminEmailTemplateEditorPage.tsx
tests:
  - tests/unit/services/canvaEmailImport.test.ts
  - tests/pages/AdminEmailTemplateEditorPage.test.tsx
  - tests/unit/services/personalization/emailContentPreparationService.test.ts
  - tests/unit/services/emailTemplateService.test.ts
-->

---
### Requirement: Preparation workflow supports preview and review summary
The system SHALL provide preview output and aggregate preparation summaries so admins can review generated content and issues before send handoff.

#### Scenario: Admin previews prepared output for a recipient
- **WHEN** an admin requests preview from a completed preparation job
- **THEN** the system SHALL return the prepared subject/body plus associated validation findings for the selected recipient

#### Scenario: Preparation summary reports readiness counts
- **WHEN** a preparation job completes
- **THEN** the system SHALL provide summary counts for ready, warning, and failed recipient payloads with links to detailed findings

---
### Requirement: Preparation job records per-recipient status for partial success
The system SHALL store per-recipient preparation status so valid payloads can proceed while invalid recipients are retained for correction and retry.

#### Scenario: Batch with mixed outcomes preserves valid payloads
- **WHEN** a preparation job has both valid and invalid recipient payloads
- **THEN** the system SHALL keep valid payloads in ready status and record invalid payloads with actionable failure reasons

#### Scenario: Retry targets previously failed recipients
- **WHEN** input issues are corrected and a retry is initiated from a prior preparation job
- **THEN** the system SHALL support preparing only previously failed recipients against newly pinned inputs