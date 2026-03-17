## Context

The current admin newsletter experience is split across a dashboard list, a minimal create form, and an article list page. The underlying application already has a richer data model than the UI exposes: newsletters have lifecycle state and optional `week_number`, articles are linked through `newsletter_articles`, and admin services already support fetching, adding, removing, and reordering newsletter articles. The main constraint is to improve editorial workflow without changing public newsletter URLs or requiring a broad database redesign.

Stakeholders are administrators and editors who need to produce weekly issues quickly, occasionally create special editions, and move from draft composition to publish with fewer manual steps.

## Goals / Non-Goals

**Goals:**
- Provide a coherent admin workflow for creating, composing, and publishing newsletters.
- Support newsletter metadata management, including week-based newsletters and special editions.
- Support article composition tasks in the newsletter context, especially ordering and issue-level actions.
- Add a repeatable "start from previous issue" workflow for weekly production.
- Reuse existing services, routes, and data relationships where possible to minimize migration risk.

**Non-Goals:**
- Implement email sending, audience targeting, or campaign delivery workflows.
- Introduce a new analytics model or reporting UI.
- Redesign reader-facing newsletter rendering or public URL behavior.
- Replace the underlying article editor beyond the integration points needed for newsletter workflow.

## Decisions

### 1. Center the admin workflow on a newsletter composition view

The admin dashboard remains the entry point, but the primary editing experience becomes a newsletter-focused composition flow rather than a loose set of separate screens.

Rationale:
- Matches the mental model of editors working on an issue, not isolated records.
- Fits the existing `newsletters` plus `newsletter_articles` data model.
- Allows issue-level validation and actions before publish.

Alternatives considered:
- Keep the current list-plus-article-pages flow and add more buttons. Rejected because it preserves the current fragmented workflow.
- Move to an article-first workflow. Rejected because editorial tasks are issue-centric.

### 2. Use the existing newsletter schema and service layer as the foundation

This change should build on the current `newsletters`, `articles`, and `newsletter_articles` model rather than introducing a new container type or route model.

Rationale:
- The repo already supports weekly newsletters, special editions, and article ordering in the data layer.
- Reduces migration risk and keeps the proposal focused on workflow rather than storage redesign.

Alternatives considered:
- Add a separate "campaign" or "issue draft" entity. Rejected because it would expand scope into email operations.
- Normalize weekly and special-edition handling into a new schema. Rejected for this phase due to cost and risk.

### 3. Treat weekly newsletters and special editions as the same workflow with different identifiers

The admin UI should present one workflow for both newsletter types. Weekly newsletters use `week_number`; special editions rely on newsletter ID with optional title/description metadata.

Rationale:
- This matches the current schema where `week_number` is optional.
- Avoids duplicating views and logic for nearly identical editorial behavior.

Alternatives considered:
- Separate admin flows for weekly issues and special editions. Rejected because the behavioral differences are too small to justify divergence.

### 4. Template copy creates new draft content, not shared live article links

Starting a new newsletter from an existing issue should create a new draft newsletter and copy the source issue's composition into new draft article records while preserving order and visibility metadata.

Rationale:
- Editors expect weekly template copy to be safe for modification.
- Reusing the same article records across issues would risk unintended edits to prior issues.
- The repo already distinguishes newsletter composition from article storage, so copy semantics can be explicit.

Alternatives considered:
- Reuse article links through `newsletter_articles` only. Rejected because editing copied issues would mutate shared content.
- Copy only newsletter metadata and no articles. Rejected because it fails the stated template-copy workflow goal.

### 5. Publish readiness should be validated at the newsletter level

The composition flow should expose newsletter-level readiness rules before publish, such as required metadata and at least one article in the issue.

Rationale:
- Moves validation closer to the user action.
- Prevents trial-and-error publish attempts from the dashboard.
- Aligns issue state with the editorial workflow.

Alternatives considered:
- Keep validation only in service-level publish calls. Rejected because it produces poor UX.

## Risks / Trade-offs

- [Template copy duplicates article records] -> Mitigation: limit copied fields to editorially relevant content and preserve a source reference in implementation if needed for audit/debugging.
- [Weekly and special-edition support increases route complexity] -> Mitigation: keep admin routing newsletter-ID aware internally and use helper functions for route generation.
- [More workflow in admin screens can increase UI complexity] -> Mitigation: use progressive disclosure so list pages stay lightweight and composition actions live on a dedicated newsletter view.
- [Existing article actions may not fully support issue-centric editing] -> Mitigation: adapt current service methods and reusable ordering components instead of building parallel logic.

## Migration Plan

- No database migration is required for the initial workflow change if existing schema and service capabilities are reused.
- Roll out by expanding admin routes and screens behind the current admin entry points.
- Preserve current dashboard access patterns so rollback can return users to the existing list and article pages if necessary.

## Open Questions

- Should template copy bring over publication status of articles as draft only, or preserve per-article status for internal review states?
- Should newsletter metadata include an explicit "special edition" label in the UI, or is the absence of `week_number` sufficient?
- Should article addition within a newsletter favor creating new articles, selecting existing ones, or both in the first implementation slice?
