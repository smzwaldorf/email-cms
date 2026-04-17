## Context

The codebase already supports reusable email templates, revisioned storage, token validation, deterministic preview, and a basic raw-HTML import path in `AdminEmailTemplateEditorPage`. That import path is implementation-only today: it does not define what qualifies as a valid Canva export, how much document structure is preserved, or how preview and preparation must treat imported HTML revisions.

Canva-authored email layouts are more constrained than general rich-text content. They often arrive as full HTML documents with wrappers, table-heavy layout markup, inline styles, remote images, and extra tags that do not belong in the canonical template body stored by the CMS. The change must therefore define a single import contract that admins can trust and the preparation pipeline can replay deterministically.

## Goals / Non-Goals

**Goals:**

- Allow admins to create or update reusable email templates from Canva-exported HTML.
- Define which parts of an imported Canva export are accepted, normalized, rejected, or preserved.
- Ensure the saved revision body used in preview is the same canonical HTML body later used during email-content preparation.
- Surface actionable validation feedback when imported content is unsafe or incompatible with the system's email-template rules.

**Non-Goals:**

- Building a visual Canva integration, OAuth connection, or direct Canva API sync.
- Creating a drag-and-drop email builder inside the CMS.
- Redesigning newsletter article composition or replacing existing token semantics.
- Adding a new delivery provider or changing downstream ESP orchestration.

## Decisions

### Decision: Preserve validated imported HTML as the canonical template revision body

Accepted Canva imports SHALL be stored as canonical revision HTML after import validation and normalization, and the system SHALL reuse that stored HTML for preview and preparation. The implementation SHALL NOT round-trip imported content through TipTap serialization before save because that can rewrite table markup, class/style structure, and whitespace in ways that diverge from the approved design.

This makes the revision the single source of truth for preview and sending, and keeps deterministic replay aligned with what admins approved.

Alternative considered: treat Canva HTML as a temporary authoring aid, then convert it into editor-generated markup before saving. Rejected because the conversion would likely drift from the source design and make preview/send parity hard to guarantee.

### Decision: Normalize full-document exports into a saveable body fragment with explicit compatibility findings

The import flow SHALL accept pasted or uploaded HTML that may include document-level wrappers such as `<html>`, `<head>`, and `<body>`, but the persisted revision SHALL contain only the saveable body fragment plus supported inline markup. The validator SHALL explicitly reject or strip unsupported constructs such as scripts, forms, active embeds, non-HTTPS asset links, and empty results after normalization.

This allows admins to work with real Canva exports while keeping stored template bodies compatible with the existing template model and downstream rendering path.

Alternative considered: require admins to manually trim Canva exports to a CMS-ready fragment before import. Rejected because it pushes fragile HTML cleanup onto admins and creates inconsistent saved results.

### Decision: Reuse a shared Canva-import validation pipeline across editor save, preview, and preparation

The change SHALL introduce a shared validation/normalization path for imported Canva HTML so that the editor save flow, template preview flow, and email-content preparation all reason about the same accepted revision body. Token validation remains part of the existing template validation layer, while Canva-import validation adds HTML compatibility and asset-safety checks before a revision is accepted.

This keeps compatibility logic out of individual UI components and prevents drift between save-time checks and preparation-time rendering.

Alternative considered: perform Canva compatibility checks only in the editor UI. Rejected because hidden service-level gaps would allow invalid HTML to bypass UI-only enforcement and break replay or future integrations.

## Risks / Trade-offs

- [Risk] Canva exports can include markup patterns that render differently across preview and real email clients. -> Mitigation: keep the import contract limited to supported email-safe constructs and add preview/preparation regression tests around representative Canva fragments.
- [Risk] Stripping unsupported wrappers or tags can surprise admins who expect pixel-perfect parity with raw Canva output. -> Mitigation: report compatibility findings clearly before save and preserve accepted markup exactly after normalization.
- [Trade-off] Strict compatibility checks will reject some Canva features instead of attempting best-effort support. -> Mitigation: document the supported import subset and make failure reasons specific enough for template cleanup.

## Migration Plan

1. Add shared Canva-import normalization and compatibility validation utilities alongside the existing email-template validation helpers.
2. Update the admin email template editor to run Canva-import validation for pasted/uploaded HTML, preserve accepted canonical HTML revisions, and display import findings before save.
3. Update preview and preparation services to reuse the saved canonical imported HTML revision without editor reserialization.
4. Add targeted tests for accepted Canva imports, rejected constructs, and preview/preparation parity using imported template revisions.
5. Rollback strategy: disable the Canva import entry points and continue using manual template authoring while leaving existing non-import template revisions unaffected.

## Open Questions

- None at proposal time; the change intentionally limits scope to imported HTML from exported Canva designs rather than direct Canva platform integration.
