## 1. Canva import foundations

- [x] 1.1 Implement `Decision: Normalize full-document exports into a saveable body fragment with explicit compatibility findings` in a shared import utility that extracts a body fragment from pasted or uploaded Canva HTML.
- [x] 1.2 Implement `System validates Canva import compatibility before revision save` by adding compatibility checks for unsupported constructs, unsafe protocols, and empty normalized results.
- [x] 1.3 Implement `Decision: Preserve validated imported HTML as the canonical template revision body` and `System preserves accepted imported markup for downstream reuse` in template save/load service paths so accepted imports remain canonical revision HTML.

## 2. Admin template workflow

- [x] 2.1 Implement `Admin can import Canva-authored HTML into an email template revision` in `src/pages/AdminEmailTemplateEditorPage.tsx` for both paste and `.html` upload entry points.
- [x] 2.2 Update the editor to satisfy `Admin can manage email templates` when the body source is imported Canva HTML, including create and update flows that persist the preserved imported markup.
- [x] 2.3 Implement `Decision: Reuse a shared Canva-import validation pipeline across editor save, preview, and preparation` in the admin editor so import findings and canonical HTML come from the shared validator instead of component-local logic.
- [x] 2.4 Update preview handling to satisfy `System provides deterministic template preview` for imported revisions, using the preserved canonical imported HTML instead of regenerated editor output.

## 3. Preparation and regression coverage

- [x] 3.1 Update preparation/composition services to satisfy `System prepares send-ready email payloads from pinned inputs` when the pinned template revision originated from accepted Canva HTML.
- [x] 3.2 Extend preparation validation to satisfy `System validates required content and token resolution before handoff` for imported template revisions and incompatible canonical HTML.
- [x] 3.3 Add targeted unit/integration tests covering `Admin can import Canva-authored HTML into an email template revision`, `System validates Canva import compatibility before revision save`, `System provides deterministic template preview`, and `System prepares send-ready email payloads from pinned inputs`.
