## Why

Editors need a fast way to start each week's newsletter from an existing issue instead of rebuilding structure and content manually. This change is needed now because template reuse is a stated product requirement and is the highest-value slice of the broader newsletter admin workflow.

## What Changes

- Add a focused admin workflow to create a new draft newsletter from an existing newsletter template.
- Define which newsletter metadata and article composition details are copied into the new draft issue.
- Ensure template use produces editable draft content without mutating the source newsletter or its articles.
- Add admin entry points for choosing a source newsletter and starting a new issue from it.
- Keep this change scoped to template use, not the full newsletter-management experience.

## Capabilities

### New Capabilities
- `newsletter-template-workflow`: Admin workflow for creating a new draft newsletter from an existing newsletter template.

### Modified Capabilities

None.

## Impact

- Affected UI: admin newsletter creation flow and newsletter list actions.
- Affected services: newsletter duplication and article-copy workflow in admin services.
- Affected data behavior: creation of new draft newsletters and copied draft article records derived from a source newsletter.
- Relationship to other changes: this can stand alone as a focused improvement and also fit inside the broader `newsletter-admin-workflow` direction.
