## 1. Data model and contracts

- [ ] 1.1 Define and migrate `media_usage` persistence contracts (media id, target type/id, context key, active flag, timestamps).
- [ ] 1.2 Add/extend media variant metadata schema for thumbnail/WebP/audio-derived assets and processing status.
- [ ] 1.3 Implement typed service-layer interfaces for usage-ledger writes (insert/remove/copy/delete hooks) and safe-delete preflight queries.

## 2. Reference governance and safe deletion

- [ ] 2.1 Wire usage-ledger creation/removal into editor media insert/remove operations.
- [ ] 2.2 Wire usage-ledger updates into article delete and article copy flows so references remain accurate.
- [ ] 2.3 Implement safe-delete preflight API/service that blocks deletion when active references exist and returns impacted contexts.
- [ ] 2.4 Add auditable unused-media delete flow with mandatory re-validation at execution time.

## 3. Media library management and reuse UX

- [ ] 3.1 Build media library browsing UI with grid/list toggle, search, filter, and sort controls.
- [ ] 3.2 Add media details panel showing metadata (dimensions/duration, upload time, file info, active usage count, optimization status).
- [ ] 3.3 Implement drag-and-drop upload integration in media library with validation feedback.
- [ ] 3.4 Add editor "insert existing media" picker backed by media library search/filter endpoints.

## 4. Optimization variants and dashboard insights

- [ ] 4.1 Implement asynchronous image variant generation (configured thumbnail widths and WebP) with retry/error status tracking.
- [ ] 4.2 Implement optional audio optimization/conversion pipeline hook and persist variant readiness metadata.
- [ ] 4.3 Build media dashboard cards/charts for storage utilization, media-type distribution, and top-used ranking.
- [ ] 4.4 Build unused-media candidate list derived from zero active references and connect to safe-delete action.

## 5. Verification and rollout readiness

- [ ] 5.1 Add unit tests for usage-ledger reconciliation, safe-delete gating, and variant-status transitions.
- [ ] 5.2 Add integration tests for editor reuse flows, article copy reference preservation, and dashboard cleanup behavior.
- [ ] 5.3 Update operator/developer docs for media governance workflows, deletion semantics, and dashboard metric definitions.
- [ ] 5.4 Run verification commands (`npm run lint`, `npm test -- --run`, `npm run build`) and capture results in implementation handoff.
