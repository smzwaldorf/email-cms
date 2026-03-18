## Why

The product roadmap requires personalized parent email delivery, but the current system only supports shared newsletter content and does not define deterministic per-family email assembly. This change is needed now to establish a clear, implementation-ready contract for class content blocks, multi-child merge behavior, and stable personalization rules before delivery/API integration work starts.

## What Changes

- Define a personalized email workflow that composes one outbound email per guardian from shared newsletter content plus class-specific blocks.
- Specify deterministic merge rules for guardians with multiple children across one or more classes, including ordering and deduplication behavior.
- Define deterministic personalization inputs and outputs so the same source data always produces the same rendered email payload.
- Define fallback behavior for missing class blocks, empty child associations, and class membership changes between send preparation and render.
- Keep scope focused on personalization and merge/render logic; do not include ESP campaign orchestration, billing, or analytics implementation.

## Capabilities

### New Capabilities
- `personalized-email-workflow`: Deterministic assembly of parent-facing newsletter emails using class blocks, multi-child merge logic, and stable personalization rules.

### Modified Capabilities

None.

## Impact

- Affected services: newsletter rendering/composition services, recipient resolution logic, and outbound payload generation.
- Affected data behavior: per-guardian personalized content selection from existing newsletter and class-association data.
- Affected integrations: downstream email-provider adapters consume deterministic render output but are not fully implemented in this change.
- Relationship to existing capabilities: complements `newsletter-admin-workflow` by defining post-authoring personalization behavior without changing admin authoring requirements.
