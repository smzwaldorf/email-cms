## Context

The parent newsletter pipeline today is split across three layers:

- **Authoring**: `AdminEmailTemplateEditorPage.tsx` saves a single `subject_template` + `body_template` (HTML) per `email_template_revisions` row. `validateEmailTemplate` enforces a flat allow-list of nine tokens. `canvaEmailImport.ts` normalizes Canva-exported HTML into one body string.
- **Composition**: `composePersonalizedEmails` (in `personalizedEmailComposer.ts`) builds per-guardian shared+class block lists, then calls `renderNewsletterContentHtml` (in `newsletterEmailRenderer.ts`) — a hard-coded TS function that emits the visual layout (preheader, brand, feature cards, weekly summary, About, footer). The body template's `{{newsletter.content_html}}` token is replaced with that rendered HTML.
- **Delivery**: `newsletterDeliveryService` pins `template_revision_id` and `newsletter_revision_id` per batch, computes an HTML fingerprint, and the `kit-send-newsletter` edge function verifies the fingerprint before per-recipient send.

The Canva file `善美真email Newsletter` (DAG0c4kIIdI) defines the visual structure admins want to maintain: header → one shared "Regarding school" feature card → N "Class news & events" feature cards (one per class) → "The weekly news / 本週重要事情佈達" bullet list → About us → Footer. Today admins cannot reorder, hide, or restyle these sections without touching `newsletterEmailRenderer.ts`. They also cannot change the per-article card markup (image position, excerpt length, CTA copy) without engineering work.

This change introduces a typed-block model that mirrors the Canva structure, makes every section editable in the admin, and routes the per-recipient render through a block walker driven by data the existing composer already produces.

## Goals / Non-Goals

**Goals:**

- Persist a typed, ordered `blocks[]` structure on `email_template_revisions` so admins can reorder, hide, edit, and restyle every visible section of the parent email.
- Eliminate the hard-coded layout in `newsletterEmailRenderer.ts` as the source of truth for the email body; keep its existing default HTML strings only as block-type defaults.
- Preserve deterministic delivery: pinning `template_revision_id` continues to pin the entire `blocks[]` snapshot, and the existing fingerprint check still validates the rendered HTML server-side.
- Keep all per-recipient personalization logic (multi-child class merge, dedup, ordering) in `composePersonalizedEmails` unchanged; only the final HTML rendering step changes.
- Provide a "Apply for merge" admin preview that renders the actual personalized email for a chosen newsletter + sample family before publish.
- Map the existing Canva design to typed blocks on import so the imported result is editable section-by-section, with a `custom-html` fallback when section detection fails.

**Non-Goals:**

- Replacing TipTap with a different editor framework. Per-block authoring continues to use the existing `SimpleEditor` plus an HTML toggle.
- Adopting MJML or React Email as the template language. Blocks store inline-styled HTML compatible with the existing `canvaEmailImport.ts` rules.
- Visual round-trip back into Canva (Phase 6+ as discussed; not in this change).
- Changing how shared vs. class blocks are merged per recipient — `composePersonalizedEmails` keeps its current ordering and dedup rules.
- Changing the `kit-send-newsletter` edge function's send protocol or its server-side fingerprint check.
- Adding a new external dependency (no MJML compiler, no DnD library required for v1; we will use a minimal up/down reorder UX before introducing react-dnd).

## Decisions

### Decision: Store blocks as a JSONB column on `email_template_revisions`

We add a `blocks JSONB NOT NULL DEFAULT '[]'::jsonb` column on `email_template_revisions`. Each row represents one ordered list of `EmailTemplateBlock` records. The existing `subject_template` and `body_template` columns stay; `body_template` is treated as a legacy fallback used only when `blocks` is empty.

**Rationale:** Revisions are immutable snapshots already; storing the entire block list inline keeps pinning trivially correct (`template_revision_id` already pins the whole row). A JSONB column avoids a parallel `email_template_blocks` table and an ordering migration whenever a block is reordered. Postgres JSONB validation can later enforce schema if needed.

**Alternatives considered:**

