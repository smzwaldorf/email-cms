## Context

The admin newsletter workflow currently focuses on issue composition and ordering, but it does not define article-level class targeting as an explicit contract. Personalized email capabilities depend on clear class eligibility rules for each article, so editorial metadata must encode whether content is shared or class-targeted.

This is a cross-cutting change touching admin authoring, composition services, and personalized render selection.

## Goals / Non-Goals

**Goals:**
- Define a stable article-class binding model for newsletter composition.
- Allow admins to create/update class targeting without leaving newsletter context.
- Preserve deterministic personalized rendering by filtering articles via class eligibility while keeping newsletter order.
- Ensure safe behavior when class assignments become invalid or produce no eligible recipients.

**Non-Goals:**
- Redesigning newsletter lifecycle (draft/publish/archive) beyond class-binding needs.
- Implementing email campaign orchestration or delivery provider integration.
- Introducing role/permission redesign beyond existing admin authorization.

## Decisions

1. Represent article visibility with explicit targeting mode and class IDs.
   - Use a model equivalent to `shared` (all classes) or `targeted` (one or more class IDs).
   - Rationale: keeps rules explicit, avoids implicit defaults based on missing fields.
   - Alternative: infer targeting from nullable class fields. Rejected because null semantics are ambiguous.

2. Make newsletter order authoritative, class eligibility as a filter.
   - Rationale: editors manage narrative sequence once; personalization removes ineligible entries but preserves relative order of eligible entries.
   - Alternative: maintain per-class independent article order. Rejected for higher complexity and inconsistent editorial workflow.

3. Keep class targeting managed from newsletter composition context.
   - Rationale: reduces context switching and keeps article targeting decisions aligned with issue assembly.
   - Alternative: separate class-targeting admin screen. Rejected due to fragmented workflow.

4. Validate targeted bindings against active class catalog at save time.
   - Rationale: prevents stale references and invalid targeting.
   - Alternative: defer all validation to render phase. Rejected because editors need immediate feedback.

## Risks / Trade-offs

- [Risk] Existing articles without targeting metadata may behave inconsistently after rollout. -> Mitigation: migration default to `shared` targeting for legacy associations.
- [Risk] Editors may confuse "shared" with selecting all classes manually. -> Mitigation: explicit UI labels and helper text distinguishing shared vs targeted modes.
- [Trade-off] Additional metadata increases service payload complexity. -> Mitigation: centralize mapping in admin service adapters and keep route contracts stable.

## Migration Plan

1. Add spec deltas and tests for class-binding behaviors.
2. Add data/model support for targeting mode + class IDs with backward-compatible defaults.
3. Update admin composition UI and service calls for editing class bindings.
4. Update personalization selection logic to apply class eligibility filtering while preserving order.
5. Rollback: disable class-filtering read path and treat all articles as shared if regression is found.

## Open Questions

- Should targeted articles require at least one class binding at save time, or allow draft-save with empty selection?
- For guardians with children across many classes, do we deduplicate the same article by article ID only, or by content revision key?
- Should class binding history be auditable in this change or deferred to a later reporting capability?
