## Why

Editors need a reliable way to manage reusable email templates without manually rewriting shared structure and placeholder tokens for each send. This change is needed now to make personalized and newsletter delivery workflows consistent, faster to author, and less error-prone.

## What Changes

- Add an email template management capability for creating, editing, duplicating, and deleting templates used by newsletter email composition.
- Define a canonical template model with subject/body sections, supported variable tokens, and default fallback behavior.
- Define preview and validation behavior so admins can detect invalid/missing template tokens before saving or sending.
- Define template versioning behavior so active campaigns/renders use a stable template revision.
- Define selection behavior for choosing a default template per newsletter composition flow.

## Capabilities

### New Capabilities
- `email-template-management`: Admin workflow and rules for managing reusable email templates, token validation, previewing, and versioned template selection.

### Modified Capabilities

None.

## Impact

- Affected UI: admin template list/editor, template preview, and newsletter composition template selector.
- Affected services/data: template CRUD services, template version storage, token validation/render helpers.
- Affected integrations: personalized and newsletter rendering pipelines consume selected template revisions.
- Migration impact notes:
  - Existing newsletters without template references need a backward-compatible fallback path to a generated default template revision.
