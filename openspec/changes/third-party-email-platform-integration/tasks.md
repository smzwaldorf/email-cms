## 1. Integration Foundation

- [ ] 1.1 Define provider configuration contract (Kit API base URL, auth token, webhook secret) with startup validation and clear failure messages.
- [ ] 1.2 Introduce `EmailPlatformAdapter` interfaces and Kit-specific client/error types so domain services are provider-agnostic.
- [ ] 1.3 Add persistence schema for subscriber mappings, outbound sync jobs, and inbound webhook events (including idempotency and processing status fields).

## 2. Outbound Kit Contact Sync

- [ ] 2.1 Implement recipient-to-Kit payload mapping for subscriber identity, class tags, and custom fields (`child_classes`, `child_names`, `parent_type`).
- [ ] 2.2 Implement outbound sync job enqueue + worker processing flow with retryable error classification, exponential backoff, and max-attempt terminal failures.
- [ ] 2.3 Persist and update sync consistency metadata (last sync timestamp, payload fingerprint, provider version marker) after successful jobs.

## 3. Inbound Webhook Reconciliation

- [ ] 3.1 Implement Kit webhook endpoint authentication/verification and persist accepted webhook envelopes before business-side effects.
- [ ] 3.2 Implement idempotent webhook processor that deduplicates repeated deliveries and applies subscription lifecycle transitions safely.
- [ ] 3.3 Implement unresolved-event reconciliation path for webhook events referencing unknown local subscribers.

## 4. Reliability and Operations

- [ ] 4.1 Implement retry/dead-letter handling and replay hooks for failed sync jobs and failed webhook events.
- [ ] 4.2 Add structured logs and operational metrics for sync throughput, retry counts, and terminal failure rates.
- [ ] 4.3 Implement scheduled reconciliation that detects drift and re-queues sync jobs when local and Kit state diverge.

## 5. Verification and Documentation

- [ ] 5.1 Add unit and integration tests for outbound sync mapping, retry behavior, webhook authenticity checks, deduplication, and subscription-state reconciliation.
- [ ] 5.2 Document operator workflows for configuration, failure triage, and replay/reconciliation procedures.
- [ ] 5.3 Run `npm run lint`, `npm test -- --run`, and `npm run build` and capture results in the implementation PR.