- Separate `email_template_blocks` table with `revision_id`, `order`, `type`, `body_html`, `config`. Rejected: every reorder is now a multi-row write, harder to snapshot atomically, and the read path always needs a join.
- Store blocks as part of `body_template` in a custom DSL (e.g., HTML comments). Rejected: parsing fragility, no typed validation, harder to render selectively.

### Decision: Eight block types matching the Canva design

Block registry (`src/services/emailTemplateBlocks.ts`):

| `type` | Repeater? | Iterates over | Required `config` keys | Allowed in-body tokens |
|---|---|---|---|---|
| `header` | no | — | `brandName`, `tagline` | global |
| `shared-article-feature` | yes | `recipient.sharedArticles` (capped by `maxItems`) | `eyebrow`, `maxItems`, `excerptLength`, `ctaLabel` | global + `article.*` |
| `class-article-feature` | yes | `recipient.classes`, then `recipient.classArticles[classId]` (capped by `maxItemsPerClass`) | `eyebrow`, `maxItemsPerClass`, `excerptLength`, `ctaLabel` | global + `article.*` + `class.*` |
| `weekly-summary-list` | yes | `recipient.weeklyItems` filtered by `sourceTag` | `sectionTitle`, `sourceTag`, `excerptLength` | global + `article.*` |
| `section-divider` | no | — | `label?` | global |
| `about` | no | — | `schoolMission` | global |
| `footer` | no | — | `tel`, `fax`, `address`, `socials[]` | global |
| `custom-html` | no | — | (none) | global |

**Rationale:** Eight types cover every visible section in the Canva file with one block each. Repeaters cover the only three places where the email already varies per recipient (shared cards, per-class cards, weekly bullet items). `custom-html` is the escape hatch and the back-compat target for legacy single-body revisions.

**Alternatives considered:**

- A single generic `repeater` type with a `dataSource` config. Rejected: the data sources are heterogeneous (each repeater needs different inner tokens and ordering rules), so collapsing them removes type safety without removing complexity.
- Split per-class cards into `class-article-summary` vs `class-article-feature` styles in v1. Deferred: solved by `config.style` once we need it; not required to ship.

### Decision: Per-block token scopes with block-aware validation

`validateEmailTemplate` is extended to take `blocks?: EmailTemplateBlock[]`. The subject template and the legacy `body_template` continue to validate against the existing global token set. Each block's `bodyHtml` validates against `globalTokens ∪ blockType.allowedScopeTokens`. Tokens like `article.title` are only valid inside repeater blocks; using them in `header.bodyHtml` is an `unsupported_token` issue scoped to that block.

**Rationale:** Per-article tokens have no meaning outside a repeater; validating their scope at save time catches authoring mistakes before delivery and matches the way the renderer actually expands tokens.

**Alternatives considered:**

- A single global registry that includes article tokens. Rejected: produces empty strings everywhere outside repeaters and silently degrades email content.
- Runtime-only validation. Rejected: pushes errors to send time; admins want fast feedback during authoring like they have today.

### Decision: Block-walker renderer replaces `renderNewsletterContentHtml` in the composer

A new `src/services/emailTemplateRenderer.ts` exports `renderTemplateForRecipient(blocks, context)`. `composePersonalizedEmails` constructs a `RecipientRenderContext` ( `{ guardian, classes, sharedArticles, classArticles, weeklyItems, staticTokens, journeyCorrelationId }` ) from the data it already builds, then calls the walker once per guardian. The walker sorts by `order`, skips `visible: false`, and dispatches by `type`: static blocks call `renderTokens(block.bodyHtml, staticTokens)`; repeater blocks loop over their data slice and call `renderTokens(block.bodyHtml, mergedScope)` per item; the walker concatenates results and wraps with the existing email document shell.

The composer keeps producing `renderedSubject`, `renderedBody`, and `renderedHtmlFingerprint` exactly as today; the only change is *how* `renderedBody` is produced. The fallback when `blocks` is empty is to call the legacy single-body path (current behavior) so back-compat is automatic.

**Rationale:** Confining the change to one swap inside the composer keeps `personalizedEmailComposer.ts`, `emailContentPreparationService`, `newsletterDeliveryService`, and `kit-send-newsletter` behavior identical. Pinning and fingerprinting work without modification.

**Alternatives considered:**

