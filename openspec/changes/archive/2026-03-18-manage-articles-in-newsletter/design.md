## Context

The admin workflow already supports newsletter metadata and lifecycle actions, and it includes high-level composition support. Editorial work still needs explicit, testable behavior for managing articles within a specific newsletter context: adding articles, creating newsletter-scoped drafts, editing linked articles, removing links safely, and preserving order.

This change stays inside the existing `newsletter-admin-workflow` capability and clarifies expected behavior across UI, routing, and admin service boundaries.

## Goals / Non-Goals

**Goals:**
- Define a complete newsletter-context article management workflow (add/edit/remove/reorder).
- Ensure composition actions are available without forcing navigation back to unrelated dashboards.
- Preserve data safety by distinguishing article unlinking from article deletion.
- Keep newsletter order authoritative for both admin and reader experiences.

**Non-Goals:**
- Introducing a brand-new admin architecture or capability outside `newsletter-admin-workflow`.
- Redesigning article editor UX beyond what is needed to preserve newsletter context.
- Changing publish/archive lifecycle rules unrelated to composition actions.

## Decisions

1. Keep capability scope as a requirement delta to `newsletter-admin-workflow`.
   - Rationale: Existing capability already owns composition behavior; adding a new capability would duplicate ownership and split related requirements.
   - Alternative considered: Create a separate `newsletter-article-management` capability. Rejected because it fragments one coherent admin workflow.

2. Treat remove as "unlink from newsletter composition" by default.
   - Rationale: Editorial composition often reuses shared draft articles; destructive delete is too risky as the default action.
   - Alternative considered: Hard-delete article records on removal. Rejected due to data-loss risk and higher recovery complexity.

3. Preserve newsletter context during article create/edit flows.
   - Rationale: Context switching slows editorial throughput and increases navigation errors.
   - Alternative considered: Redirect through dashboard-centric flows. Rejected because it breaks composition continuity.

4. Keep newsletter order as persisted source of truth.
   - Rationale: Readers and admins must observe consistent article sequence.
   - Alternative considered: Compute order ad hoc from article timestamps. Rejected because it does not preserve editorial intent.

## Risks / Trade-offs

- [Risk] Existing tests may only cover reorder and basic composition behavior, so expanded expectations can expose gaps. -> Mitigation: add scenario-driven integration tests for add/create/edit/remove/reorder.
- [Trade-off] Maintaining newsletter context across routes introduces tighter coupling between list and editor flows. -> Mitigation: use explicit route helpers and shared navigation utilities to keep transitions predictable.
- [Risk] Ambiguity between unlink and delete actions can confuse admins if UI labels are weak. -> Mitigation: require clear action language and confirm destructive actions separately.

## Migration Plan

1. Add spec delta for modified `newsletter-admin-workflow` composition requirements.
2. Update implementation and tests to satisfy new composition scenarios.
3. Validate no regression in lifecycle and special-edition routes.
4. Rollback strategy: revert composition-specific route/service changes while preserving existing metadata/lifecycle functionality.

## Open Questions

- Should the workflow support adding multiple existing draft articles in one action, or single add only?
- Should "create article" immediately link the new draft to the current newsletter by default?
- Do we need explicit UI affordances for "unlink from newsletter" versus "delete article permanently" in this phase?
