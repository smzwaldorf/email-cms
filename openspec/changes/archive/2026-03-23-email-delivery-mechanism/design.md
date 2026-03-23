## Context

The current system already has newsletter authoring, publish validation, Kit contact sync, and parallel proposal work for template management, personalized rendering, and content preparation. What is missing is the orchestration layer that decides who receives a newsletter, when preparation starts, how publish triggers delivery, and how resend requests are tracked without mutating history.

This change is cross-cutting because it touches admin publish UX, newsletter lifecycle semantics, audience resolution, preparation handoff, provider delivery, and operational visibility. The primary stakeholders are editors who publish newsletters, operators who need safe resend and diagnostics, and recipient families whose eligibility and subscription state must remain authoritative in the CMS.

## Goals / Non-Goals

**Goals:**
- Define a single delivery-batch model for default send-to-all and narrower targeted sends.
- Make newsletter publish trigger automatic delivery to all eligible families by default.
- Allow publish-time audience overrides for selected classes, selected families, or one family.
- Define resend as a new, traceable batch that reuses prior context while re-checking current recipient validity.
- Keep recipient eligibility, preparation status, and send outcomes explicit so partial failures do not block valid recipients.

**Non-Goals:**
- Redesigning newsletter authoring or article composition beyond what is needed to support publish-time audience controls.
- Replacing the existing provider integration with a different ESP.
- Defining marketing analytics, open-rate reporting, or campaign-performance dashboards.
- Changing the underlying personalization rules or template token model beyond how delivery consumes them.

## Decisions

### 1. Delivery is modeled as a first-class batch entity

Every publish-triggered send or resend will create a delivery batch that stores:
- newsletter reference and pinned revision inputs
- selected audience mode and selected IDs
- parent batch reference for resends
- batch lifecycle state and aggregate counts

Rationale:
- Gives one durable object for orchestration, audit, retries, and operator visibility.
- Avoids overloading the newsletter record with transient send state.

Alternatives considered:
- Store send state directly on the newsletter. Rejected because one newsletter may need multiple targeted sends and resends.
- Treat resend as a mutation of the original send. Rejected because it obscures history and outcome attribution.

### 2. Publish defaults to all eligible families, with explicit override before confirmation

The admin publish action will resolve `all` as the default audience unless the admin narrows the audience to selected classes, selected families, or one family before confirming.

Rationale:
- Matches the editorial default that newsletters are normally intended for everyone.
- Keeps targeted delivery available without making it the primary workflow.

Alternatives considered:
- Separate publish and send into different top-level workflows. Rejected because the desired product behavior is publish-and-send by default.
- Require audience selection every time. Rejected because it adds friction to the dominant case.

### 3. Recipient resolution remains CMS-local and provider-agnostic

Audience resolution uses local family, class, enrollment, and subscription data to determine recipients. Provider tags and subscriber lists are synchronized outputs, not the source of truth for send targeting.

Rationale:
- Prevents drift between local eligibility and stale provider-side segments.
- Preserves deterministic targeting for publish, resend, and audit.

Alternatives considered:
- Target recipients by provider tags only. Rejected because provider state can lag and is harder to explain/debug.

### 4. Delivery batches pin inputs at preparation start and allow partial success

Each batch captures pinned references for newsletter revision, template revision, and recipient snapshot before preparation. Preparation and send status are tracked per recipient so invalid recipients can fail without blocking ready recipients.

Rationale:
- Aligns with the existing preparation and personalization direction toward deterministic, reproducible outputs.
- Makes send outcomes explainable when newsletter content, templates, or enrollments change later.

Alternatives considered:
- Compose directly from latest data during send. Rejected because the same batch could produce different outputs over time.
- Fail the entire batch on any invalid recipient. Rejected because it creates unnecessary operational blocking.

### 5. Resend is a new linked batch with current-validity checks

Resend creates a new batch linked to an original batch. The resend candidate set comes from previously valid recipients in the original batch, then the system re-checks current subscription and eligibility state before sending.

Rationale:
- Preserves historical traceability while preventing sends to unsubscribed, inactive, or otherwise invalid recipients.
- Allows narrow follow-up actions without editing historical records.

Alternatives considered:
- Replay provider send operations without revalidation. Rejected because recipient validity may have changed after the first send.

## Risks / Trade-offs

- [Risk] Publish now has side effects beyond visibility, increasing operator error if audience is misunderstood. -> Mitigation: require explicit publish confirmation that displays the resolved audience summary.
- [Risk] Multiple active changes overlap with delivery inputs, templates, and personalization contracts. -> Mitigation: define delivery as an orchestration layer that consumes pinned outputs from those capabilities instead of redefining them.
- [Risk] Resend semantics can cause accidental duplicate delivery. -> Mitigation: make resend a separate explicit action with parent-batch lineage and recipient eligibility rechecks.
- [Trade-off] Batch persistence adds schema and operational complexity. -> Mitigation: keep a small set of canonical batch and recipient status states with aggregate summaries for operators.

## Migration Plan

1. Add delivery-batch schema and service contracts without changing existing publish behavior.
2. Implement publish-time audience selection and batch creation behind a feature flag.
3. Integrate batch preparation with recipient sync, personalized render, and template-pinned preparation outputs.
4. Enable automatic provider handoff for ready recipients and surface outcome summaries in admin workflows.
5. Add resend creation from historical batches with current-validity rechecks.
6. Roll back by disabling publish-triggered delivery while preserving created batch history for diagnosis.

## Open Questions

- Should publish block when the resolved audience count is zero, or publish successfully without creating a send?
- Should resend default to all previously valid recipients, or only recipients that failed delivery in the prior batch?
- Do operators need a “publish only” escape hatch for exceptional situations, even though default behavior is publish-and-send?
