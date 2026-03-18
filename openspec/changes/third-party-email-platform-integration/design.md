## Context

The CMS now stores guardian, child, class, and newsletter relationships locally, but delivery-platform subscriber state is not yet managed as a first-class workflow. This change adds a robust integration boundary with Kit (ConvertKit) so outbound personalization data and inbound subscription lifecycle events can be synchronized safely.

Constraints:
- Existing application stack uses React + TypeScript frontend with Supabase/PostgreSQL backend patterns.
- Subscription state changes must be idempotent and auditable.
- External API limits and intermittent failures are expected and cannot block operator workflows.

Stakeholders:
- Product/operations team that manages newsletter delivery readiness.
- Engineering team responsible for personalized email pipeline correctness.
- Families/guardians who depend on accurate subscribe/unsubscribe handling.

## Goals / Non-Goals

**Goals:**
- Define a clear Kit integration boundary (outbound sync + inbound webhooks) that can be implemented without coupling business logic directly to HTTP calls.
- Guarantee deterministic sync behavior with retry/backoff and durable failure visibility.
- Keep local recipient state and Kit subscription state convergent through reconciliation rules.
- Provide spec-level requirements that are testable for API boundaries, failure handling, and consistency.

**Non-Goals:**
- Building a full campaign orchestration UI in this change.
- Supporting multiple third-party platforms in this initial scope.
- Implementing analytics/reporting dashboards for delivery metrics.
- Replacing existing personalized content composition logic.

## Decisions

### 1) Introduce an adapter boundary for email platforms
Use an internal `EmailPlatformAdapter` contract with a concrete `KitAdapter` implementation.

Rationale:
- Keeps newsletter domain logic independent from provider-specific API payloads.
- Reduces migration cost if future providers (SendGrid/Mailchimp) are added.

Alternative considered:
- Calling Kit APIs directly from existing services. Rejected due to coupling and harder testability.

### 2) Separate outbound sync jobs from request-time application flows
Persist outbound sync intents in a job table and process them asynchronously.

Rationale:
- Absorbs rate-limit and transient failure conditions without blocking user actions.
- Enables deterministic retries and dead-letter handling.

Alternative considered:
- Synchronous API calls during user-triggered operations. Rejected because external instability would leak into operator UX.

### 3) Persist webhook events before applying business-side effects
Store each inbound webhook event with provider event id (or derived idempotency key), signature validation result, payload hash, and processing state.

Rationale:
- Guarantees replay safety and auditability.
- Supports recovery and conflict debugging.

Alternative considered:
- Fire-and-forget webhook handling without persistence. Rejected due to poor observability and duplicate-event risk.

### 4) Local data remains source of truth for profile attributes; subscription status reconciles bi-directionally
Class membership and identity metadata originate locally and sync outward; subscription lifecycle events from Kit update local subscription eligibility state.

Rationale:
- Maintains a single authoritative system for school-managed profile data.
- Still respects subscriber intent from external unsubscribe/subscribe events.

Alternative considered:
- Treat Kit as full source of truth for all fields. Rejected because local class/guardian relationships are richer and required for personalization.

## Risks / Trade-offs

- [Webhook authenticity misconfiguration] -> Validate signatures, fail closed on missing/invalid secrets, and log explicit configuration errors.
- [API rate-limit bursts during large syncs] -> Queue-based batching with exponential backoff and jitter; cap concurrency per provider token.
- [Out-of-order or duplicate webhook events] -> Store event timestamps/idempotency keys and apply monotonic state transition rules.
- [Drift between local and Kit records] -> Scheduled reconciliation that identifies and re-queues mismatched subscribers/tags/fields.
- [Increased operational complexity] -> Add structured logs, sync/webhook status dashboards, and clear runbook entries for replay/retry.

## Migration Plan

1. Add provider configuration and secrets management contract (environment variables + validation on startup).
2. Add persistence schema for outbound sync jobs and inbound webhook events.
3. Implement adapter interface and Kit-specific client wrapper with retry policy hooks.
4. Implement outbound processor and webhook ingestion endpoint behind feature flags.
5. Backfill initial subscriber sync for existing guardians/classes in controlled batches.
6. Enable reconciliation job and observe error/latency metrics in staging before production rollout.
7. Rollback strategy: disable feature flags, pause worker processors, and continue using existing local recipient data paths while preserving queued events/jobs for later replay.

## Open Questions

- Which Kit event types are mandatory for MVP beyond subscribe/unsubscribe/profile-update?
- Should reconciliation run on a fixed cadence, or also trigger immediately after bulk imports?
- What retention period is required for webhook payload storage under privacy policy constraints?
- Do we need manual operator actions in admin UI for replaying failed jobs in phase one, or is CLI/internal tooling sufficient?
