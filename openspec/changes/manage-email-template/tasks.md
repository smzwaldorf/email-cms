## 1. Template data and service foundations

- [ ] 1.1 Add email template entities with revision support, lifecycle state (draft/active/inactive), and backward-compatible defaults.
- [ ] 1.2 Implement template service operations for create, edit, duplicate, activate, deactivate, and fetch current/explicit revisions.
- [ ] 1.3 Add shared token registry and validation helpers consumed by both admin save/activate flows and render pipelines.

## 2. Admin management and preview workflows

- [ ] 2.1 Build admin template list and editor flows for lifecycle actions (create/edit/duplicate/activate/deactivate).
- [ ] 2.2 Implement validation UX that blocks activation when unsupported tokens or invalid required fields are present.
- [ ] 2.3 Add deterministic preview flow that renders subject/body from a selected revision and sample context with missing-value warnings.

## 3. Render integration and regression coverage

- [ ] 3.1 Update newsletter/personalized composition to pin active template revision at job start and preserve revision for in-progress jobs.
- [ ] 3.2 Add service and integration tests for lifecycle behavior, token validation failures, preview output, and revision pinning semantics.
- [ ] 3.3 Run targeted admin and personalization test suites and adjust fixtures/mocks for template revision references.
