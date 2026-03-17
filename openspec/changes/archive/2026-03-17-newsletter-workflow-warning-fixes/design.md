## Context

The `newsletter-admin-workflow` change introduced the new management flow, but verification still flagged warnings where behavior is only partially demonstrated: lifecycle transitions are not exercised end to end on the management page, and special-edition newsletters are not covered as thoroughly as week-based newsletters. The current implementation already has the right primitives, including shared route helpers, ID-aware loading, and publish/archive service methods, so this follow-up should stay focused on tightening behavior and evidence rather than redesigning the workflow.

## Goals / Non-Goals

**Goals:**
- Remove verification warnings around newsletter lifecycle and special-edition workflow behavior.
- Ensure weekly newsletters and ID-based newsletters use the same management patterns where intended.
- Add targeted tests that prove archive and special-edition flows through real page behavior.

**Non-Goals:**
- Introduce a new admin architecture or replace the newsletter management page.
- Rework newsletter creation, article editing, or template-copy semantics beyond warning-driven fixes.
- Expand the workflow into delivery, analytics, or database-schema changes.

## Decisions

### 1. Fix warning-prone behaviors in place instead of starting a new workflow slice

This change should refine the existing admin newsletter workflow rather than layering on parallel screens or helpers.

Rationale:
- The warnings point to confidence gaps, not to a broken overall architecture.
- The current management page and route helpers already centralize the affected behavior.

Alternatives considered:
- Build a dedicated special-edition management screen. Rejected because it would duplicate the unified workflow.
- Limit the work to tests only. Rejected because some warnings may reflect small behavior mismatches, not just missing coverage.

### 2. Treat ID-based newsletters as a first-class path in management and public-link behavior

Special editions should use the same management page, lifecycle controls, and public-link conventions as weekly newsletters, with ID-based routing where no `week_number` exists.

Rationale:
- This is already the intended workflow contract from `newsletter-admin-workflow`.
- Warnings were most likely to appear where only week-based flows were exercised.

Alternatives considered:
- Keep ID-based support implicit and rely on helper unit tests only. Rejected because the warnings came from incomplete scenario evidence.

### 3. Use stateful integration coverage for lifecycle transitions

The follow-up should prefer management-page integration tests that prove the publish-to-archive sequence, success messaging, and refreshed controls over only service-layer assertions.

Rationale:
- The warnings were about workflow confidence, not just isolated service methods.
- Stateful tests provide the strongest evidence for archive readiness without changing production architecture.

Alternatives considered:
- Add only service tests for archive and publish. Rejected because those tests already exist and did not eliminate the workflow warnings.

## Risks / Trade-offs

- [Narrow warning cleanup can miss adjacent gaps] -> Mitigation: focus tasks on the exact warned scenarios and verify them explicitly after implementation.
- [More integration tests can be brittle] -> Mitigation: mock services at page boundaries and assert user-visible behavior rather than implementation details.
- [Special-edition fixes may touch shared helpers] -> Mitigation: keep route/public-link logic centralized in existing helper utilities and avoid ad hoc branching in components.

## Migration Plan

- No schema or data migration is required.
- Apply the fixes directly to the existing admin newsletter workflow and related tests.
- If a behavior change causes regressions, rollback is limited to the affected admin page/helper logic because no persistence contract changes are involved.

## Open Questions

- None at proposal time; the warning scope is narrow enough to implement directly.
