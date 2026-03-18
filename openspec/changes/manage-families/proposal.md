## Why

Personalized email delivery relies on accurate guardian/child family relationships, but there is no explicit admin workflow contract for managing family records. This change is needed now to make recipient resolution dependable and reduce targeting errors caused by inconsistent family data.

## What Changes

- Add a dedicated family-management workflow for creating, editing, activating, and deactivating family records.
- Define required guardian contact and family identity fields with validation and uniqueness rules.
- Define parent-child association management behavior, including add/remove child links and status handling.
- Define safe lifecycle rules so deactivation preserves historical send/report references.
- Define listing/filtering behavior so downstream personalization flows can retrieve eligible active families predictably.

## Capabilities

### New Capabilities
- `family-management-workflow`: Admin workflow and data rules for managing family lifecycle, guardian contact data, and child associations used by personalization.

### Modified Capabilities

None.

## Impact

- Affected UI: admin family list/form flows and child-association management screens.
- Affected services/data: family CRUD/status APIs, guardian contact validation, and family-child relationship endpoints.
- Affected integrations: personalized recipient resolution and class-targeting workflows consume managed active family relationships.
