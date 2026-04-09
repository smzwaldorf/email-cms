## Context

The product already supports newsletter authoring, publishing, protected reader routes, and authentication callback redirects. It also has foundational email platform mechanics (Kit contact sync and webhook reconciliation) plus a preparation service for personalized content readiness checks.

What is missing is a single confirmed workflow contract that links these parts into one recipient journey: write -> publish -> send -> analytics -> click-through -> auth -> article display. Teams currently rely on component-level behavior without a cross-cutting, testable definition of required handoffs and guarantees.

## Goals / Non-Goals

**Goals:**
- Confirm one canonical seven-step workflow and define required inputs/outputs at each step.
- Define deterministic preparation and ready-only delivery handoff expectations.
- Define authenticated deep-link behavior that preserves intent from email click through login callback.
- Define event expectations for email open/click and on-site article access analytics.
- Make the journey testable with explicit mixed-outcome and redirect-fidelity criteria.

**Non-Goals:**
- Replacing Kit as the delivery provider in this change.
- Redesigning authoring/editor UX.
- Defining unrelated permission model changes.
- Building a new analytics warehouse or BI model.

## Decisions

1. Use a single workflow contract centered on pinned batch inputs.
   - Rationale: publish-time and send-time drift causes inconsistent recipient outcomes and weak auditability.
   - Alternative considered: keep per-service local contracts only. Rejected because end-to-end guarantees remain ambiguous.

2. Require preparation to emit explicit per-recipient readiness states before delivery.
   - Rationale: send orchestration must consume only valid payloads while retaining invalid recipients for correction/retry.
   - Alternative considered: send-time fail-fast. Rejected due to blocking valid recipients and increasing operator friction.

3. Treat click-through as an authenticated deep-link journey with redirect preservation.
   - Rationale: users should land on intended article after login without manual navigation recovery.
   - Alternative considered: always redirect to latest newsletter after login. Rejected because it loses article intent from email.

4. Separate email-event tracking from on-site engagement tracking.
   - Rationale: open/click events and page-view/session events answer different operational questions and have different collection points.
   - Alternative considered: infer email engagement from site events only. Rejected because non-click opens and failed click auth flows become invisible.

5. Extend existing capabilities rather than introducing parallel send contracts.
   - Rationale: `personalized-email-workflow` and `kit-contact-sync` already own adjacent requirements; extending them reduces duplicated semantics.
   - Alternative considered: entirely new send subsystem spec set. Rejected because it increases overlap and migration cost.

## Risks / Trade-offs

- [Risk] Redirect and deep-link state may still be lost for some route forms. -> Mitigation: require route-complete preservation tests for week/newsletter/article entry paths.
- [Risk] Partial-success send behavior can hide failures if summaries are ignored. -> Mitigation: require actionable failed-recipient outputs and explicit retry semantics.
- [Risk] Event duplication (open/click/page_view) can distort metrics. -> Mitigation: define idempotency keys and dedupe requirements per event type.
- [Trade-off] Additional contract and test coverage increases delivery change overhead. -> Mitigation: phase rollout and reuse existing services/routes where possible.

## Migration Plan

1. Confirm and publish capability-level requirements for the seven-step journey.
2. Align preparation, send orchestration, auth redirect, and analytics implementations to the confirmed contract.
3. Add integration tests for mixed recipient outcomes and post-auth article landing fidelity.
4. Roll out with compatibility guardrails (existing routes and Kit sync remain valid).
5. Rollback strategy: keep existing publish/auth flows and bypass journey-specific orchestration wiring while retaining preparation artifacts.

## Open Questions

- Should warning-level recipients be deliverable by policy, or must only strict `ready` recipients be sent?
- What is the canonical click URL form for campaign links (`week + shortId`, `newsletter + shortId`, or tokenized resolver route)?
- What minimum event set is required to mark analytics completeness for this workflow in production?
