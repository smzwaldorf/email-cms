## Why

The `newsletter-admin-workflow` implementation is functionally complete, but verification surfaced follow-up warnings around scenario coverage and a few workflow edges that are not yet proven end to end. This change is needed now so the admin newsletter workflow can be archived with stronger confidence in lifecycle actions and ID-based newsletter handling.

## What Changes

- Tighten the admin newsletter workflow around the behaviors that received verification warnings, especially publish/archive lifecycle actions and special-edition newsletter handling.
- Add targeted integration and routing coverage for newsletter management flows that currently rely on partial evidence.
- Align newsletter management UI behavior and helper usage so weekly newsletters and ID-based newsletters behave consistently across management, editing, and public-link entry points.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `newsletter-admin-workflow`: Refine requirement coverage for lifecycle actions, special-edition routing, and warning-prone newsletter management flows.

## Impact

- Affected UI: admin newsletter management page, dashboard entry points, and related navigation/public-link behavior.
- Affected tests: integration and route tests for archive, template, and special-edition newsletter flows.
- Affected workflow status: reduces verification warnings so `newsletter-admin-workflow` can be archived with clearer evidence.
