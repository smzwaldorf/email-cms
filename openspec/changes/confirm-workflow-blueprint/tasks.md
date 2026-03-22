## 1. Workflow contract and data model alignment

- [ ] 1.1 Define and document the canonical seven-step workflow states and required handoff payload fields across publish, preparation, delivery, analytics, auth, and reader.
- [ ] 1.2 Add persistence model updates for preparation job records and per-recipient readiness/findings needed by send orchestration.
- [ ] 1.3 Add correlation identifiers linking delivery events, click/open tracking, auth callback, and final article-view analytics.

## 2. Preparation and delivery orchestration

- [ ] 2.1 Wire preparation flow into send orchestration entrypoints and enforce pinned input references (newsletter revision, template revision, snapshot, rules version).
- [ ] 2.2 Implement ready-only delivery handoff contract and preserve failed recipients for correction.
- [ ] 2.3 Implement retry flow for previously failed recipients against newly pinned inputs.

## 3. Click-through auth and redirect fidelity

- [ ] 3.1 Implement deep-link preservation for `/week/:weekNumber/:shortId`, `/newsletter/:newsletterId/:shortId`, and `/article/:articleId` across unauthenticated access.
- [ ] 3.2 Ensure login/magic-link/auth-callback flow restores the exact intended destination after successful authentication.
- [ ] 3.3 Add redirect normalization logic so selected article is shown consistently after callback and route cleanup.

## 4. Journey analytics coverage and verification

- [ ] 4.1 Implement/confirm email open and click event ingestion distinct from on-site page-view/session events.
- [ ] 4.2 Add integration tests for happy path, auth-interrupted path, and mixed preparation outcomes.
- [ ] 4.3 Add verification tests for analytics continuity and post-auth article landing correctness.
