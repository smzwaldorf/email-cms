## Context

The repository currently supports newsletter authoring, class-scoped article visibility, and admin newsletter management, but it does not define deterministic outbound personalization rules for parent emails. Product direction in `specs/FUTURE-PLANS.md` and `specs/FUTURE-PLANS-DETAILS.md` requires one-email-per-guardian delivery that combines shared newsletter content with class-specific content for families with one or more children.

This change is cross-cutting because it touches recipient resolution, content selection, render composition, and downstream payload contracts. Stakeholders are admins/editors who author weekly content and guardians who receive personalized emails.

## Goals / Non-Goals

**Goals:**
- Define a deterministic personalization pipeline that produces one rendered email payload per guardian.
- Define class block selection rules that combine shared blocks and class-specific blocks.
- Define multi-child merge behavior, including ordering and deduplication rules.
- Define explicit fallback behavior for missing blocks, empty class associations, and membership drift.
- Keep the resulting payload compatible with future email-provider adapters.

**Non-Goals:**
- Implement provider-specific campaign orchestration (Kit/SendGrid) in this change.
- Define analytics/open-click tracking implementation details.
- Redesign admin authoring UI beyond what is required to represent class-targeted blocks.
- Introduce a generic template marketplace or cross-product templating engine.

## Decisions

### 1. Personalization output is a canonical per-guardian render payload

The system will generate a `PersonalizedEmailPayload` per guardian with canonical sections, recipient metadata, and resolved content blocks.

Rationale:
- Keeps personalization deterministic and testable before provider integration.
- Separates composition logic from transport adapters.
- Enables snapshot-style tests and reproducible debugging.

Alternatives considered:
- Render directly inside each provider adapter. Rejected because it duplicates logic and risks drift between providers.
- Store raw HTML only. Rejected because it loses structured provenance for debugging and testing.

### 2. Content model uses shared blocks plus class-targeted blocks

Each newsletter render will include:
- Shared blocks visible to all recipients for the issue.
- Class-targeted blocks resolved from the guardian's child class set.

Rationale:
- Matches roadmap requirement for unified branding with dynamic class personalization.
- Builds on existing class visibility concepts rather than introducing a separate authoring domain.

Alternatives considered:
- Generate one full newsletter per class and merge complete newsletters. Rejected due to duplicate content and difficult deduplication.

### 3. Multi-child merge is deterministic by canonical sort and stable dedupe key

For guardians with multiple children:
- Resolve the union of eligible classes.
- Sort classes by canonical class sort key (fallback: class ID lexical order).
- Within each class, preserve editorial block order.
- Deduplicate blocks using a stable `personalization_key` (fallback derived from source block identity).

Rationale:
- Guarantees stable output for the same source data.
- Prevents repeated blocks when siblings share classes or when class blocks overlap.

Alternatives considered:
- Preserve database retrieval order. Rejected because output can vary by query plan.
- Deduplicate by rendered text only. Rejected because content edits/localization can break semantic identity.

### 4. Personalization behavior is versioned and reproducible

Rendered payloads include:
- `rules_version` identifying the personalization rule set.
- `input_fingerprint` hash of source newsletter revision + recipient class membership snapshot.

Rationale:
- Supports deterministic re-render and audit/debug workflows.
- Allows safe evolution of merge rules with explicit versioning.

Alternatives considered:
- No rule versioning metadata. Rejected because behavior changes become hard to trace.

### 5. Fallback behavior prefers safe inclusion while preserving deterministic order

If class-specific blocks are missing or a guardian has no eligible class blocks:
- The email still renders shared blocks.
- Class section emits a deterministic empty-state marker only when required by template contract.

If recipient class membership changes between enqueue and render:
- Render uses the membership snapshot captured at render start for consistency.

Rationale:
- Avoids send failures for partial data.
- Prevents non-deterministic output due to in-flight membership mutation.

Alternatives considered:
- Hard-fail on missing class blocks. Rejected because it can block entire send runs.

## Risks / Trade-offs

- [Rule complexity increases maintenance burden] -> Mitigation: isolate merge logic in one service with deterministic unit snapshots.
- [Data quality issues in class-child relationships can yield incorrect personalization] -> Mitigation: validate recipient eligibility inputs and emit structured warnings/metrics.
- [Deterministic ordering may differ from historical implicit ordering] -> Mitigation: document canonical sort rules and add migration notes for operators.
- [Fallback inclusion can hide authoring mistakes] -> Mitigation: surface missing-class-block diagnostics in admin preview/send validation.

## Migration Plan

- Introduce personalization pipeline behind a feature flag for internal preview/testing first.
- Backfill or derive `personalization_key` where missing before enabling dedupe in production.
- Roll out in stages: preview render -> test send cohort -> full send path.
- Roll back by disabling the feature flag and reverting to non-personalized send path while preserving authored content.

## Open Questions

- Should empty class sections be omitted entirely or rendered with a standardized "no class updates" block?
- Which class sort key is canonical when admin-defined ordering is unavailable (created-at vs lexical name vs ID)?
- Do we need per-child attribution labels inside merged class sections, or is class-only labeling sufficient for v1?
