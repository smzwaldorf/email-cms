## Context

The product requirements call for a weekly template-copy workflow, but the current admin UI only supports creating a blank newsletter and then composing it manually. The existing schema and service layer already separate newsletters from articles through `newsletter_articles`, which makes copy-based issue creation possible without a new data model. The main constraint is to deliver a safe, focused template-use flow that can later plug into the broader newsletter admin workflow.

Stakeholders are administrators and editors who prepare recurring weekly newsletters and want to preserve structure while editing the new issue independently from the previous one.

## Goals / Non-Goals

**Goals:**
- Let an admin create a new draft newsletter from an existing newsletter template.
- Reuse the current newsletter, article, and newsletter-article relationship model.
- Copy enough data to preserve composition structure, ordering, and content while making the new issue fully editable.
- Keep the source newsletter and its articles unchanged after template use.
- Provide a clear admin entry point for picking a source issue and starting the copy flow.

**Non-Goals:**
- Build the full newsletter management experience.
- Implement email delivery, scheduling, or analytics behavior.
- Introduce a generic cross-feature template engine.
- Change public rendering or published newsletter routes.

## Decisions

### 1. Template use creates a new draft newsletter plus new draft article records

Using a newsletter as a template should duplicate the source newsletter's composition into a brand-new draft newsletter and create new article records for the copied issue.

Rationale:
- Editors expect copied issues to be safe to edit.
- Shared article references would create accidental cross-issue mutations.
- This aligns with the repo's weekly editorial workflow requirement rather than content reuse across live issues.

Alternatives considered:
- Reuse the same articles via additional `newsletter_articles` rows. Rejected because edits would affect the source issue.
- Copy only newsletter metadata and ask editors to add articles manually. Rejected because it misses most of the value of template reuse.

### 2. Copied articles default to draft state

The new issue and all copied articles should start in draft state, even if the source issue or source articles were published.

Rationale:
- A new issue should not become public by accident.
- Draft status matches the editorial review step expected after copying.

Alternatives considered:
- Preserve source publication status. Rejected because it increases accidental publish risk.

### 3. Source selection should happen inside newsletter creation flow

Admins should be able to start from a blank newsletter or choose an existing newsletter as the template source during creation.

Rationale:
- Keeps the decision close to the "create newsletter" action.
- Avoids adding a separate, disconnected template tool.
- Fits the current admin dashboard entry patterns.

Alternatives considered:
- Add only row-level "duplicate" actions in the newsletter table. Rejected because it is less discoverable as the default weekly creation path.

### 4. Template copy should preserve composition fields, not operational history

The copy workflow should bring over content and composition-relevant fields such as article title, body, ordering, and visibility metadata, but it should not copy audit history or publish timestamps.

Rationale:
- Preserves editorial value while preventing confusing historical carryover.
- Keeps copied issues semantically new rather than cloned historical records.

Alternatives considered:
- Full record cloning including historical metadata. Rejected because it would blur source-versus-copy semantics.

## Risks / Trade-offs

- [Copying articles creates more records] -> Mitigation: keep the initial scope limited to newsletter templates where duplication is intentional and high-value.
- [Template UI can overlap with the broader newsletter admin workflow change] -> Mitigation: define this change as a focused slice that can later be folded into the broader workflow.
- [Unclear field-copy rules can lead to inconsistent issues] -> Mitigation: explicitly define copied fields and reset fields in service-level logic and tests.

## Migration Plan

- No database migration is required if the existing newsletter and article schema are reused.
- Add the template path to the admin newsletter creation workflow without removing the blank-create path.
- Roll back by disabling the template entry point while preserving copied data that has already been created.

## Open Questions

- Should the template chooser default to the latest published newsletter, latest draft newsletter, or a searchable list?
- Should the new newsletter inherit the source newsletter's title/description as-is, or should the UI encourage immediate edits after creation?
