## 1. Permission Domain and Resolver Contract

- [ ] 1.1 Audit existing role/class authorization paths and document canonical inputs needed by the effective-permission resolver.
- [ ] 1.2 Define TypeScript/domain contracts for role precedence, scope resolution, and resolver output rationale metadata.
- [ ] 1.3 Implement a single resolver entry point that returns deterministic grant/deny, winning role, resolved scope, and policy version.

## 2. Admin Access-Control Management Workflow

- [ ] 2.1 Implement single-user role and class-restriction management flow with policy validation and effective-permission summary output.
- [ ] 2.2 Implement bulk permission update workflow with preview diff generation and apply confirmation.
- [ ] 2.3 Implement per-user and filtered access-log retrieval interfaces for permission mutations and authorization decision traces.

## 3. Multi-Role Conflict Resolution Integration

- [ ] 3.1 Integrate resolver precedence logic (`Admin > Teacher > Parent > Student`) into admin/API authorization checks.
- [ ] 3.2 Implement deterministic class-scope union for visibility and role-constrained write-scope evaluation.
- [ ] 3.3 Ensure denied and granted authorization outcomes emit structured diagnostic rationale for operator troubleshooting.

## 4. Auditability, Safety, and Rollout Controls

- [ ] 4.1 Persist append-only audit events for permission mutations with actor, target, before/after state, and operation context.
- [ ] 4.2 Persist authorization decision-trace events with winning role, scope source, and policy version metadata.
- [ ] 4.3 Gate advanced permission workflows behind a feature flag and define rollback behavior to existing paths.

## 5. Verification and Documentation

- [ ] 5.1 Add unit tests for precedence resolution, class-scope conflict handling, and deterministic output stability.
- [ ] 5.2 Add integration tests for single-user updates, bulk updates with preview/apply, and access-log query behavior.
- [ ] 5.3 Document operator guidance for permission changes, bulk safety checks, and log-based troubleshooting.
- [ ] 5.4 Run and record verification commands: `npm run lint`, `npm test -- --run`, and `npm run build`.
