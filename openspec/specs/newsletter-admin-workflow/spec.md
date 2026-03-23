# newsletter-admin-workflow Specification

## Purpose

TBD - created by archiving change 'newsletter-admin-workflow'. Update Purpose after archive.

## Requirements

### Requirement: Admin can manage newsletter metadata
The system SHALL provide an admin workflow to create and update newsletter metadata for draft newsletters, including release date and identifiers needed for weekly newsletters or special editions.

#### Scenario: Create a weekly newsletter draft
- **WHEN** an admin creates a newsletter with a valid `week_number` and release date
- **THEN** the system creates a draft newsletter and returns the admin to a newsletter management workflow for that issue

#### Scenario: Create a special edition draft
- **WHEN** an admin creates a newsletter without a `week_number`
- **THEN** the system SHALL create a draft special-edition newsletter that can still be managed through the same admin workflow

#### Scenario: Update newsletter metadata
- **WHEN** an admin edits the metadata of a draft newsletter
- **THEN** the system SHALL persist the updated metadata without changing the public URL behavior of already published newsletters


<!-- @trace
source: newsletter-admin-workflow
updated: 2026-03-17
code:
  - src/components/admin/NewsletterTable.tsx
  - src/components/admin/NewsletterForm.tsx
  - .codex/skills/openspec-verify-change/SKILL.md
  - src/types/admin.ts
  - src/pages/AdminArticleListPage.tsx
  - src/App.tsx
  - src/services/adminService.ts
  - src/pages/NewsletterCreatePage.tsx
  - src/utils/adminNewsletterRoutes.ts
  - src/pages/AdminDashboardPage.tsx
  - src/pages/ArticleEditorPage.tsx
tests:
  - tests/integration/admin-newsletter-workflow.test.tsx
  - tests/services/adminService.spec.ts
  - tests/components/admin/NewsletterForm.spec.tsx
  - tests/integration/app-admin-newsletter-routes.test.tsx
-->

---
### Requirement: Admin can compose the article list for a newsletter
The system SHALL allow an admin to manage the set, class targeting, and order of articles within a newsletter from the newsletter management workflow, including adding, creating, editing, removing, and reordering newsletter articles while preserving newsletter context.

#### Scenario: View articles in newsletter order
- **WHEN** an admin opens a newsletter composition view
- **THEN** the system SHALL display the newsletter's articles in their current newsletter order

#### Scenario: Reorder newsletter articles
- **WHEN** an admin changes the order of articles in a newsletter
- **THEN** the system SHALL save the new newsletter order and use that order in subsequent admin and reader views

#### Scenario: Add existing draft article to newsletter composition
- **WHEN** an admin adds an existing draft article from within a newsletter composition workflow
- **THEN** the system SHALL link that article into the newsletter composition and display it in newsletter order without leaving newsletter context

#### Scenario: Create and attach a new article from newsletter context
- **WHEN** an admin creates a new article from newsletter composition actions
- **THEN** the system SHALL create the article and attach it to the current newsletter composition so the admin can continue composing the same newsletter

#### Scenario: Edit linked article without losing newsletter context
- **WHEN** an admin opens article editing from a newsletter composition workflow
- **THEN** the system SHALL return the admin to the same newsletter composition context after saving or exiting article editing

#### Scenario: Remove article from newsletter composition safely
- **WHEN** an admin removes an article from a newsletter composition
- **THEN** the system SHALL unlink the article from that newsletter composition without deleting the underlying article record by default

#### Scenario: Manage issue composition from newsletter context
- **WHEN** an admin needs to continue composing an issue
- **THEN** the system SHALL provide newsletter-context actions to add, remove, or edit articles without forcing the admin back through unrelated dashboard flows

#### Scenario: Configure class targeting in newsletter composition
- **WHEN** an admin updates an article in newsletter composition to shared targeting or targeted class bindings
- **THEN** the system SHALL persist the targeting configuration and keep the admin in the same newsletter management context


<!-- @trace
source: newsletter-admin-workflow
updated: 2026-03-18
code:
  - src/components/admin/NewsletterTable.tsx
  - src/components/admin/NewsletterForm.tsx
  - .codex/skills/openspec-verify-change/SKILL.md
  - src/types/admin.ts
  - src/pages/AdminArticleListPage.tsx
  - src/App.tsx
  - src/services/adminService.ts
  - src/pages/NewsletterCreatePage.tsx
  - src/utils/adminNewsletterRoutes.ts
  - src/pages/AdminDashboardPage.tsx
  - src/pages/ArticleEditorPage.tsx
tests:
  - tests/integration/admin-newsletter-workflow.test.tsx
  - tests/services/adminService.spec.ts
  - tests/components/admin/NewsletterForm.spec.tsx
  - tests/integration/app-admin-newsletter-routes.test.tsx
-->

---
### Requirement: Admin can create a newsletter from an existing issue template
The system SHALL provide a template-copy workflow that creates a new draft newsletter from an existing newsletter.

#### Scenario: Copy previous issue into a new draft
- **WHEN** an admin starts a new newsletter from an existing issue template
- **THEN** the system SHALL create a new draft newsletter with copied newsletter composition suitable for editing

#### Scenario: Template copy does not mutate source issue content
- **WHEN** an admin edits articles in a newsletter created from a template
- **THEN** the system SHALL preserve the source newsletter and its article content unchanged


