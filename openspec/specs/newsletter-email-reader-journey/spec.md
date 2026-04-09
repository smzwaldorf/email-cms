# newsletter-email-reader-journey Specification

## Purpose

Define the end-to-end journey from published newsletter email through delivery, analytics, optional authentication, and article display; and require deterministic preparation-to-delivery handoff with ready-only recipients and correlated email versus on-site analytics.

## Requirements

### Requirement: System SHALL execute the confirmed seven-step newsletter email reader journey
The system SHALL support the end-to-end journey in this order: write newsletter, publish newsletter, send email, collect email analytics, process article click attempt, authenticate user when required, and redirect to display the intended article.

#### Scenario: Happy-path journey completes without authentication interruption
- **WHEN** a published newsletter email is sent to an already authenticated recipient and the recipient clicks an article link
- **THEN** the system SHALL record journey events and display the intended article without intermediate login.

#### Scenario: Journey resumes after authentication
- **WHEN** an unauthenticated recipient clicks an article link from a sent newsletter email
- **THEN** the system SHALL preserve the intended destination through authentication and redirect to the same intended article after successful login.


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
### Requirement: System SHALL enforce deterministic preparation and ready-only delivery handoff
The system SHALL prepare recipient payloads using pinned newsletter revision, template revision, recipient snapshot, and rules version, and SHALL hand off only ready recipients for delivery while retaining failed recipients for correction.

#### Scenario: Mixed preparation outcomes do not block valid recipients
- **WHEN** preparation produces both ready and failed recipients for the same batch
- **THEN** the system SHALL include only ready recipients in delivery handoff and SHALL persist failed recipients with actionable findings.

#### Scenario: Retry uses corrected inputs for failed subset
- **WHEN** operators retry after fixing input issues from a previous batch
- **THEN** the system SHALL target previously failed recipients and run them against newly pinned inputs.


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
### Requirement: System SHALL capture distinct email-event and on-site analytics across the journey
The system SHALL track email open/click events separately from on-site page-view/session events and SHALL preserve correlation identifiers needed to analyze conversion from delivery to article view.

#### Scenario: Email click is correlated to article view
- **WHEN** a recipient clicks a tracked email article link and reaches the reader
- **THEN** the system SHALL store analytics records that allow operators to link click activity to the resulting article view session.

#### Scenario: Authentication boundary does not break analytics continuity
- **WHEN** a click leads to authentication before article display
- **THEN** the system SHALL continue analytics correlation across the auth callback and final redirect.

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