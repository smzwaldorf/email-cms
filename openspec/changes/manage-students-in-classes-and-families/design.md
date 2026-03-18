## Context

Class and family management now define lifecycle rules for those entities, but student records and their links across both sides are still implicit. Personalized recipient resolution and class-targeted article eligibility require a clear, testable contract for student identity, enrollment, and family association integrity.

This change introduces a single workflow for student lifecycle and cross-entity associations to classes and families.

## Goals / Non-Goals

**Goals:**
- Define student lifecycle operations (create, update, activate, deactivate).
- Define enrollment association rules linking students to classes.
- Define guardian-family association rules linking students to one or more families.
- Enforce integrity/validation for student identity and associations.
- Support active-default listing behavior for downstream personalization flows.

**Non-Goals:**
- Replacing class or family management workflows already defined in separate capabilities.
- Implementing school SIS synchronization in this phase.
- Designing advanced analytics/reporting for student history.

## Decisions

1. Use explicit join relationships for student-class and student-family links.
   - Rationale: many-to-many behavior and lifecycle-safe history need normalized associations.
   - Alternative: denormalized arrays on student record. Rejected due to poor integrity enforcement and difficult auditing.

2. Keep student lifecycle as soft status (`active`/`inactive`) rather than hard deletes.
   - Rationale: historical send and eligibility traces must remain referentially valid.
   - Alternative: destructive delete. Rejected due to data loss and broken references.

3. Enforce uniqueness on student identity keys and validate association endpoints at write time.
   - Rationale: duplicate student records or invalid links cause incorrect recipient composition.
   - Alternative: allow temporary duplicates and reconcile later. Rejected because downstream effects are hard to unwind.

4. Provide active-default reads with optional include-inactive for maintenance workflows.
   - Rationale: operational flows should avoid inactive entities by default while still allowing auditing.
   - Alternative: always return all records. Rejected to prevent accidental use of inactive records.

## Risks / Trade-offs

- [Risk] Legacy student data may not satisfy new uniqueness/integrity rules. -> Mitigation: staged data checks and migration remediation scripts.
- [Risk] Multi-family associations can increase ambiguity in guardian recipient resolution. -> Mitigation: deterministic association ordering and explicit resolver rules in downstream workflows.
- [Trade-off] More normalized association tables increase implementation complexity. -> Mitigation: shared association service layer and targeted integration tests.

## Migration Plan

1. Add student lifecycle fields and identity constraints.
2. Add student-class and student-family association models with referential integrity.
3. Implement student management and association APIs.
4. Update admin UI for student management and link editing.
5. Update recipient-resolution inputs to use active students with valid class/family links.
6. Rollback strategy: disable new association write paths and continue legacy read behavior while preserving migrated schema.

## Open Questions

- What should be the canonical student identity key for uniqueness (external ID, full name + birthdate, or composite)?
- Should a student be required to have at least one class and one family link to remain active?
- How should conflicts be handled when reassigning a student between classes mid-newsletter cycle?
