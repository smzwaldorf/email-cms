## Why

Operators need one confirmed, end-to-end workflow from authoring to authenticated article access from email links. The current system has strong individual pieces (publish, auth, reader, Kit sync, preparation service) but lacks a single product-level contract that defines how they connect and what "done" means for delivery and analytics.

## What Changes

- Define and confirm the canonical newsletter-to-reader workflow as:
  1. Write newsletter
  2. Publish
  3. Send email
  4. Open email analytics
  5. Attempt to show article from email
  6. Auth to visit the website
  7. Redirect to show article
- Specify required handoff data and states between publish, preparation, delivery, analytics tracking, auth callback, and final article rendering.
- Define deterministic preparation + ready-only delivery expectations so invalid recipients do not block valid sends.
- Define click/open tracking behavior and deep-link redirect behavior for both authenticated and unauthenticated recipients.
- Define verification criteria for mixed-outcome sends, post-login redirect fidelity, and analytics/event completeness across the journey.

## Capabilities

### New Capabilities
- `newsletter-email-reader-journey`: End-to-end operational and product contract for compose/publish/send/track/auth/redirect behavior across the full recipient journey.

### Modified Capabilities
- `personalized-email-workflow`: Extend requirements to include explicit delivery handoff constraints and retry expectations in the full journey context.
- `kit-contact-sync`: Clarify where provider sync fits relative to content preparation and send readiness.

## Impact

- Affected services: `emailContentPreparationService`, delivery orchestration entrypoints, auth callback redirect handling, and analytics/tracking event ingestion.
- Affected routes/UX: protected deep links (`/week/:weekNumber/:shortId`, `/newsletter/:newsletterId/:shortId`, `/article/:articleId`), login + callback redirection behavior.
- Affected operations: batch review summaries, ready-vs-failed recipient handling, retry from failed subsets, and post-send analytics interpretation.
