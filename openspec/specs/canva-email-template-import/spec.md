# canva-email-template-import Specification

## Purpose

TBD - created by archiving change 'implement-email-template-from-canva-design'. Update Purpose after archive.

## Requirements

### Requirement: Admin can import Canva-authored HTML into an email template revision
The system SHALL allow an admin to paste or upload Canva-exported HTML while creating or editing an email template, and SHALL convert that import into a saveable template body revision candidate.

#### Scenario: Admin pastes a Canva export
- **WHEN** an admin pastes a full Canva-exported HTML document into the email template import flow
- **THEN** the system SHALL extract a saveable body fragment and present that imported result as the revision candidate for preview and save

#### Scenario: Admin uploads an HTML file exported from Canva
- **WHEN** an admin uploads a `.html` file exported from Canva
- **THEN** the system SHALL load the file contents into the same import validation flow used for pasted HTML


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
### Requirement: System validates Canva import compatibility before revision save
The system SHALL validate imported Canva HTML for supported email-safe markup, asset protocols, and non-empty body structure before allowing the imported result to be saved as a template revision.

#### Scenario: Unsupported construct blocks import save
- **WHEN** imported Canva HTML contains scripts, forms, active embeds, or another unsupported construct
- **THEN** the system SHALL block revision save and return explicit compatibility findings identifying the unsupported construct

#### Scenario: Normalization removes all usable body content
- **WHEN** imported Canva HTML normalizes to an empty or unusable body fragment
- **THEN** the system SHALL reject the import result and require the admin to provide compatible HTML before saving

#### Scenario: Asset link uses unsupported protocol
- **WHEN** imported Canva HTML contains an image or link asset using a non-HTTPS or unsafe protocol
- **THEN** the system SHALL block revision save and report the incompatible asset reference


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
### Requirement: System preserves accepted imported markup for downstream reuse
The system SHALL preserve accepted imported HTML markup as the canonical body content for that template revision after normalization, and SHALL reuse that stored markup for later preview and send preparation.

#### Scenario: Imported revision is reopened later
- **WHEN** an admin reopens an email template revision that was created from accepted Canva HTML
- **THEN** the system SHALL load the preserved imported markup for further preview or editing without regenerating a different body structure

#### Scenario: Imported revision is selected for reuse
- **WHEN** a Canva-imported template revision is selected by a later preview or preparation workflow
- **THEN** the system SHALL use the preserved canonical imported markup from that revision instead of substituting editor-generated HTML

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