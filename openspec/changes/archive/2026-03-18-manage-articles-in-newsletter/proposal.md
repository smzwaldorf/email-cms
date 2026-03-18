## Why

The current admin workflow supports newsletter composition at a high level, but day-to-day article management inside a newsletter is not explicit enough for reliable editorial work. We need a clearer, end-to-end workflow so admins can add, edit, remove, and reorder articles for a specific newsletter without losing context.

## What Changes

- Expand newsletter composition requirements to explicitly cover in-context article management actions.
- Define expected behavior for adding existing drafts into a newsletter and creating new newsletter-scoped articles.
- Define safe removal behavior so an article can be removed from a newsletter composition without unintended data loss.
- Clarify ordering behavior so newsletter order is predictable and persisted across admin and reader views.
- Strengthen management-flow expectations so all composition actions remain accessible from newsletter context.

## Capabilities

### New Capabilities
- *(none)*

### Modified Capabilities
- `newsletter-admin-workflow`: extend article composition requirements to include explicit add/edit/remove/reorder behaviors and newsletter-context continuity.

## Impact

- Affects admin newsletter composition UI flows and route behavior in newsletter management pages.
- Affects admin service methods and payloads used to manage newsletter-article associations and ordering.
- Requires updated integration and service tests for add/edit/remove/reorder composition scenarios.
