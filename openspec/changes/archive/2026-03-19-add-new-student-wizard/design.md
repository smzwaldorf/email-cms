## Context

Student creation currently uses a basic admin form that does not guide operators through related setup tasks (family link and class enrollment). Recent family/student management work introduced stronger constraints and lifecycle rules, so creation flows now need a guided UX that validates inputs incrementally and handles multi-entity writes safely.

## Goals / Non-Goals

**Goals:**
- Provide a multi-step wizard for creating a student with clear progress and per-step validation.
- Allow optional linking of the new student to an active family, optional inline family creation, and optional class enrollment during the same flow.
- Keep writes reliable by validating dependencies before submission and returning actionable errors.
- Reuse existing admin service primitives where possible to avoid duplicate write logic.

**Non-Goals:**
- Replacing existing student edit/delete flows.
- Redesigning family lifecycle or class management policies.
- Introducing bulk import or CSV onboarding in this change.

## Decisions

1. Use a client-side stepper wizard in admin student management instead of a single long form.
   - Rationale: reduces operator mistakes and provides a predictable onboarding sequence.
   - Alternative: keep one form with conditional sections. Rejected because validation and error recovery are harder to reason about.

2. Model family-link and class-assignment steps as optional and skippable.
   - Rationale: some students may be created before family/class relationships are known.
   - Alternative: require both links on create. Rejected due to blocking legitimate partial onboarding.

3. Execute writes in ordered service calls with compensating error reporting.
   - Rationale: current APIs are separate (`createStudent`, `addStudentToFamily`, class enrollment APIs); ordered orchestration keeps backward compatibility.
   - Alternative: add a new transactional backend RPC now. Rejected for scope; can be added later if partial-failure rates justify it.

4. Restrict family selection to active families by default in wizard pickers.
   - Rationale: aligns with recipient and family management defaults to avoid linking students to inactive families.
   - Alternative: show all families. Rejected due to higher risk of invalid operational links.

5. Support inline family creation as part of the family step.
   - Rationale: admins often onboard students before family records exist; inline creation avoids abandoning the wizard and reduces data loss.
   - Alternative: force users to leave wizard and create family in a separate page. Rejected due to workflow fragmentation.

## Risks / Trade-offs

- [Risk] Multi-call submit can partially succeed (student created but optional links fail). -> Mitigation: show post-submit status for each step and provide retry actions on failed optional links.
- [Risk] Additional wizard state (including inline family mode) increases UI complexity. -> Mitigation: keep state machine minimal (`details`, `family`, `class`, `review`, `done`) and cover transitions with integration tests.
- [Trade-off] Reusing existing APIs avoids backend churn but is not fully atomic. -> Mitigation: document behavior and plan transactional endpoint as a follow-up if needed.

## Migration Plan

1. Add wizard components and integrate entry point in `StudentManagementPage`.
2. Wire service orchestration using existing create/link APIs.
3. Add validation and error messaging for each step.
4. Add integration and service tests for success, skip-path, and partial-failure scenarios.
5. Rollback strategy: keep old create form path behind feature flag or route toggle until wizard is stable, then remove fallback.

## Open Questions

- Should class assignment support selecting multiple classes at creation time or only one initial class?
- For partial failures, do we auto-offer cleanup (delete newly created student) or only provide manual remediation actions?
