## Context

The platform already manages newsletter content and recipient relationships, but engagement measurement is fragmented and not modeled as a first-class product workflow. Operators currently lack a reliable in-product source for open/click performance, segment-level trend analysis, and exportable reports.

This change introduces analytics and reporting as a cross-cutting system spanning tracking endpoints, event storage, aggregation services, and admin-facing report/export interfaces.

Constraints:
- Existing stack patterns are TypeScript + Supabase/PostgreSQL with strict type safety and strong test expectations.
- Event ingestion must tolerate duplicate deliveries, bot/scanner noise, and delayed provider synchronization.
- Reporting outputs must preserve privacy by default (minimal personally identifiable exposure and auditable export access).

Stakeholders:
- Operations/admin users who monitor newsletter performance and decide follow-up actions.
- Product and content teams optimizing engagement by class, period, and campaign.
- Engineering team responsible for metric correctness and data lifecycle governance.

## Goals / Non-Goals

**Goals:**
- Define deterministic tracking for opens and clicks with idempotent attribution to newsletter send context.
- Define metric aggregation contracts for dashboard views (campaign/class/date breakdowns).
- Define export behavior (CSV/Excel-compatible) with filterability, auditability, and privacy controls.
- Define provider-sync/reconciliation behavior so local analytics remains consistent when external event streams lag or fail.
- Make requirements testable for tracking correctness, data integrity, and operational recovery.

**Non-Goals:**
- Building predictive analytics or recommendation models.
- Designing pixel-perfect dashboard visuals beyond required data contracts.
- Replacing delivery provider internals or campaign sending workflows.
- Introducing ad-hoc SQL/report builders in this scope.

## Decisions

### 1) Use an append-only engagement event ledger with idempotency keys
All open/click events are first written as immutable engagement records (`raw_event` + normalized fields) keyed by a deterministic idempotency key.

Rationale:
- Prevents double counting from repeated link prefetches/retries.
- Preserves an auditable trail for metric recomputation and debugging.

Alternative considered:
- Updating aggregate counters directly on request. Rejected due to non-deterministic duplication handling and poor auditability.

### 2) Separate ingestion from aggregation using asynchronous rollups
Tracking endpoints write events quickly and enqueue rollup work; aggregation jobs compute dashboard metrics and export-ready datasets.

Rationale:
- Keeps tracking endpoints fast and resilient under spikes.
- Enables recomputation when metric rules evolve.

Alternative considered:
- Synchronous aggregation in request path. Rejected for latency and lock-contention risk.

### 3) Distinguish "raw" versus "qualified" engagement metrics
Raw metrics reflect all accepted events; qualified metrics apply bot/scanner filtering heuristics and event-quality rules.

Rationale:
- Maintains transparency while protecting business metrics from known noise patterns.
- Supports future tuning without losing original event data.

Alternative considered:
- Single metric stream only. Rejected because operators need trustworthy KPIs and engineers need raw evidence for diagnostics.

### 4) Exports are generated as bounded jobs with policy checks
Exports run as jobs with explicit filters, role checks, and audit logging; generated files have retention limits and traceable ownership.

Rationale:
- Protects against large blocking queries and unauthorized data extraction.
- Supports compliance and incident investigation.

Alternative considered:
- Immediate browser-generated exports. Rejected for scalability, governance, and reproducibility concerns.

### 5) Reconcile local analytics with provider-side delivery data on schedule
A reconciliation job compares expected sends and tracked engagement with provider-side counters/events, then queues corrective backfills.

Rationale:
- Handles partial outages, webhook drift, and delayed delivery updates.
- Produces explicit discrepancy records for operator follow-up.

Alternative considered:
- No reconciliation, trust local events only. Rejected because provider/platform gaps can silently skew metrics.

## Risks / Trade-offs

- [High-volume campaigns produce ingestion spikes] -> Use lightweight ingest path, queue buffering, and bounded worker concurrency.
- [Over-filtering removes legitimate opens/clicks] -> Keep raw and qualified metrics side by side and log rule-version metadata.
- [Under-filtering keeps bot traffic] -> Iterate heuristics with validation samples; flag anomalous bursts for manual review.
- [Large exports expose sensitive data] -> Enforce scoped fields, role-based filters, and export audit logs with retention expiry.
- [Reconciliation increases operational complexity] -> Add runbooks, health metrics, and clear retry/dead-letter flows.

## Migration Plan

1. Add schema for engagement ledger, aggregate metric snapshots, export job records, and reconciliation discrepancy records.
2. Implement tracking ingestion endpoints (pixel + click redirect capture) behind feature flags.
3. Implement rollup jobs for campaign/class/period metrics; validate with fixture datasets.
4. Implement reporting query interfaces and export job pipeline with RBAC + auditing.
5. Implement provider sync/reconciliation job and backfill procedure for historical sends where feasible.
6. Staging rollout: shadow-mode metric validation against manual/provider references, then enable operator dashboard.
7. Production rollout: enable tracking, then dashboard, then exports; monitor ingest lag, mismatch counts, and export failures.
8. Rollback strategy: disable feature flags for tracking/reporting endpoints and workers while preserving written event ledger for later replay.

## Open Questions

- What default retention window should apply to raw engagement events versus aggregated metrics?
- Which bot/scanner signatures should be considered mandatory at MVP versus tunable post-launch?
- Should Excel export be native `.xlsx` or CSV-first with documented spreadsheet compatibility?
- What is the acceptable freshness SLA for dashboard metrics (near-real-time vs scheduled intervals)?
