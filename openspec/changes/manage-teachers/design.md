## Context

Teacher data is consumed by multiple admin workflows, including class assignment and article author/editor selection. The current implementation does not enforce a dedicated lifecycle and identity contract for teacher accounts, which leads to stale assignments and inconsistent filtering behavior for downstream tools.

This change introduces explicit teacher-management behavior that keeps teacher records traceable, validates identity fields consistently, and preserves historical references when teachers are deactivated.

## Goals / Non-Goals

**Goals:**
- Define create, update, activate, and deactivate flows for teacher management.
- Enforce required teacher identity validation and uniqueness constraints in shared service logic.
- Preserve assignment history while ensuring active-only defaults for operational selectors.
- Capture teacher lifecycle and profile changes in audit metadata.

**Non-Goals:**
- Redesigning authentication or role-based access control architecture.
- Implementing bulk import/export for teacher records.
- Reworking newsletter personalization logic beyond consuming teacher lifecycle state.

## Decisions

1. Use soft lifecycle state for teacher records (active/inactive), not destructive deletion.
   - Rationale: historical class and article references must remain valid for audit and reporting.
   - Alternative considered: hard delete with cascade cleanup. Rejected because it risks data loss and referential breaks.

2. Centralize teacher identity validation in the teacher/admin service write paths.
   - Rationale: all write paths should enforce the same required fields and uniqueness constraints.
   - Alternative considered: per-form validation only. Rejected because API-level writes could bypass UI checks.

3. Default dependent teacher selectors to active users while supporting optional include-inactive retrieval in admin maintenance views.
   - Rationale: daily operations should avoid inactive users, but admin audit flows still need full visibility.
   - Alternative considered: global inclusion of inactive users with UI badges. Rejected due to frequent operator confusion.

4. Record audit metadata for teacher updates and lifecycle transitions.
   - Rationale: operational support needs actor/prior/new state visibility for account lifecycle changes.
   - Alternative considered: rely on updated_at only. Rejected because it lacks change context.

## Risks / Trade-offs

- [Risk] Existing teacher records may violate new uniqueness constraints. -> Mitigation: migration-time dedupe and explicit validation error messaging.
- [Risk] Deactivating teachers still assigned to classes may disrupt assignment UIs. -> Mitigation: retain assignments historically and surface inactive status in admin views.
- [Trade-off] Additional lifecycle and audit steps increase service complexity. -> Mitigation: isolate lifecycle and validation helpers for reuse.

## Migration Plan

1. Add teacher lifecycle and audit-oriented data shape changes (if required by existing schema).
2. Implement service-level teacher create/update/activate/deactivate/list APIs with centralized validation.
3. Update admin teacher list/form workflows and dependent selectors for active-by-default behavior.
4. Add service and integration tests for validation, uniqueness, lifecycle transitions, and filtering.
5. Rollback strategy: disable teacher lifecycle controls and revert to legacy teacher listing behavior if issues emerge.

## Open Questions

- Should teacher email be mutable after account creation, or treated as immutable identity?
- Do deactivated teachers require a mandatory deactivation reason in this change, or can that be deferred?
- Should class reassignment be blocked when deactivating a teacher with active assignments, or only warned?
