# email-template-management Specification

## Purpose

Admins maintain reusable email templates for newsletter and personalized sends. Templates are versioned as revisions, validated against an allowed token registry before save, previewed deterministically with sample context, and pinned at composition time so in-flight and historical sends stay stable when templates evolve.

## Requirements

### Requirement: Admin can manage email templates
The system SHALL allow admins to create, edit, duplicate, delete, and import reusable email templates for newsletter and personalized sends. When an imported HTML template body is accepted, the system SHALL store the resulting template with an initial or updated revision whose body content matches the preserved imported markup approved during import validation.

#### Scenario: Create a new template
- **WHEN** an admin creates a new email template with subject and body content
- **THEN** the system SHALL store the template with an initial revision

#### Scenario: Create or update a template from imported Canva HTML
- **WHEN** an admin saves a template revision using accepted imported Canva HTML as the body source
- **THEN** the system SHALL persist the template revision with the preserved imported markup as the canonical body content for that revision

#### Scenario: Duplicate template for variant editing
- **WHEN** an admin duplicates an existing template
- **THEN** the system SHALL create a new template initialized with the source template content

#### Scenario: Delete template when no longer needed
- **WHEN** an admin deletes a template
- **THEN** the system SHALL remove that template from future selection in composition workflows


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
### Requirement: System validates template tokens before save
The system SHALL validate subject/body template content against the allowed token registry before a template can be saved.

#### Scenario: Reject unknown token
- **WHEN** an admin attempts to save a template containing an unsupported token
- **THEN** the system SHALL reject the save and return a validation error identifying the unsupported token

#### Scenario: Save valid template
- **WHEN** an admin saves a template with only supported tokens
- **THEN** the system SHALL persist the revision successfully

---
### Requirement: System provides deterministic template preview
The system SHALL provide preview rendering for a selected template revision using a sample recipient/context payload, and SHALL render imported template revisions from the preserved canonical imported HTML stored on that revision.

#### Scenario: Preview resolves known tokens
- **WHEN** an admin requests preview for a template revision with a sample context
- **THEN** the system SHALL render subject and body with supported tokens resolved deterministically from that context

#### Scenario: Preview surfaces unresolved required data
- **WHEN** preview input is missing required values for supported tokens
- **THEN** the system SHALL return deterministic fallback output and explicit warnings about missing values

#### Scenario: Preview uses preserved imported HTML
- **WHEN** an admin requests preview for a template revision created from accepted Canva HTML
- **THEN** the system SHALL render preview from the preserved canonical imported HTML stored on that revision rather than a regenerated editor serialization


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
### Requirement: Send composition uses pinned template revisions
The system SHALL pin a specific selected template revision when composing a send so subsequent template edits do not mutate in-progress or historical composition output.

#### Scenario: In-progress job remains stable after template update
- **WHEN** a send composition job starts with template revision `R1` and a newer revision `R2` is later saved and selected for new compositions
- **THEN** the in-progress job SHALL continue using `R1`

#### Scenario: New composition uses latest selected revision
- **WHEN** a new send composition starts after a newer template revision `R2` is selected for composition
- **THEN** the system SHALL use `R2` unless an explicit revision override is provided