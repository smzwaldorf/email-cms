## Context

Newsletter and personalized email rendering depend on reusable content structure, but there is no explicit capability contract for managing email templates as first-class entities. Teams currently risk inconsistent token usage and accidental changes when reusing copy across sends.

This change introduces a dedicated template-management capability spanning admin UI, template storage, validation, and render-time template revision selection.

## Goals / Non-Goals

**Goals:**
- Define how admins create, edit, duplicate, delete, and select email templates.
- Establish deterministic token validation and preview behavior before templates are used.
- Ensure render jobs use stable template revisions to prevent in-flight content drift.
- Keep template management compatible with both newsletter and personalized rendering flows.

**Non-Goals:**
- Implementing external ESP campaign orchestration.
- Designing a full visual drag-and-drop template builder.
- Replacing existing newsletter/article authoring workflows unrelated to template selection.

## Decisions

1. Use versioned templates with immutable revisions for render selection.
   - Rationale: renders must be reproducible and auditable; mutable "current content" is unsafe for queued jobs.
   - Alternative: mutable single-record template content. Rejected due to race conditions and poor traceability.

2. Define canonical token registry with strict validation.
   - Rationale: prevents invalid placeholders from reaching sends and centralizes allowed variable surface.
   - Alternative: permissive free-form tokens. Rejected because errors would only surface at runtime.

3. Support direct template deletion when templates are no longer needed.
   - Rationale: simplifies operations and matches existing admin workflow implementation.
   - Alternative: explicit multi-state lifecycle model. Rejected to avoid additional state-management complexity in this change.

4. Provide deterministic preview based on selected sample context.
   - Rationale: editors need confidence in rendered output before template selection for sends.
   - Alternative: no preview, validate only. Rejected as insufficient for content QA.

## Risks / Trade-offs

- [Risk] Token registry drift between validation and renderer implementations. -> Mitigation: shared token schema module consumed by both admin validation and render services.
- [Risk] Revision growth can increase storage and lookup complexity. -> Mitigation: lightweight revision metadata and optional retention policy for stale revisions.
- [Trade-off] Strict token validation may block some ad hoc copy patterns. -> Mitigation: provide clear error messages and documented extension path for new tokens.

## Migration Plan

1. Introduce template data model and revision records with backward-compatible defaults.
2. Add admin service endpoints and UI for template management operations.
3. Add validation/preview pipeline using shared token registry.
4. Update render selection to pin template revision at job composition time.
5. Rollback strategy: switch render selection to legacy fallback template while retaining stored revisions.

## Migration Impact Notes

- Data model:
  - Add versioned template entities and revision references used by newsletter composition.
- Backfill:
  - Generate an initial "legacy default" template revision for existing newsletters that currently render without template references.
  - Backfill optional template pointers on historical newsletters only when needed for replay/audit, not for basic read paths.
- Runtime compatibility:
  - During rollout, support dual path: explicit pinned revision when present, legacy renderer fallback when absent.
- Operational risks:
  - Migration can increase template-revision table size; mitigate with lightweight metadata indexes.

## Open Questions

- Should one template be globally default, or can defaults vary by newsletter/class segment?
- Do we need localized template variants in this change or a follow-up capability?
- Should deleting a template be blocked when referenced by in-progress composition jobs, or permitted with a hard-delete warning?
