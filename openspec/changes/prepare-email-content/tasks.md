## 1. Preparation pipeline foundations

- [ ] 1.1 Add preparation job/result data models that pin newsletter revision, template revision, recipient snapshot, and rules version.
- [ ] 1.2 Implement preparation service flow stages: input resolution, composition, validation, per-recipient status recording, and summary generation.
- [ ] 1.3 Add deterministic metadata and hashing/comparison helpers to verify repeated runs with identical inputs produce identical outputs.

## 2. Validation, preview, and review workflows

- [ ] 2.1 Implement validation rules for unsupported tokens, malformed token syntax, missing required sections, and missing required resolved values.
- [ ] 2.2 Add preview endpoints/services that return prepared subject/body plus validation findings for selected recipients.
- [ ] 2.3 Add review-summary outputs with counts for ready, warning, and failed recipients and actionable error details.

## 3. Partial-success handoff and testing

- [ ] 3.1 Implement delivery-handoff contract that consumes only ready recipient payloads while preserving failed recipients for correction.
- [ ] 3.2 Add retry flow support for preparing only previously failed recipients against newly pinned inputs.
- [ ] 3.3 Add service and integration tests for deterministic reruns, validation failures, preview output, mixed-outcome batches, and targeted retries.
