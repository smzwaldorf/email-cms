## Why

Personalization and targeting depend on accurate student links to both classes and families, but there is no explicit workflow contract for managing student records and those relationships together. This change is needed now to ensure recipient and class eligibility logic is built on reliable student-association data.

## What Changes

- Add a dedicated student-management workflow for creating, editing, activating, and deactivating student records.
- Define student identity validation and uniqueness behavior for records used in class/family associations.
- Define enrollment management behavior for linking students to classes, including reassignment and status handling.
- Define family-association behavior for linking students to one or more guardian families with integrity checks.
- Define listing/filtering behavior so downstream personalization workflows can consume active students with valid class/family links.

## Capabilities

### New Capabilities
- `student-association-management`: Admin workflow and data rules for managing students and their associations to classes and families.

### Modified Capabilities

None.

## Impact

- Affected UI: admin student list/detail screens, class assignment controls, and family-link management views.
- Affected services/data: student CRUD/lifecycle APIs, student-class enrollment endpoints, and student-family association endpoints.
- Affected integrations: personalization recipient resolution and class-targeted content eligibility consume managed student associations.
