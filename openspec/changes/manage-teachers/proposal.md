## Why

Teacher accounts are currently managed indirectly, which creates inconsistent assignment data and extra manual cleanup across class and newsletter workflows. This change is needed now to establish a clear admin workflow for creating, updating, activating, and deactivating teachers with predictable guardrails.

## What Changes

- Add a dedicated admin teacher-management workflow for creating, editing, activating, and deactivating teacher records.
- Define validation and uniqueness rules for teacher identity fields used in admin operations.
- Define assignment behavior between teachers and classes, including reassignment safeguards during lifecycle changes.
- Define listing/filtering behavior so dependent workflows can default to active teachers with optional include-inactive support.
- Add audit-oriented update behavior for teacher profile and lifecycle transitions.

## Capabilities

### New Capabilities
- `teacher-management-workflow`: Admin lifecycle, validation, assignment, and listing rules for teacher records used by downstream class/newsletter workflows.

### Modified Capabilities

None.

## Impact

- Affected UI: admin teacher list/form pages and teacher assignment controls.
- Affected services/data: admin service teacher APIs, teacher-class assignment queries, lifecycle and validation logic.
- Affected integrations: class management and article editorial flows that depend on active teacher records.
