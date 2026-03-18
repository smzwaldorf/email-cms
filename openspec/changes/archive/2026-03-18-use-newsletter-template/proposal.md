## Why

Editors need a fast way to define reusable newsletter templates from real issues, then generate weekly drafts without rebuilding structure and content manually. This change is needed now because template reuse is a stated product requirement and a high-value foundation for newsletter operations.

## What Changes

- Add an admin workflow to create a newsletter template from an existing newsletter.
- Add template management behavior for modifying template article structure (count and order) and canonical content.
- Add an admin workflow to create a new draft newsletter from a selected template.
- Define deep-copy behavior so new newsletters receive full article body content and ordering from the template.
- Ensure editing newsletters created from templates never mutates the source newsletter or the template records.
- Keep the created newsletter fully normal after instantiation (hybrid editing allowed).

## Capabilities

### New Capabilities
- `newsletter-template-workflow`: Admin workflow for creating a new draft newsletter from an existing newsletter template.

### Modified Capabilities

None.

## Impact

- Affected UI: admin template creation flow, template editing flow, and newsletter-from-template creation flow.
- Affected services: template creation, template-article management, and newsletter instantiation by deep copy.
- Affected data behavior: creation of template newsletters with canonical template articles, and independent draft newsletters copied from templates.
- Relationship to other changes: this remains a focused slice and can integrate into broader newsletter admin workflow changes.
