## 1. Personalization contract and inputs

- [x] 1.1 Audit current newsletter/article/class data sources and document the canonical input model for personalization (guardian, children, classes, blocks, ordering keys).
- [x] 1.2 Define and add TypeScript types for `PersonalizedEmailPayload`, `PersonalizationRuleVersion`, and block identity/dedupe keys.
- [x] 1.3 Implement input snapshot capture that freezes recipient class membership at render start.

## 2. Content selection and merge engine

- [x] 2.1 Implement shared-block plus class-targeted block resolver for a single guardian.
- [x] 2.2 Implement deterministic class ordering and in-class block ordering using canonical sort fallback rules.
- [x] 2.3 Implement multi-child merge that unions eligible classes and deduplicates blocks by stable personalization key.
- [x] 2.4 Emit deterministic fallback output when no eligible class blocks exist while preserving valid shared-content output.

## 3. Deterministic render metadata and integration surface

- [x] 3.1 Add `rules_version` and `input_fingerprint` metadata generation to personalized payload output.
- [x] 3.2 Expose a single composition entry point that returns one payload per guardian for downstream email-provider adapters.
- [x] 3.3 Wire structured warnings/diagnostics for missing class mappings or inconsistent membership inputs without failing whole render jobs.

## 4. Verification and regression coverage

- [x] 4.1 Add unit tests for block selection, canonical ordering, and deduplication across multi-child scenarios.
- [x] 4.2 Add deterministic snapshot-style tests proving identical outputs for identical inputs and rule versions.
- [x] 4.3 Add tests for membership-drift behavior (render-start snapshot consistency) and no-class fallback behavior.
- [x] 4.4 Add integration tests for one-email-per-guardian payload generation across single-child and multi-child families.

## 5. Operator documentation and handoff

- [x] 5.1 Document personalization rule semantics (ordering, dedupe, fallback, rule-versioning) for maintainers.
- [x] 5.2 Document verification commands and expected outputs for this change (`npm run lint`, `npm test -- --run`, `npm run build`).
- [x] 5.3 Prepare implementation handoff note listing non-goals (provider orchestration, analytics) and any open questions requiring PM follow-up.