- Render at save time and store the compiled HTML in `body_template`. Rejected: kills personalization (every recipient gets a different rendered HTML).
- Render in the edge function from `blocks`. Rejected: edge function would need access to article/class data; currently it only verifies fingerprints.

### Decision: One-time backfill of legacy revisions into a single `custom-html` block

The migration sets `blocks` for every existing `email_template_revisions` row to:

```json
[{ "type": "custom-html", "order": 0, "visible": true, "bodyHtml": "<existing body_template>", "config": {} }]
```

The walker treats `custom-html` as: render `bodyHtml` once with the global token scope. This produces byte-identical output to the legacy path for every existing revision, which keeps fingerprints stable for any in-flight delivery batch and any historical send replayed for audit.

**Rationale:** Zero-touch migration; existing pinned batches continue to render the same HTML; admins can opt into the new editor when they next edit a template.

**Alternatives considered:**

- Auto-segment legacy bodies into typed blocks during migration. Rejected: legacy bodies are arbitrary HTML; segmentation would change rendered output and invalidate fingerprints.

### Decision: Canva import maps detected sections to typed blocks, falls back to `custom-html`

`canvaEmailImport.ts` gains `detectCanvaSections(html): EmailTemplateBlock[] | null`. Detection is best-effort and uses three signals in order:

