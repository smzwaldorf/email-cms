## Why

The CMS now has structured newsletter content, but outbound recipient state is still managed outside the system. We need a first-class integration with Kit (ConvertKit) so subscriber state, class metadata, and subscription events stay consistent between the CMS and the delivery platform.

## What Changes

- Add a bounded Kit API integration layer for creating/updating subscribers, syncing class tags, and writing custom fields used by personalized email workflows.
- Add webhook ingestion for Kit subscription lifecycle events (subscribe, unsubscribe, profile updates) with idempotent processing.
- Define consistency guarantees between local recipient data and Kit, including reconciliation behavior when API or webhook delivery fails.
- Add operational controls for retries, backoff, and failure visibility so sync incidents can be diagnosed and recovered without manual data edits.

## Capabilities

### New Capabilities
- `kit-contact-sync`: Outbound synchronization of local guardian/household data to Kit subscribers, tags, and custom fields.
- `kit-webhook-reconciliation`: Inbound webhook processing and state reconciliation that keeps local subscription status aligned with Kit.

### Modified Capabilities
- None.

## Impact

- Affected systems: newsletter sending pipeline, recipient profile management, and subscription state management.
- Affected interfaces: Kit REST API client boundaries, webhook endpoint contract, and internal sync/reconciliation service interfaces.
- Operational impact: new environment variables/secrets for Kit API access, plus monitoring requirements for sync/webhook failures.
- Data impact: persisted sync metadata (last sync timestamps, external ids, and webhook processing markers) to support idempotency and recovery.
