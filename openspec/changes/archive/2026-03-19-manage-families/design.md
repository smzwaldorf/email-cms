## Context

Family data (guardian contacts and child associations) powers recipient resolution for personalized email, but there is no explicit management contract for keeping those records accurate and lifecycle-safe. As personalization expands, missing or inconsistent family data can cause delivery gaps and incorrect targeting.

This change defines family management as a first-class admin workflow with validation, lifecycle states, and relationship integrity for downstream use.

## Goals / Non-Goals

**Goals:**
- Define family lifecycle operations: create, update, activate, deactivate.
- Define guardian contact and family identity validation rules.
- Define child-association management rules with referential integrity.
- Preserve historical references when families are deactivated.
- Provide filtered listing behavior for active/default versus include-inactive needs.

**Non-Goals:**
- Implementing full CRM functionality beyond family records needed for newsletter/personalization.
- Redesigning role/permission model in this change.
- Building external sync integrations for student/family master data.

## Decisions

1. Use soft lifecycle states for families (`active`/`inactive`) rather than destructive deletes.
   - Rationale: send history and personalization traces must remain referentially intact.
   - Alternative: hard delete families. Rejected due to historical data loss and broken links.

2. Enforce guardian contact validation and uniqueness constraints at write time.
   - Rationale: recipient resolution depends on reliable contact fields and duplicate prevention.
   - Alternative: permissive writes with cleanup later. Rejected due to compounding downstream errors.

3. Manage child links as explicit associations with integrity checks.
   - Rationale: clear links are required for class-based personalization and auditability.
   - Alternative: store child relationships as free-form fields. Rejected due to inconsistent semantics.

4. Default family listings to active records, with optional include-inactive mode.
   - Rationale: operational workflows should use current recipients by default while still supporting audits.
   - Alternative: always return all statuses. Rejected because it increases accidental targeting of inactive families.

5. Keep permission changes scoped by using targeted admin policies and security-definer RPCs for display-name updates.
   - Rationale: family/parent/student management requires controlled write access, but broad role-model redesign remains out of scope.
   - Alternative: broad `user_roles` write policy as the primary mechanism. Rejected to reduce RLS blast radius and recursion risks.

## Risks / Trade-offs

- [Risk] Existing family data may violate new validation constraints. -> Mitigation: migration checks, remediation tooling, and staged enforcement.
- [Risk] Deactivating families with active child links may confuse operators. -> Mitigation: clear UI warnings and downstream status indicators.
- [Trade-off] Additional integrity checks increase service complexity. -> Mitigation: centralize validation/association rules in shared service layer.

## Migration Plan

1. Add family lifecycle/status fields and contact validation constraints.
2. Implement family CRUD/lifecycle and child-association APIs.
3. Build admin family management UI with list, detail, and association controls.
4. Update recipient resolution to consume active family records by default.
5. Rollback strategy: disable management entry points and continue legacy read behavior while preserving added schema fields.

## Open Questions

- Which guardian contact field(s) must be globally unique (email only, or phone as well)?
- Should family deactivation automatically disable all child associations, or preserve associations with inactive status?
- Do we require merge tooling for duplicate families in this phase?
