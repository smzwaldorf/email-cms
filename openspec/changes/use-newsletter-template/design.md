## Context

The product requirements call for reusable newsletter templates that can be shaped by editors and used repeatedly for new weekly drafts. The current admin UI supports blank newsletter creation but does not support creating templates from existing issues or managing template structure. The existing newsletter/article composition model can be reused for copy-based instantiation.

Stakeholders are administrators and editors who prepare recurring weekly newsletters and want to preserve structure while editing the new issue independently from the previous one.

## Goals / Non-Goals

**Goals:**
- Let an admin create a template from an existing newsletter.
- Let admins modify template structure and canonical content before use.
- Let an admin create a new draft newsletter from a selected template.
- Copy full article body content and ordering into independently editable draft newsletter records.
- Keep source newsletters and template records unchanged by downstream edits in created newsletters.
- Keep created newsletters fully normal so hybrid edits are allowed after template use.

**Non-Goals:**
- Build the full newsletter management experience.
- Implement email delivery, scheduling, or analytics behavior.
- Introduce a generic cross-feature template engine.
- Change public rendering or published newsletter routes.

## Decisions

### 1. Admin creates template from an existing newsletter

Creating a template from an existing newsletter should create a separate template newsletter record plus template article records that copy composition structure, ordering, and full body content.

Rationale:
- Provides a deliberate template lifecycle instead of ad-hoc duplication.
- Keeps source newsletters stable and auditable.
- Gives editors a canonical structure they can refine over time.

Alternatives considered:
- One-step newsletter duplication without template creation. Rejected because it does not provide reusable canonical templates.

### 2. Templates are mutable and not versioned

Template newsletters are edited in place with no explicit versioning model.

Rationale:
- Matches requested operational simplicity.
- Reduces UX and storage complexity for v1.

Alternatives considered:
- Template version history per change. Rejected for now because no-versioning was explicitly requested.

### 3. Newsletter creation from template deep-copies full content into draft

Creating a newsletter from a template should deep-copy template composition into new newsletter/article draft records, including full article bodies.

Rationale:
- Prevents cross-record mutation between template and instantiated newsletters.
- Preserves editorial value by copying full content, not only skeletons.
- Maintains safe default state for newly created issues.

Alternatives considered:
- Reference template articles directly from created newsletters. Rejected because downstream edits would mutate canonical template content.

### 4. Instantiated newsletters are normal newsletters (hybrid editing allowed)

After template instantiation, the resulting newsletter behaves exactly like any normal newsletter and can be edited freely (add/remove/reorder/edit articles).

Rationale:
- Avoids locking editors into template-only constraints.
- Fits existing editorial workflow expectations.

Alternatives considered:
- Keep hard linkage to template with restricted edits. Rejected because hybrid editing is explicitly required.

### 5. Copy safety boundaries are strict

Creating a template must not mutate source newsletters, and editing instantiated newsletters must not mutate templates.

Rationale:
- Establishes clear ownership boundaries between source newsletter, template, and created newsletters.
- Prevents accidental regressions in recurring editorial workflows.

Alternatives considered:
- Allow optional write-back from created newsletter to template. Rejected for v1 due to high accidental overwrite risk.

## Risks / Trade-offs

- [No versioning can make template edits hard to roll back] -> Mitigation: keep audit metadata and provide clear "last modified" visibility in admin UI.
- [Deep-copy creates more records over time] -> Mitigation: scope to high-value recurring templates and monitor storage growth.
- [Unclear boundaries between source/template/newsletter records can cause mutation bugs] -> Mitigation: enforce explicit copy flows and isolation tests.

## Migration Plan

- Reuse existing schema if feasible by introducing template-typed newsletter records, or add minimal template-identification fields if needed.
- Add admin entry points for template creation from existing newsletter and newsletter creation from template.
- Keep blank newsletter creation available in parallel.
- Roll back by disabling template entry points while preserving already created templates/newsletters.

## Open Questions

- Should template lists and source-newsletter pickers default to latest updated, latest published, or searchable only?
- Should template deletion be hard delete, soft delete, or archive-only?
