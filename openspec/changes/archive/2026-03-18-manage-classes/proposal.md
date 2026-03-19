## Why

Class data is a core dependency for newsletter targeting and personalization, but there is no explicit workflow contract for creating and maintaining classes in admin tools. This change is needed now so class-dependent features can rely on consistent class lifecycle and validation behavior.

## What Changes

- Add a dedicated admin class-management workflow for creating, editing, activating, and deactivating classes.
- Define class identity and validation rules (unique naming/codes, required fields, and status constraints).
- Define safe deactivation behavior so existing historical references remain intact.
- Define class listing/filtering behavior for downstream workflows that bind content and recipients to classes.
- Define audit-oriented update behavior so class changes are traceable for operational support.

## Capabilities

### New Capabilities
- `class-management-workflow`: Admin workflow and rules for managing class lifecycle, validation, and availability for dependent newsletter/personalization features.

### Modified Capabilities

None.

## Impact

- Affected UI: admin classes list/form flows and class selection controls in related workflows.
- Affected services/data: class CRUD/status APIs, uniqueness validation, and class lookup endpoints.
- Affected integrations: personalization and article-targeting workflows consume class status and identity from managed class records.
