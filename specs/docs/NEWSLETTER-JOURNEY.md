# Newsletter author-to-reader workflow

## Local operation

1. Run Identity on 3000, CMS frontend on 5173, and CMS backend on 8787, reusing the configured databases. Follow RUNTIME-ENVIRONMENTS.md.
2. Create a draft, add or create articles, save content, and set shared/class targeting. Next-week defaults use ISO week-year; the release date is the upcoming Sunday in the browser's local calendar.
3. Select the intended class/family audience. The readiness panel shows eligible families, actual parent recipients and exclusion reasons. Zero eligible recipients blocks publication with delivery.
4. Open Email Templates or Email Preview from admin navigation. Select newsletter, representative family and template, choose the delivery audience, and render. The preview defaults to the sample family only. Changing inputs invalidates it.
5. Publish from the reviewed preview to pin its template revision and audience. The worker loads that immutable revision even if the active template subsequently changes. Outgoing HTML adds signed tracking links and a pixel; visible article content comes from the composition pipeline.
6. Verify the received email in the authorized mailbox, then open an article link in Dia. Sign-in must preserve the requested article; reader authorization remains independent of tracking.
7. Check newsletter/class/article analytics. Email open and click rates use distinct provider-accepted parents as the denominator, not a fixed estimate. Resends count each parent once; known automated/proxy events are excluded from newsletter email rates. Opens are image fetches and are not proof of human reading.

## Database migration

Apply `db/migrations/20260916_newsletter_week_updates.sql` to support draft rescheduling with legacy article week references. It retains the foreign key and existing delete behavior while cascading week updates. The admin editor follows a renamed week to the stable newsletter-ID route. Do not reset or reseed the database.

## Controlled inbox verification

Current newsletter delivery uses Resend, as do Identity magic-link emails. Each parent receives their own rendered subject and HTML directly; no provider merge fields or broadcast audience are involved.

- Keep `DELIVERY_ENABLED=false` until the operator has selected a test mailbox and verified Resend configuration.
- Local sending requires `DELIVERY_ENABLED=true` plus `NEWSLETTER_TEST_RECIPIENTS` containing only the authorized test addresses, comma-separated. The entire send is rejected if any recipient is outside that list. This gate is also honored in hosted environments when configured.
- Configure backend-only `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `JWT_SECRET` and the correct `APP_URL`. Never expose tracking or provider secrets through `VITE_*`.
- Use synthetic relationships with subscribed test parents. Do not change real families' subscription state to make a test pass.
- Start the delivery executor explicitly with `npm run worker:dev` only after checking the audience and secrets. API/frontend startup does not start outbound sending.
- Verify batch status, recipient status, provider identifier, actual sender, actual subject, received content, signed-link destination, sign-in return, article view and before/after analytics.
- `sent` currently means provider handoff accepted, not independently confirmed inbox delivery. Record mailbox receipt separately.
- Completed batches are not reprocessed automatically. A provider timeout leaves `handoff_pending`; reconcile the provider outcome before any retry or explicit resend. Do not clear uncertainty merely because the request timed out.
- Each recipient uses `newsletter/{batchId}/{recipientId}` as its Resend idempotency key. Keys expire after 24 hours; uncertain outcomes must be reconciled, not blindly retried. Each accepted email ID is saved before the next send, and later failures preserve earlier successes.
- Kit broadcast sending and outbound sync/replay/reconciliation endpoints are retired. Legacy Kit columns and inbound historical webhook processing remain for compatibility.
- Resend delivery/bounce/complaint webhook ingestion and suppression reconciliation remain follow-up work. Provider acceptance and CMS pixel/click tracking work independently; neither proves inbox delivery.
- Identity uses its existing `RESEND_API_KEY` and `MAGIC_LINK_FROM`; CMS uses `RESEND_FROM_EMAIL`. Choose a verified sender explicitly. No secret is copied between applications automatically.

## Verification status

Local Dia verification on 2026-09-16 covered saved draft/article rendering, ISO date defaults, persisted release date, zero-recipient blocking with subscription exclusion reasons, email-template content preview and returning to the requested admin preview after fresh-tab sign-in.

Actual authorized mailbox receipt, signed links from that received email, cross-class inbox comparisons, provider concurrency and production-session browser parity remain required before declaring the complete delivery journey ready. Local compatibility-mode success does not establish production readiness.