<!-- @trace
source: newsletter-admin-workflow
updated: 2026-03-17
code:
  - src/components/admin/NewsletterTable.tsx
  - src/components/admin/NewsletterForm.tsx
  - .codex/skills/openspec-verify-change/SKILL.md
  - src/types/admin.ts
  - src/pages/AdminArticleListPage.tsx
  - src/App.tsx
  - src/services/adminService.ts
  - src/pages/NewsletterCreatePage.tsx
  - src/utils/adminNewsletterRoutes.ts
  - src/pages/AdminDashboardPage.tsx
  - src/pages/ArticleEditorPage.tsx
tests:
  - tests/integration/admin-newsletter-workflow.test.tsx
  - tests/services/adminService.spec.ts
  - tests/components/admin/NewsletterForm.spec.tsx
  - tests/integration/app-admin-newsletter-routes.test.tsx
-->

---
### Requirement: Admin can manage newsletter lifecycle from draft to archive
The system SHALL provide newsletter-level lifecycle actions and validation for draft, published, and archived states, and SHALL treat a successful publish action as the start of newsletter delivery to all eligible families by default unless the admin explicitly narrows the audience before confirmation.

#### Scenario: Publish-ready validation
- **WHEN** an admin attempts to publish a newsletter
- **THEN** the system SHALL validate newsletter-level publish requirements and show blocking issues before or during the publish action

#### Scenario: Publish defaults to send all eligible families
- **WHEN** an admin publishes a valid draft newsletter without changing the audience selection
- **THEN** the system SHALL change the newsletter state to published, make the issue available through its existing public route, and start delivery for all eligible families

#### Scenario: Publish can narrow the delivery audience
- **WHEN** an admin publishes a valid draft newsletter after narrowing the audience to selected classes, selected families, or one family
- **THEN** the system SHALL change the newsletter state to published, make the issue available through its existing public route, and start delivery only for the selected eligible audience

#### Scenario: Archive a published newsletter
- **WHEN** an admin archives a published newsletter
- **THEN** the system SHALL mark the newsletter as archived without deleting its historical content


<!-- @trace
source: newsletter-admin-workflow
updated: 2026-03-23
code:
  - src/components/admin/NewsletterTable.tsx
  - src/components/admin/NewsletterForm.tsx
  - .codex/skills/openspec-verify-change/SKILL.md
  - src/types/admin.ts
  - src/pages/AdminArticleListPage.tsx
  - src/App.tsx
  - src/services/adminService.ts
  - src/pages/NewsletterCreatePage.tsx
  - src/utils/adminNewsletterRoutes.ts
  - src/pages/AdminDashboardPage.tsx
  - src/pages/ArticleEditorPage.tsx
tests:
  - tests/integration/admin-newsletter-workflow.test.tsx
  - tests/services/adminService.spec.ts
  - tests/components/admin/NewsletterForm.spec.tsx
  - tests/integration/app-admin-newsletter-routes.test.tsx
-->

---
### Requirement: Admin workflow supports weekly newsletters and special editions consistently
The system SHALL provide a unified admin workflow for newsletters with `week_number` and newsletters managed only by ID.

#### Scenario: Navigate weekly newsletter management
- **WHEN** an admin opens a week-based newsletter from the dashboard
- **THEN** the system SHALL route the admin into the newsletter management workflow using the newsletter's weekly identifier where applicable

#### Scenario: Navigate special-edition newsletter management
- **WHEN** an admin opens a special-edition newsletter from the dashboard
- **THEN** the system SHALL route the admin into the same newsletter management workflow using the newsletter ID when no `week_number` exists

<!-- @trace
source: newsletter-admin-workflow
updated: 2026-03-17
code:
  - src/components/admin/NewsletterTable.tsx
  - src/components/admin/NewsletterForm.tsx
  - .codex/skills/openspec-verify-change/SKILL.md
  - src/types/admin.ts
  - src/pages/AdminArticleListPage.tsx
  - src/App.tsx
  - src/services/adminService.ts
  - src/pages/NewsletterCreatePage.tsx
  - src/utils/adminNewsletterRoutes.ts
  - src/pages/AdminDashboardPage.tsx
  - src/pages/ArticleEditorPage.tsx
tests:
  - tests/integration/admin-newsletter-workflow.test.tsx
  - tests/services/adminService.spec.ts
  - tests/components/admin/NewsletterForm.spec.tsx
  - tests/integration/app-admin-newsletter-routes.test.tsx
-->

---
### Requirement: Admin workflow proves lifecycle transitions within newsletter management
The system SHALL allow an admin to complete newsletter lifecycle transitions from the newsletter management workflow with user-visible state updates that reflect the new lifecycle state.

#### Scenario: Archive becomes available after publish from management workflow
- **WHEN** an admin publishes a valid draft newsletter from the newsletter management page
- **THEN** the system SHALL refresh the page state so the newsletter shows as published and exposes the archive action in the same workflow

#### Scenario: Archive completes within newsletter management workflow
- **WHEN** an admin archives a published newsletter from the newsletter management page
- **THEN** the system SHALL show the archived state and remove publish/archive actions that no longer apply

---
### Requirement: Admin workflow handles special-edition newsletters with the same management affordances
The system SHALL provide the same newsletter management workflow for newsletters addressed only by ID, including metadata editing, article composition actions, lifecycle visibility, and public-link behavior.

#### Scenario: Open special-edition newsletter management by ID
- **WHEN** an admin opens a special-edition newsletter that has no `week_number`
- **THEN** the system SHALL load the newsletter by ID and display the newsletter management workflow without redirecting to a week-based route

#### Scenario: Public link uses newsletter ID for special editions
- **WHEN** an admin views a published special-edition newsletter in the management workflow
- **THEN** the system SHALL expose the public newsletter link using the newsletter-ID route rather than a week-based route