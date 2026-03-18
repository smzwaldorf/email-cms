## Why

Editors need a deterministic pre-send step that turns newsletter inputs into send-ready email content with clear validation feedback before delivery starts. This is needed now to reduce last-minute send errors and align template, personalization, and newsletter data into one preparation contract.

## What Changes

- Add a dedicated email-content preparation workflow that builds send-ready payloads from newsletter content, template revisions, and recipient context snapshots.
- Define preparation-time validation for required fields, unresolved tokens, and missing content sections.
- Define preview and approval behavior so admins can inspect prepared output before send handoff.
- Define deterministic preparation outputs and metadata (rules version, template revision, snapshot IDs) for traceability and repeatability.
- Define failure handling so invalid recipients or content errors are reported without blocking valid prepared outputs.

## Capabilities

### New Capabilities
- `email-content-preparation`: Workflow and rules for preparing validated, deterministic, send-ready email payloads before delivery orchestration.

### Modified Capabilities

None.

## Impact

- Affected services: composition/preparation pipeline, validation services, and preview endpoints.
- Affected data behavior: persisted preparation jobs/results keyed by template revision and membership/content snapshots.
- Affected integrations: delivery adapters consume prepared payloads and status instead of assembling content ad hoc at send time.
