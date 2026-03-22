# Personalized Email Workflow

## Canonical Input Model (Task 1.1)

Personalization composition consumes these canonical input sources:

- Guardian and family identity:
  - `families` (`id`, `guardian_email`, lifecycle flags)
  - `family_enrollment` (`family_id`, parent relationship rows)
- Child-to-class membership:
  - `student_class_enrollment` (`family_id`, `student_id`, `class_id`, `graduated_at`)
  - `students` (`id`, `name`, `is_active`)
  - `classes` (`id`, optional `class_code`/`class_name`, optional canonical sort key)
- Newsletter content blocks:
  - Shared blocks (visible to every guardian payload)
  - Class-targeted blocks (`class_id` scoped)
  - Editorial order (`editorialOrder`) and optional stable dedupe key (`personalizationKey`)
- Render metadata:
  - Newsletter revision identity (`newsletterRevisionId`)
  - Rule version (`rulesVersion`)

At render start, guardian membership input is snapshot-captured and then used consistently for the full composition run.

## Rule Semantics (Task 5.1)

### Ordering

1. Shared blocks are sorted by editorial order, fallback `blockId`.
2. Eligible classes are sorted by canonical class sort key.
3. If no canonical class sort key exists, fallback is lexical `classId`.
4. Within each class, targeted blocks are sorted by editorial order, fallback `blockId`.

### Dedupe

- Class-targeted blocks dedupe by `personalizationKey` when provided.
- If absent, fallback dedupe key is derived from source block identity (`blockId`).
- First encountered block in canonical ordering wins.

### Fallback

- If no eligible class blocks exist, payload still includes all shared blocks.
- `classFallback` is set to `no_eligible_class_blocks` (deterministic marker).

### Rule Versioning and Determinism

- Every payload includes:
  - `rules_version`
  - `input_fingerprint`
- `input_fingerprint` is computed from:
  - `rulesVersion`
  - `newsletterId`
  - `newsletterRevisionId`
  - `guardianId`
  - frozen membership snapshot (`studentId` + `classId`)

## Diagnostics

Composition emits warnings without failing the full run:

- `missing_class_mapping`
- `inconsistent_membership`
- `unknown_target_class`

These warnings are guardian-scoped and include structured details for operators.

## Verification Commands (Task 5.2)

Run the following before merge:

```bash
npm run lint
npm test -- --run
npm run build
```

Expected outcomes:

- Lint exits successfully with no new rule violations.
- Tests pass, including personalization unit/integration suites.
- Production build and TypeScript checks complete successfully.

## Handoff Non-Goals and PM Follow-Up (Task 5.3)

Non-goals for this change:

- Provider campaign orchestration (Kit/SendGrid/etc).
- Analytics/open/click instrumentation.
- Delivery scheduling and retry queue orchestration.

PM follow-up questions:

1. Should class-empty fallback remain metadata-only, or render a visible class section message?
2. If canonical sort keys are missing, is lexical class ID fallback acceptable in production?
3. (Resolved 2026-03-20) Email templates are managed internally in CMS, and publish/send flow must pin `templateRevisionId` per batch.

## Rollout and Backfill Status

- This change implements the deterministic personalization composition service and type contracts only.
- Feature-flag rollout, production send-path wiring, and personalization-key backfill are tracked as follow-up operational work.
- Operators should use this implementation for preview/testing flows until rollout tasks are completed.
