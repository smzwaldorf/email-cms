## Context

The editor stack already supports media upload and insertion, but media management is still article-local and does not provide a centralized operational model. `FUTURE-PLANS.md` calls for a dedicated media library, reference tracking, reuse workflows, optimization variants, and a usage dashboard.

This change is cross-cutting: it touches editor UX, media services, storage conventions, reference integrity logic, and reporting queries. Stakeholders are content editors (fast media reuse), admins/operators (storage governance and safe cleanup), and engineering (consistent lifecycle rules).

## Goals / Non-Goals

**Goals:**
- Define a single implementation-ready OpenSpec change for media library and reuse behavior.
- Define normative behaviors for browsing/searching/uploading media and viewing metadata.
- Define deterministic reference-tracking and safe-deletion rules that prevent accidental data loss.
- Define optimization/variant expectations and dashboard metrics for storage governance.
- Provide concrete artifacts that can be delegated to engineering without additional product clarification.

**Non-Goals:**
- Implementing the production code in this planning change.
- Replacing the existing storage provider abstraction.
- Designing advanced CDN/video transcoding architecture beyond required image/audio optimization behavior.
- Redesigning unrelated admin modules outside media lifecycle and analytics surfaces.

## Decisions

### 1. Use a canonical media identity plus append-only usage ledger

Each media asset will be represented by a stable `mediaId` and tracked through an append-only usage ledger (`media_usage`) keyed by `(mediaId, targetType, targetId, contextKey)`. Reference counts and in-use checks are computed from active ledger rows rather than inferred from raw content parsing at delete time.

Rationale:
- Prevents race conditions and ambiguous "is this in use?" checks.
- Supports copy/edit/delete lifecycle events with clear historical traceability.

Alternatives considered:
- Parse article content on demand to compute usage. Rejected due to latency and eventual inconsistency.

### 2. Enforce two-step delete: validation gate then explicit cleanup action

Delete behavior will always run a preflight:
- if active references exist, hard delete is blocked and impacted references are shown;
- if no references exist, deletion is allowed with confirmation and audit metadata.

Rationale:
- Eliminates accidental destructive operations for shared assets.
- Gives operators deterministic cleanup behavior for unused media.

Alternatives considered:
- Force-delete with warning only. Rejected because it allows silent content breakage.

### 3. Reuse-first editor workflow with explicit "insert existing media" entry point

Editors get a dedicated "insert existing media" flow backed by media library search/filter and quick preview. New upload remains available, but reuse is first-class to reduce duplicate assets.

Rationale:
- Directly addresses duplicate uploads and inconsistency across articles.
- Keeps editor ergonomics intact while improving governance.

Alternatives considered:
- Keep upload-only flow and rely on future cleanup jobs. Rejected because it optimizes after duplication already occurs.

### 4. Variant generation is asynchronous with status metadata surfaced in UI

Optimization variants (thumbnail widths, WebP, optional audio conversion) are generated asynchronously after upload. Library/details views expose readiness state so editors can understand availability.

Rationale:
- Prevents blocking editor interactions on heavy processing.
- Makes optimization pipeline observable and debuggable.

Alternatives considered:
- Synchronous optimization before asset availability. Rejected due to slower perceived upload flow and higher timeout risk.

### 5. Dashboard metrics are derived from authoritative media + usage records

Dashboard cards/charts are computed from media metadata, variant metadata, and active usage records with consistent aggregation windows. Unused-media list is generated from "zero active references" logic shared with deletion preflight.

Rationale:
- Keeps operational metrics aligned with deletion safety model.
- Avoids divergent definitions of "unused" across UI features.

Alternatives considered:
- Separate analytics table updated by batch job only. Rejected for higher staleness risk and additional synchronization complexity.

## Risks / Trade-offs

- [Usage ledger drift from editor operations] -> Mitigation: require usage write/update hooks on insert, remove, copy, and article delete flows with reconciliation checks.
- [Asynchronous variant pipeline backlog] -> Mitigation: expose processing state and retries, and define graceful fallback to original asset.
- [Dashboard query cost at scale] -> Mitigation: add indexed aggregation paths and bounded time windows for heavy views.
- [Operator confusion on blocked deletions] -> Mitigation: return actionable reference detail with direct navigation targets.
- [Scope creep into full DAM platform] -> Mitigation: keep this change constrained to defined capabilities and defer advanced taxonomy/workflow features.

## Migration Plan

1. Define/confirm media identity and usage-ledger contracts.
2. Add capability specs for library management, reference governance, and optimization insights.
3. Implement reference write paths in editor/content lifecycle operations.
4. Implement safe-delete preflight and enforcement using active usage checks.
5. Implement variant-generation status exposure and dashboard aggregations.
6. Roll out incrementally with verification gates (`lint`, `test --run`, `build`) and rollback by disabling new media-management entry points while preserving source records.

## Open Questions

- Should "copy article" preserve all references by default, or offer a per-copy option to duplicate selected assets?
- What retention policy should apply to variant files when the original is deleted after references reach zero?
- Do dashboard metrics need tenant/class segmentation in v1, or only global project-level totals?
- What SLA is acceptable for variant readiness after upload before surfacing warning states?
