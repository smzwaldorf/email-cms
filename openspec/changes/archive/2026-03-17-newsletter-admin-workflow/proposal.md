## Why

The current admin newsletter UI supports only a thin create/list/publish flow, while the product requirements call for a fuller editorial workflow for weekly newsletter management. This change is needed now because the data model and service layer already support richer operations, but the admin experience still makes common editorial tasks slow or unclear.

## What Changes

- Expand the admin newsletter workflow from basic CRUD into an editorial management flow centered on draft newsletters.
- Add newsletter-level management for metadata, lifecycle state, and clearer routing between newsletter list and newsletter composition.
- Add article-list management within a newsletter, including ordering and workflow-friendly actions for composing an issue.
- Define a template-oriented workflow so editors can start a new newsletter from an existing issue instead of building every week from scratch.
- Clarify support for weekly newsletters versus special editions in the admin experience.

## Capabilities

### New Capabilities
- `newsletter-admin-workflow`: Admin UI workflow for creating, composing, managing, and publishing newsletters.

### Modified Capabilities

None.

## Impact

- Affected UI: admin dashboard newsletter views, newsletter creation/editing forms, newsletter article list/composition screens, and related navigation.
- Affected services: admin newsletter/article workflow service methods and validation around publish-ready states.
- Affected routing: admin routes for newsletter creation, editing, and composition may be expanded or clarified.
- Affected product behavior: editorial operations become easier to perform consistently without changing public newsletter URLs or reader-facing rendering.
