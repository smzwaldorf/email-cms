## 1. Class model and service layer

- [x] 1.1 Add class lifecycle fields and uniqueness constraints for class identity keys with backward-compatible defaults.
- [x] 1.2 Implement class service APIs for create, update, activate, deactivate, and filtered list retrieval.
- [x] 1.3 Centralize validation for required fields and uniqueness checks so all class write paths enforce the same rules.

## 2. Admin class management workflows

- [x] 2.1 Build admin class list and class form flows for create/edit/lifecycle actions.
- [x] 2.2 Add UX for validation errors and lifecycle state visibility in class management views.
- [x] 2.3 Ensure dependent class selectors default to active classes with optional include-inactive behavior where needed.

## 3. Auditability and regression coverage

- [x] 3.1 Add audit metadata capture for class lifecycle transitions and updates (actor, prior state, new state, timestamp).
- [x] 3.2 Add service and integration tests for creation, update, uniqueness failures, lifecycle transitions, and filtered listings.
- [x] 3.3 Run targeted admin/personalization integration suites to verify class status changes do not break downstream class-dependent workflows.
