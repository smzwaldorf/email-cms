## Why

Editors currently upload media inside article workflows, but there is no unified way to discover, reuse, and safely govern assets across newsletters. As media volume grows, missing reference tracking and optimization controls increase storage cost, duplicate uploads, and deletion risk, so this should be formalized now before broader admin workflows scale.

## What Changes

- Add a first-class media library experience with grid/list browsing, search, filter, sort, metadata details, and drag-and-drop upload.
- Add durable media usage tracking so each media file records where it is referenced and updates reference counts when content is edited, copied, or deleted.
- Add safe deletion controls that block deletion for in-use media and provide explicit cleanup workflows for unused assets.
- Add media reuse workflows in editors, including selecting existing assets from the media library and preserving references during article copy workflows.
- Add optimization behavior for generated variants (thumbnail sizes and WebP) and persistence of variant metadata.
- Add a media dashboard for storage utilization, media-type distribution, top-used assets, and unused-media cleanup candidates.

## Capabilities

### New Capabilities
- `media-library-management`: Browse, search, filter, inspect, and upload shared media assets from a centralized library.
- `media-reference-governance`: Track media references across content operations, enforce safe deletion, and preserve references on copy flows.
- `media-optimization-insights`: Generate and manage optimized media variants, and expose operational insights via a usage dashboard.

### Modified Capabilities
- None.

## Impact

- Affected product areas: editor media selection UX, media management pages, and admin analytics surfaces.
- Affected code areas: media services (`mediaService`, `articleMediaManager`, `storageService`), editor components, and new dashboard/query endpoints.
- Data model impact: `media_usage` reference records, variant metadata storage, and aggregate reporting queries.
- Operational impact: reduced duplicate uploads, safer deletion behavior, and better storage governance visibility.
