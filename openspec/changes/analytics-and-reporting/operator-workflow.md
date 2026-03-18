## Analytics/Reporting Operator Workflow

This runbook covers ingestion, qualification, rollups, exports, and reconciliation for the `analytics-and-reporting` OpenSpec change.

### 1) Runtime configuration

- `ANALYTICS_FRESHNESS_SLA_MINUTES` - freshness threshold before dashboard data is marked stale (default: `30`).
- `ANALYTICS_RECONCILIATION_TOLERANCE_PERCENT` - drift threshold that triggers discrepancy records and backfill queueing (recommended: `10-25`).
- `ANALYTICS_EXPORT_MAX_RETRIES` - retry attempts before an export job is dead-lettered (default: `3`).
- `ANALYTICS_ALLOWED_REDIRECT_HOSTS` - optional comma-separated host allowlist for tracked click redirects.

### 2) Ingestion and qualification

- Tracking pixel requests write `open` events into `engagement_event_ledger`.
- Tracked click requests write `click` events; unsafe URLs are written as `click_blocked` and excluded.
- Idempotency is enforced by deterministic `idempotency_key`.
- Duplicate requests do not create additional canonical records; canonical `duplicate_count` is incremented.
- Qualification labels each raw event as `qualified` or `excluded` and records `quality_rule_version`.

### 3) Rollups and freshness

- Run rollup jobs from `analytics_rollup_jobs` to populate `analytics_rollups`.
- Each rollup should include:
  - `send_count`, `unique_open_count`, `unique_click_count`, `unsubscribe_count`
  - derived rates (`open_rate`, `click_through_rate`, `unsubscribe_rate`)
  - freshness metadata (`last_ingested_at`, `last_rollup_at`, `lag_minutes`, `freshness_status`)
- If freshness lag exceeds SLA, API responses should set stale flags and expose lag metadata.

### 4) Export operations

- Export requests are created in `analytics_export_jobs` with role, filters, requested fields, and approved fields.
- Field-level policy is role-based:
  - `admin`: full approved analytics export fields.
  - `operator`: no restricted/PII fields.
  - `viewer`: aggregated dashboard-safe subset only.
- Processing flow: `requested -> processing -> completed | failed | dead_letter`.
- Failed jobs are retried; if retries are exhausted, write to `analytics_job_dead_letters`.

### 5) Reconciliation operations

- Compare local rollups against provider-side counters for matching campaign/class/period scope.
- If drift exceeds tolerance:
  - create `analytics_reconciliation_discrepancies` record,
  - enqueue recompute/backfill rollup work.
- Close discrepancy only after drift converges under tolerance.

### 6) Replay/retry procedures

- **Requalify events:** reset selected rows to `quality_status = 'pending'`, then re-run qualification worker.
- **Rebuild rollups:** queue an `analytics_rollup_jobs` row for target period/scope.
- **Replay failed exports:** clone failed/dead-letter export request into a new job after root cause fix.
- **Recover from reconciliation drift:** run provider import/backfill, then rerun rollups and recheck drift.

### 7) Operational checks

- Track duplicate ratio (`duplicate_count`) and excluded-event ratio over time.
- Alert on:
  - sustained stale freshness,
  - repeated export dead-letter events,
  - unresolved reconciliation discrepancies.
