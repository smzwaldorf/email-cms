## Context

Classes are foundational entities for personalization and article targeting, but current behavior lacks a standalone management contract for class lifecycle and validation. As more workflows depend on class identifiers and status, inconsistent class records can produce broken targeting and operational confusion.

This change establishes explicit class management behavior for admin workflows, service contracts, and dependent read paths.

## Goals / Non-Goals

**Goals:**
- Define class lifecycle operations (create, edit, activate, deactivate) with validation rules.
- Ensure class identity fields are stable and unique for downstream targeting.
- Preserve historical references when classes are deactivated.
- Expose class listing/filtering semantics for dependent workflows.
- Add traceable change behavior for class updates.

**Non-Goals:**
- Reworking personalization logic beyond consuming class status and identity.
- Introducing tenant-level RBAC redesign.
- Building a separate archival subsystem beyond lifecycle states.

## Decisions

1. Use soft lifecycle state (active/inactive) instead of destructive deletion.
   - Rationale: deactivated classes can remain referentially intact in historical content and reporting.
   - Alternative: hard delete. Rejected due to data-loss risk and broken references.

2. Enforce uniqueness for class identity keys at write time.
   - Rationale: target bindings and recipient membership need stable, unambiguous class IDs/codes.
   - Alternative: allow duplicate names/codes with UI disambiguation. Rejected due to high operational error risk.

3. Keep class records available to dependent readers with status filtering.
   - Rationale: composition UIs generally need active classes by default, while audit and history views may include inactive classes.
   - Alternative: hide inactive records everywhere. Rejected because it impairs debugging and historical traceability.

4. Record audit metadata on class lifecycle transitions.
   - Rationale: class changes impact multiple downstream systems and need support visibility.
   - Alternative: rely only on database timestamps. Rejected for insufficient change context.

## Risks / Trade-offs

- [Risk] Existing data may violate new uniqueness rules. -> Mitigation: pre-migration dedupe checks and clear conflict remediation path.
- [Risk] Deactivating classes used in active compositions may confuse editors. -> Mitigation: dependent workflows surface status warnings and replacement guidance.
- [Trade-off] Additional lifecycle checks add service complexity. -> Mitigation: centralize validation in class service layer and reuse in all write paths.

## Migration Plan

1. Add class model constraints and lifecycle fields with backward-compatible defaults.
2. Implement class management service endpoints and admin UI workflows.
3. Update dependent class selectors to default to active classes while supporting optional include-inactive queries.
4. Add audit metadata capture for class write operations and lifecycle transitions.
5. Rollback strategy: disable class management entry points and revert to legacy read-only class behavior if issues surface.

## Open Questions

- Should class code be mutable after creation, or locked to preserve downstream references?
- Do we need bulk import/export in this change, or defer to a follow-up capability?
- What minimum audit detail is required for lifecycle transitions (actor, reason, timestamp, prior state)?