1. Explicit HTML comment markers `<!-- block:<type> -->` ... `<!-- /block -->` (designers can add these via Canva's HTML widget).
2. Heading/text patterns matching the Canva file: `SMZ School News` → `header`; `Regarding school` → `shared-article-feature`; `Class news & events` → `class-article-feature`; `The weekly news` / `本週重要事情佈達` → `weekly-summary-list`; `About us` / `認識 善美真` → `about`; trailing block with `TEL` + `FAX` → `footer`.
3. If neither (1) nor (2) yields at least three matched sections, return `null` and the importer falls back to a single `custom-html` block (current behavior).

When detection succeeds, each detected segment becomes a block of the matched type with `bodyHtml` set to that segment's normalized HTML and `config` initialized from the registry defaults.

**Rationale:** Designers should not have to learn a new tool; the existing Canva file already has stable text labels we can use. Marker comments give designers a way to be explicit when the heuristic is wrong, without forcing markers in v1.

**Alternatives considered:**

- Require explicit markers always. Rejected: blocks adoption on the existing Canva file unless re-edited.
- Use a third-party email parser. Rejected: adds dependency weight; the heuristic + fallback is sufficient for the in-house design.

### Decision: Block list UI uses the existing TipTap editor per block, with up/down reorder in v1

`AdminEmailTemplateEditorPage.tsx` renders an `EmailTemplateBlockList` of cards. Each card has: visibility toggle, type label, up/down reorder buttons, "Edit body" expander (mounts `SimpleEditor` with the block's `bodyHtml` plus a TipTap/HTML toggle), and an `EmailTemplateBlockConfigPanel` rendering the block type's `config` form. Saves write the full `blocks[]` to `updateTemplateRevision`, which persists a new revision with the snapshot.

Drag-and-drop reorder is intentionally deferred to a follow-up to keep this change scoped; up/down arrows cover reorder needs for eight typical blocks.

**Rationale:** Reusing `SimpleEditor` keeps editing UX consistent with article editing; arrow-button reorder ships in this change without pulling in `react-dnd` and its accessibility surface.

**Alternatives considered:**

- Drag-and-drop in v1 with `react-beautiful-dnd` or `dnd-kit`. Deferred: scope risk; can be added later without changing the data model.
- A read-only "structure preview" with edits restricted to text. Rejected: defeats the purpose of letting admins restructure the email.

### Decision: "Apply for merge" preview replaces the fixture-based preview page

`NewsletterEmailPreviewPage.tsx` today renders a hard-coded fixture (`createNewsletterWorkflowFixture`). It becomes an admin page that:

1. Picks a newsletter (defaults to the most recent draft).
2. Picks a "sample family" from `families` (or accepts a manual `family_id`).
3. Calls a thin wrapper that mirrors `newsletterDeliveryService.createPublishBatch` *without* persisting a batch — running `composePersonalizedEmails` with the chosen newsletter, the active template (or a chosen template), and the sample family's guardian/class data.
4. Renders the resulting HTML inside the existing preview frame and lists `PreparationFinding`s and `PersonalizationWarning`s.
5. Exposes a "Confirm and publish" button that actually calls `createPublishBatch` for the full audience.

**Rationale:** Closes the loop: admins see the merged-with-real-data output before triggering Kit. Reuses the composer, so what's previewed is exactly what gets sent.

**Alternatives considered:**

- Keep the fixture page and add a separate admin preview elsewhere. Rejected: two preview surfaces drift; the fixture page is already the "rendered email" surface and should be made real.

## Risks / Trade-offs

- [Existing pinned batches change byte output after migration] → Mitigated: legacy revisions backfill into a single `custom-html` block; the walker reproduces byte-identical output. Add a regression test that compares pre- and post-migration `renderedHtmlFingerprint` for a fixture revision.
- [Per-block token validation rejects existing templates that include article tokens in legacy single-body templates] → Mitigated: legacy `body_template` continues to validate against the global token set (article tokens allowed there because the legacy renderer expanded them inside `{{newsletter.content_html}}`). Only *block* `bodyHtml` is scope-validated.
- [Canva detection misclassifies sections on future redesigns] → Mitigated: when detection produces fewer than three matches the importer falls back to a single `custom-html` block (current behavior). Designers can override by adding `<!-- block:<type> -->` markers.
- [Block list UI without DnD feels clunky for >8 blocks] → Accepted for v1; up/down arrows cover the eight-block Canva layout. DnD is a follow-up change.
- [JSONB schema drift over time as block configs evolve] → Mitigated: each block stores its `type`, and the renderer reads `config` keys defensively (missing keys fall back to registry defaults). A future change can add a `schema_version` field to a block when needed.
- [Larger `email_template_revisions` rows due to inline HTML per block] → Accepted: a typical revision is < 50 KB inline; well within Postgres JSONB performance envelope. No change to read patterns.
- [Edge function fingerprint mismatch during rollout if walker output differs from legacy renderer for non-`custom-html` blocks] → Mitigated: the walker is only invoked when `blocks` is non-empty; legacy revisions stay on the legacy path until they are explicitly re-saved as typed blocks. New typed blocks compute their own fingerprint at composition time; the edge function compares against that.

## Migration Plan

1. **Migration** (`supabase/migrations/<timestamp>_add_email_template_blocks.sql`):
   - `ALTER TABLE email_template_revisions ADD COLUMN blocks JSONB NOT NULL DEFAULT '[]'::jsonb;`
   - Backfill: `UPDATE email_template_revisions SET blocks = jsonb_build_array(jsonb_build_object('type', 'custom-html', 'order', 0, 'visible', true, 'bodyHtml', body_template, 'config', '{}'::jsonb)) WHERE jsonb_array_length(blocks) = 0;`
2. **Type & service rollout** (no UI change yet): introduce `EmailTemplateBlock` types, `emailTemplateBlocks.ts` registry, `emailTemplateRenderer.ts` walker, and switch `composePersonalizedEmails` to call the walker when `blocks.length > 0`. Existing tests must continue to pass; add a fingerprint regression test that asserts the walker over a `custom-html` block matches the legacy renderer output for a sample template.
3. **Validator update**: extend `validateEmailTemplate` with optional `blocks` parameter; existing call sites pass `undefined` and behave as before.
4. **Editor UI**: ship the block list editor behind the existing template editor route; default to block view when `blocks.length > 0`, fall back to the current single-body editor when it's a legacy revision until the admin clicks "Convert to blocks".
5. **Canva importer**: ship `detectCanvaSections` with the existing fallback behavior preserved.
6. **Apply-for-merge preview**: rewrite `NewsletterEmailPreviewPage.tsx` to the admin preview described above. Keep the existing route accessible for QA.
7. **Rollback strategy**: the migration is additive (one nullable-default column). To roll back code without data loss, revert the composer to call `renderNewsletterContentHtml` directly; `blocks` data remains in the table but is ignored. To roll back data, drop the column (`ALTER TABLE email_template_revisions DROP COLUMN blocks;`) — legacy `body_template` is the source of truth and is untouched.
