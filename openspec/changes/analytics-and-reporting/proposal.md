## Why

The CMS can send newsletter content, but it does not yet provide a trusted, first-class view of delivery engagement outcomes. We need built-in analytics and reporting so operators can measure open/click performance, monitor list health, and make data-driven editorial and delivery decisions.

## What Changes

- Add engagement event tracking contracts for opens (tracking pixel) and clicks (redirect links) with reliable event attribution to newsletter send context.
- Add analytics aggregation workflows that compute dashboard-ready metrics for campaign, class, and period-level performance.
- Add report export capability (CSV/Excel-compatible) with filtering and privacy-safe field handling for operational review.
- Define data sync expectations for importing provider-side engagement events and reconciling gaps in local analytics records.
- Define retention and governance rules so analytics data remains useful while respecting data minimization and audit needs.

## Capabilities

### New Capabilities
- `newsletter-engagement-tracking`: Capture and persist open/click engagement events with idempotent attribution to recipients and newsletter sends.
- `analytics-reporting-export`: Provide aggregated dashboard metrics and operator-facing exports with filtering, privacy controls, and sync/reconciliation guarantees.

### Modified Capabilities
- None.

## Impact

- Affected systems: send tracking links/pixels, analytics storage, reporting services, and admin-facing analytics UI/export workflows.
- Affected interfaces: tracking endpoint contracts, metric aggregation interfaces, export generation interfaces, and third-party sync adapters.
- Operational impact: additional monitoring for event ingestion lag, reconciliation failures, and export job runtime/errors.
- Data impact: new engagement event records, aggregate snapshots/materialized views, and export audit metadata with defined retention windows.
