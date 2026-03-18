## Context

Newsletter and personalized email rendering depend on reusable content structure, but there is no explicit capability contract for managing email templates as first-class entities. Teams currently risk inconsistent token usage and accidental changes when reusing copy across sends.

This change introduces a dedicated template-management capability spanning admin UI, template storage, validation, and render-time template revision selection.

## Goals / Non-Goals

**Goals:**
- Define how admins create, edit, duplicate, activate/deactivate, and select email templates.
- Establish deterministic token validation and preview behavior before templates are used.
- Ensure render jobs use stable template revisions to prevent in-flight content drift.
- Keep template lifecycle compatible with both newsletter and personalized rendering flows.

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

3. Support active/inactive template lifecycle instead of hard delete.
   - Rationale: preserves historical usage and reduces accidental data loss.
   - Alternative: delete template records. Rejected due to broken references and audit gaps.

4. Provide deterministic preview based on selected sample context.
   - Rationale: editors need confidence in rendered output before template activation.
   - Alternative: no preview, validate only. Rejected as insufficient for content QA.

## Risks / Trade-offs

- [Risk] Token registry drift between validation and renderer implementations. -> Mitigation: shared token schema module consumed by both admin validation and render services.
- [Risk] Revision growth can increase storage and lookup complexity. -> Mitigation: lightweight revision metadata and optional retention policy for stale drafts.
- [Trade-off] Strict token validation may block some ad hoc copy patterns. -> Mitigation: provide clear error messages and documented extension path for new tokens.

## Migration Plan

1. Introduce template data model and revision records with backward-compatible defaults.
2. Add admin service endpoints and UI for template lifecycle operations.
3. Add validation/preview pipeline using shared token registry.
4. Update render selection to pin template revision at job composition time.
5. Rollback strategy: switch render selection to legacy fallback template while retaining stored revisions.

## Open Questions

- Should one template be globally default, or can defaults vary by newsletter/class segment?
- Do we need localized template variants in this change or a follow-up capability?
- Should deactivating a template block new usage only, or also prompt migration for draft newsletters currently referencing it?
