# kit-contact-sync Specification

## Purpose

Outbound synchronization of local guardian and household data to Kit (ConvertKit) subscribers: deterministic identity mapping, class tags and custom fields (`child_classes`, `child_names`, `parent_type`), bounded retries with terminal failure visibility, and persisted sync consistency metadata to support drift detection and reconciliation.

## Requirements

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


<!-- @trace
source: confirm-workflow-blueprint
updated: 2026-04-09
code:
  - src/components/admin/FamilyList.tsx
  - README.md
  - src/context/AuthContext.tsx
  - src/pages/FamilyManagementPage.tsx
  - src/types/database.ts
  - vite.config.ts
  - supabase/functions/tracking-click/index.ts
  - src/services/adminService.ts
  - src/types/emailDelivery.ts
  - src/services/emailContentPreparationService.ts
  - supabase/migrations/20260322000001_allow_admin_write_email_sync_jobs.sql
  - src/types/index.ts
  - supabase/migrations/20260323000001_make_family_guardian_email_nullable.sql
  - src/components/ProtectedRoute.tsx
  - src/types/emailPreparation.ts
  - src/services/personalizedEmailComposer.ts
  - .agents/skills/spectra-ingest/SKILL.md
  - src/pages/AuthCallbackPage.tsx
  - supabase/functions/tracking-pixel/index.ts
  - src/components/admin/NewsletterTable.tsx
  - src/services/authService.ts
  - src/services/emailPlatform/kitAdapter.ts
  - src/hooks/useAnalyticsTracking.ts
  - supabase/functions/kit-send-newsletter/index.ts
  - supabase/migrations/20260322000000_add_newsletter_delivery_batches.sql
  - src/lib/supabase.ts
  - src/services/emailPlatform/kitMapping.ts
  - src/utils/urlUtils.ts
  - .agents/skills/spectra-debug/SKILL.md
  - .agents/skills/spectra-archive/SKILL.md
  - src/pages/LoginPage.tsx
  - src/pages/AdminArticleListPage.tsx
  - src/services/newsletterDeliveryService.ts
  - .agents/skills/spectra-audit/SKILL.md
  - src/pages/WeeklyReaderPage.tsx
  - src/types/personalization.ts
  - src/components/GoogleButton.tsx
  - src/pages/StudentManagementPage.tsx
  - src/components/admin/FamilyForm.tsx
  - src/types/admin.ts
  - src/types/emailPlatform.ts
  - .agents/skills/spectra-discuss/SKILL.md
  - specs/docs/EMAIL_PLATFORM_OPERATIONS.md
  - .spectra.yaml
  - supabase/migrations/20260322000002_delivery_parent_recipients.sql
  - src/services/emailPlatform/runtime.ts
  - supabase/migrations/20260323000000_add_delivery_recipient_contract_fields.sql
  - .agents/skills/spectra-propose/SKILL.md
  - .agents/skills/spectra-apply/SKILL.md
  - .agents/skills/spectra-ask/SKILL.md
  - src/types/emailJourney.ts
tests:
  - tests/unit/services/emailPlatform/kitAdapter.test.ts
  - tests/unit/services/personalization/personalizedEmailComposer.test.ts
  - tests/unit/authService.test.ts
  - tests/unit/hooks/useAnalyticsTracking.test.tsx
  - tests/unit/services/personalization/emailContentPreparationService.test.ts
  - tests/integration/email-content-preparation-flow.test.ts
  - tests/unit/services/newsletterDeliveryService.test.ts
  - tests/unit/utils/urlUtils.test.ts
  - tests/integration/admin-newsletter-workflow.test.tsx
  - tests/integration/phase5-completion.test.tsx
  - tests/services/adminService.spec.ts
  - tests/unit/services/emailPlatform/kitMapping.test.ts
  - tests/components/admin/ArticleForm.test.tsx
  - tests/pages/AuthCallbackPage.test.tsx
-->

---
### Requirement: System SHALL handle outbound sync failures with bounded retries and terminal visibility
The system SHALL process outbound Kit sync jobs with retryable/non-retryable error classification, exponential backoff for retryable failures, and terminal failed state after max attempts.

#### Scenario: Rate-limit response schedules a retry
- **WHEN** Kit returns a retryable failure (including HTTP 429 or transient network timeout)
- **THEN** the system SHALL increment attempt count, compute the next retry time with exponential backoff, and keep the job in a retryable state

#### Scenario: Job exceeds retry budget
- **WHEN** a sync job reaches the configured maximum attempts without success
- **THEN** the system SHALL mark the job as failed, record the final error context, and surface it for operator follow-up/reconciliation

---
### Requirement: System SHALL keep sync consistency metadata for reconciliation
The system SHALL persist sync metadata required for drift detection, including last successful sync timestamp, payload fingerprint, and last known Kit-side version marker for each mapped recipient.

#### Scenario: Successful sync updates reconciliation metadata
- **WHEN** a sync job completes successfully
- **THEN** the system SHALL update the recipient mapping with fresh sync timestamp and payload fingerprint values used for future drift checks

#### Scenario: Drift detection queues re-sync
- **WHEN** reconciliation detects a mismatch between local payload fingerprint and last known Kit state marker
- **THEN** the system SHALL enqueue a new sync job for that recipient and annotate the mismatch reason