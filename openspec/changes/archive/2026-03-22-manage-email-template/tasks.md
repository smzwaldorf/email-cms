## 0. Migration planning and ordering guardrails

- [x] 0.1 Document migration impact notes for legacy newsletters, fallback template generation, and dual-path runtime compatibility.
- [x] 0.2 Define rollout order: schema and backfill first, admin workflows second, render pinning third, cleanup last.

## 1. Template data and service foundations

- [x] 1.1 Add email template entities with revision support and backward-compatible defaults.
- [x] 1.2 Implement template service operations for create, edit, duplicate, delete, and fetch current/explicit revisions.
- [x] 1.3 Add shared token registry and validation helpers consumed by both admin save flows and render pipelines.

## 2. Admin management and preview workflows

- [x] 2.1 Build admin template list and editor flows for management actions (create/edit/duplicate/delete).
- [x] 2.2 Implement validation UX that blocks save when unsupported tokens or invalid required fields are present.
- [x] 2.3 Add deterministic preview flow that renders subject/body from a selected revision and sample context with missing-value warnings.

## 3. Render integration and regression coverage

- [x] 3.1 Update newsletter/personalized composition to pin selected template revision at job start and preserve revision for in-progress jobs.
- [x] 3.2 Add service and integration tests for template management behavior, token validation failures, preview output, and revision pinning semantics.
- [x] 3.3 Run targeted admin and personalization test suites and adjust fixtures/mocks for template revision references.
