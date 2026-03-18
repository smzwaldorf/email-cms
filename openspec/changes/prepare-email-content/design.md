## Context

Current authoring and personalization work defines what content exists, but send-time preparation still needs an explicit contract that transforms those inputs into validated, delivery-ready payloads. Without a dedicated preparation workflow, token issues, missing sections, and data drift can surface too late in the sending process.

This change introduces a preparation stage between authoring and delivery orchestration, with deterministic inputs, validation, preview/approval, and traceable outputs.

## Goals / Non-Goals

**Goals:**
- Define a repeatable preparation workflow that converts newsletter + template + recipient snapshots into send-ready payloads.
- Validate content and token requirements before handoff to delivery.
- Support preview and review of prepared outputs before launch.
- Persist preparation metadata for traceability and reproducibility.
- Allow partial success so valid recipient payloads can proceed while invalid cases are reported.

**Non-Goals:**
- Implementing ESP send orchestration, scheduling, or provider retries.
- Replacing newsletter authoring UX beyond preparation-entry requirements.
- Designing new permission models unrelated to preparation execution.

## Decisions

1. Introduce explicit preparation jobs with immutable input references.
   - Rationale: job-level immutability guarantees reproducible outputs and easier debugging.
   - Alternative considered: ad hoc on-demand composition at send time. Rejected due to nondeterminism and poor auditability.

2. Pin template revision and recipient/content snapshots at preparation start.
   - Rationale: prevents in-flight source changes from mutating prepared outputs.
   - Alternative considered: always read latest data during the whole run. Rejected because results can drift per batch.

3. Separate validation findings from preparation output records.
   - Rationale: allows strict blocking errors and non-blocking warnings to be tracked clearly without losing payload artifacts.
   - Alternative considered: fail-fast on any issue. Rejected because one bad recipient can block otherwise valid batch output.

4. Support partial success with explicit per-recipient status.
   - Rationale: improves operational throughput while still exposing corrective actions.
   - Alternative considered: all-or-nothing batch. Rejected due to high operational friction and retry waste.

## Risks / Trade-offs

- [Risk] Snapshot references can become stale if preparation is reused too long after authoring. -> Mitigation: define freshness policy and require re-prepare when stale.
- [Risk] Partial-success behavior may hide unresolved errors if monitoring is weak. -> Mitigation: require surfaced summary metrics and blocking thresholds before send handoff.
- [Trade-off] Persisting prepared payloads increases storage costs. -> Mitigation: retention windows and archive policies tied to send lifecycle.

## Migration Plan

1. Add preparation job/result schema and service contracts with backward-compatible defaults.
2. Implement preparation pipeline stages (input resolution, validation, composition, status summarization).
3. Add preview/review endpoints and admin UI entry points for preparation checks.
4. Integrate delivery handoff to consume prepared outputs instead of composing inline.
5. Rollback strategy: route delivery back to legacy composition path while retaining preparation records for analysis.

## Open Questions

- What freshness window should invalidate a prepared batch when source data changes?
- Should warnings ever block send handoff, and if so which categories?
- Do we need explicit “approve prepared batch” state in this change, or can review be informational first?
