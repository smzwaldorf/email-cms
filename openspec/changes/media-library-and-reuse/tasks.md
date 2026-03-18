## 1. Data model and contracts

- [x] 1.1 Define and migrate `media_usage` persistence contracts (media id, target type/id, context key, active flag, timestamps).
- [x] 1.2 Add/extend media variant metadata schema for thumbnail/WebP/audio-derived assets and processing status.
- [x] 1.3 Implement typed service-layer interfaces for usage-ledger writes (insert/remove/copy/delete hooks) and safe-delete preflight queries.

## 2. Reference governance and safe deletion

- [x] 2.1 Wire usage-ledger creation/removal into editor media insert/remove operations.
- [x] 2.2 Wire usage-ledger updates into article delete and article copy flows so references remain accurate.
- [x] 2.3 Implement safe-delete preflight API/service that blocks deletion when active references exist and returns impacted contexts.
- [x] 2.4 Add auditable unused-media delete flow with mandatory re-validation at execution time.

## 3. Media library management and reuse UX

- [x] 3.1 Build media library browsing UI with grid/list toggle, search, filter, and sort controls.
- [x] 3.2 Add media details panel showing metadata (dimensions/duration, upload time, file info, active usage count, optimization status).
- [x] 3.3 Implement drag-and-drop upload integration in media library with validation feedback.
- [x] 3.4 Add editor "insert existing media" picker backed by media library search/filter endpoints.

## 4. Optimization variants and dashboard insights

- [x] 4.1 Implement asynchronous image variant generation (configured thumbnail widths and WebP) with retry/error status tracking.
- [x] 4.2 Implement optional audio optimization/conversion pipeline hook and persist variant readiness metadata.
- [x] 4.3 Build media dashboard cards/charts for storage utilization, media-type distribution, and top-used ranking.
- [x] 4.4 Build unused-media candidate list derived from zero active references and connect to safe-delete action.

## 5. Verification and rollout readiness

- [x] 5.1 Add unit tests for usage-ledger reconciliation, safe-delete gating, and variant-status transitions.
- [x] 5.2 Add integration tests for editor reuse flows, article copy reference preservation, and dashboard cleanup behavior.
- [x] 5.3 Update operator/developer docs for media governance workflows, deletion semantics, and dashboard metric definitions.
- [x] 5.4 Run verification commands (`npm run lint`, `npm test -- --run`, `npm run build`) and capture results in implementation handoff.
