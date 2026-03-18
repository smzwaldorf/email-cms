## Context

The system already includes role-based authentication and class-aware content filtering, but advanced permission operations are still handled implicitly across code paths and lack a dedicated admin UX. `FUTURE-PLANS.md` calls for a permission/access-control UI with role settings, class restrictions, bulk adjustments, access logs, and explicit multi-role conflict handling.

This change is cross-cutting because it spans admin UI workflows, authorization evaluation logic, persistence for role/class constraints, and auditability. Stakeholders are admins who manage user access, teachers/parents with dual roles, and engineers who need deterministic authz behavior that is testable.

## Goals / Non-Goals

**Goals:**
- Define a concrete admin workflow for role and class-scope permission management.
- Define deterministic multi-role conflict resolution rules that are consistent for every authorization check.
- Define safe bulk permission update behavior with preview/validation before commit.
- Define required audit visibility for both permission mutations and authorization decisions.
- Produce implementation-ready specs and tasks that a coding agent can execute without ambiguity.

**Non-Goals:**
- Implementing the full code changes in this planning change.
- Replacing the authentication provider, session model, or login UX.
- Redesigning all RLS policies from scratch.
- Introducing custom policy scripting or tenant-specific policy languages.

## Decisions

### 1. Use a single effective-permission resolver as the source of authorization truth

All admin and runtime authorization checks will reference one canonical resolver contract that outputs:
- granted/denied result for action + resource + scope,
- winning role/source rationale,
- resolved scope set used for the decision.

Rationale:
- Prevents drift across UI checks, API guards, and batch tools.
- Makes permission behavior explainable and testable.

Alternatives considered:
- Keep ad-hoc checks per feature. Rejected because behavior diverges quickly and becomes difficult to audit.

### 2. Resolve multi-role conflicts using deterministic precedence plus scoped union

For users with multiple roles, effective authorization will:
- evaluate role grants in precedence order `Admin > Teacher > Parent > Student`,
- apply per-action highest-grant semantics,
- resolve class scope using deterministic union rules for read visibility and role-constrained write eligibility.

Rationale:
- Matches roadmap intent for dual-role users while avoiding ambiguous outcomes.
- Keeps behavior stable and reproducible across environments.

Alternatives considered:
- "First match wins" by query order. Rejected because it is non-deterministic.
- Hard disallow dual roles. Rejected because dual-role use cases are a stated requirement.

### 3. Permission mutations are staged through preview then apply

Role/class permission changes (single-user and bulk) will require:
- preflight validation,
- effective-permission diff preview,
- apply operation that records before/after snapshots.

Rationale:
- Reduces accidental privilege escalation and operational mistakes.
- Supports safer bulk operations.

Alternatives considered:
- Immediate writes without preview. Rejected due to higher blast radius and poor operator confidence.

### 4. Audit model is append-only with actor, target, and policy context

Every permission mutation and resolver decision trace will emit structured audit events including actor, target user, change payload, previous state, resulting state, and policy version.

Rationale:
- Supports incident investigation and compliance-style traceability.
- Enables admin access-log UI to remain consistent with backend events.

Alternatives considered:
- Store only final state. Rejected because forensic analysis needs transition history.

### 5. Rollout behind a feature flag with progressive operator enablement

Advanced permission UI and resolver enforcement changes will be introduced behind a feature flag, starting with internal admin preview before broad enablement.

Rationale:
- Limits production risk while validating conflict-resolution correctness.
- Enables rollback by flag disable if anomalies appear.

Alternatives considered:
- Big-bang rollout. Rejected due to high risk in authorization-sensitive changes.

## Risks / Trade-offs

- [Higher complexity in permission evaluation] -> Mitigation: centralize resolver logic and add scenario-based tests for precedence/scope edge cases.
- [Bulk updates can create widespread mistakes] -> Mitigation: require preview diff, validation checks, and explicit confirmation in workflow.
- [Audit volume growth] -> Mitigation: define retention/index strategy and focused query filters for operator views.
- [Dual-role semantics may still be misunderstood by operators] -> Mitigation: expose effective-permission explanation in UI and docs.
- [Feature-flag split behavior during rollout] -> Mitigation: define clear fallback path and keep old behavior isolated until cutover.

## Migration Plan

1. Define resolver contract/types and policy versioning format.
2. Define admin permission workflow contracts (single-user edit, bulk edit, log query).
3. Add audit event schema requirements for permission mutations and decision traces.
4. Implement feature-flag-gated workflow and resolver integration incrementally.
5. Run staged verification (unit, integration, and role-conflict regression).
6. Rollback strategy: disable advanced permission feature flag and revert to existing permission UI/path while preserving audit records.

## Open Questions

- Should any operation require dual approval before high-impact bulk permission changes are applied?
- What is the maximum acceptable batch size for permission updates before queueing/asynchronous processing is required?
- How long must authorization decision traces be retained relative to general audit logs?
- Should denied authorization responses surface explanation detail to end users, or only to admins/operators?
