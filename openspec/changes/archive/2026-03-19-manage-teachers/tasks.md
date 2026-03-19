## 1. Teacher model and service layer

- [x] 1.1 Add teacher lifecycle and audit-capable data shape updates with backward-compatible defaults where required.
- [x] 1.2 Implement teacher service/admin APIs for create, update, activate, deactivate, and filtered list retrieval.
- [x] 1.3 Centralize teacher required-field and uniqueness validation so all teacher write paths enforce consistent rules.

## 2. Admin teacher management workflows

- [x] 2.1 Build admin teacher list and teacher form flows for create/edit/lifecycle actions.
- [x] 2.2 Add UX for validation errors and lifecycle state visibility in teacher management views.
- [x] 2.3 Ensure dependent teacher selectors default to active teachers with optional include-inactive behavior where needed.

## 3. Auditability and regression coverage

- [x] 3.1 Add audit metadata capture for teacher lifecycle transitions and profile updates (actor, prior state, new state, timestamp).
- [x] 3.2 Add service and integration tests for creation, update, uniqueness failures, lifecycle transitions, and filtered listings.
- [x] 3.3 Run targeted admin/editorial integration suites to verify teacher status changes do not break class assignment and article workflows.
