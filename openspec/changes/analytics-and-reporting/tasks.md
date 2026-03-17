## 1. Tracking and Data Foundations

- [ ] 1.1 Add database schema and TypeScript types for engagement event ledger, quality classification metadata, export jobs, and reconciliation discrepancies.
- [ ] 1.2 Implement tracking token contracts and validation utilities for open pixel and tracked click endpoints.
- [ ] 1.3 Add persistence/repository layer methods for idempotent event writes and duplicate detection using deterministic idempotency keys.

## 2. Engagement Ingestion and Qualification

- [ ] 2.1 Implement open tracking pixel endpoint that validates tokens, records normalized open events, and returns compliant pixel responses.
- [ ] 2.2 Implement tracked click redirect endpoint that records click events, enforces destination URL safety policy, and completes redirects.
- [ ] 2.3 Implement event qualification pipeline that labels raw events as qualified/excluded (with rule version metadata) without losing raw records.

## 3. Aggregation, Dashboard Query, and Freshness

- [ ] 3.1 Implement asynchronous rollup jobs for campaign/class/date aggregates (send count, unique opens/clicks, rates, unsubscribe rate).
- [ ] 3.2 Implement analytics query services/APIs that return aggregated metrics plus freshness metadata (`last_ingested_at`, `last_rollup_at`, lag status).
- [ ] 3.3 Implement stale-data signaling when freshness thresholds are exceeded.

## 4. Export and Reconciliation Operations

- [ ] 4.1 Implement asynchronous export job flow (request, process, complete/fail) for CSV and spreadsheet-compatible outputs with filter parity to dashboard queries.
- [ ] 4.2 Implement RBAC and field-level policy enforcement to minimize PII exposure and block unauthorized report fields.
- [ ] 4.3 Implement scheduled provider reconciliation that detects drift, records discrepancies, and queues backfill/recompute tasks.

## 5. Reliability, Verification, and Documentation

- [ ] 5.1 Add retry/dead-letter handling, structured logs, and operational metrics for ingestion, rollups, exports, and reconciliation jobs.
- [ ] 5.2 Add unit/integration tests for idempotent tracking, qualification rules, aggregate correctness, export failures, and reconciliation flows.
- [ ] 5.3 Document analytics/reporting operator workflow (configuration, runbook, replay/retry) and run `npm run lint`, `npm test -- --run`, and `npm run build` before PR handoff.
