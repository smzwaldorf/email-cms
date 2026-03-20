# Personalized Email System Handoff

## Delivered Scope

- Deterministic personalization composition service:
  - render-start snapshot capture
  - shared + class-targeted block resolution
  - canonical class/block ordering
  - multi-child merge with stable dedupe
  - fallback behavior for no eligible class blocks
  - rules metadata (`rules_version`, `input_fingerprint`)
  - structured warnings/diagnostics
- Unit and integration test coverage for the above behavior.
- Operator/maintainer documentation for input model, rule semantics, and
  verification commands.

## Explicit Non-Goals (Not Implemented Here)

- Email provider campaign orchestration (Kit/SendGrid/etc).
- Analytics/open/click instrumentation.
- Delivery scheduling, retries, or queue orchestration.

## PM Follow-Up Questions

1. Should class-empty fallback remain metadata-only, or should templates render
   a standardized visible class section message?
2. If canonical sort keys are missing, is lexical class ID fallback acceptable
   for production, or should we mandate a persisted admin order?
3. Do future templates require per-child attribution labels inside class
   sections, or is class-level grouping sufficient for v1?
