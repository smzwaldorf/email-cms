# Newsletter email engagement via Resend

`POST /api/webhooks/resend` accepts `email.delivered`, `email.opened`, and
`email.clicked`. No CMS session is required: authentication uses the Resend
endpoint's `RESEND_WEBHOOK_SECRET`, the exact raw body, and the Svix headers.
Requests outside a five-minute timestamp window or with invalid signatures are
rejected. Bodies are limited to 256 KiB.

## Activate

1. Apply the additive migration `db/migrations/20260922_resend_webhooks.sql` to
   the database used by the target backend. Do not run the destructive schema
   reset script. `db/schema.sql` includes the table for fresh installations.
2. Deploy the updated backend and frontend.
3. Create a Resend webhook targeting the public HTTPS backend URL plus
   `/api/webhooks/resend`. Subscribe to the three events listed above.
4. Store that endpoint's signing secret as `RESEND_WEBHOOK_SECRET` on the backend
   (a Worker secret in Cloudflare; an environment variable for Node). It is not
   the Resend sending API key. Restart the Node backend if applicable.
5. Send an explicitly authorized test newsletter through that same environment.
   Open it with images enabled, then click a link. Verify the webhook attempts
   return 200 and the corresponding newsletter metrics update. A local backend
   requires a public HTTPS tunnel connected to its own database. Do not route
   locally generated email IDs into a different environment's database.

No domain change, deployment, migration, webhook registration, or email send is
performed by adding this code. Existing emails whose delivery events were never
received will not gain a delivery denominator automatically; replay available
provider events after activation or verify using a new authorized test send.

## Attribution and reliability

The saved `provider_message_id` maps the event to exactly one delivery recipient
and its newsletter. Recipient addresses and provider tags are not trusted for
attribution. A missing, ambiguous, or parentless mapping returns 503 for provider
retry. This includes events racing ahead of send-response persistence. Resend
retries are finite: monitor failed attempts and replay them after resolving
mapping or database issues. Emails sent by other applications in the same Resend
account have no CMS mapping and require separate handling; scope operational
monitoring accordingly.

A PostgreSQL transaction inserts the raw event into `resend_webhook_events` and
its attributed analytics row together. The unique Svix event ID prevents duplicate
processing, including concurrent retries. Failures roll back both writes. Raw
payloads are retained server-side for auditing; responses/logs omit their contents.
Event occurrence time is retained. Opens and clicks can arrive before delivery;
metrics become available when delivery confirmations arrive. No event overwrites
another event's delivery status.

Newsletter email rates use only `metadata.source = resend` events:

- Open rate: distinct delivered parent IDs with `email_open` / distinct delivered
  parent IDs, multiplied by 100.
- Click rate: distinct delivered parent IDs with `email_click` / distinct delivered
  parent IDs, multiplied by 100.

Repeated events and resends count the same parent once per newsletter. No delivery
confirmations means unavailable, not a fabricated 0% rate. Provider acceptance is
still reported as `sentRecipients`; the denominator is `deliveredRecipients`.
Resend clicks include any email link. CMS `link_click` events remain separate for
article attribution; its legacy pixel does not contribute to these email rates.
Both frontend and backend aggregators use this definition. Open events are image
loads, not proof of reading; privacy prefetch and blocking affect their accuracy.

## Verification

Focused tests:

```sh
npm run test -w @email-cms/backend -- tests/unit/services/resendWebhook.test.ts tests/unit/services/newsletterMetrics.test.ts tests/integration/resend-webhook-route.test.ts
npm run test -w @email-cms/frontend -- tests/unit/services/analyticsAggregator.test.ts
RUN_RESEND_DB_TESTS=true npm run test -w @email-cms/backend -- tests/integration/resend-webhook-db.test.ts
```

The opt-in PostgreSQL test requires a localhost `DATABASE_URL` and creates only
connection-local temporary tables. It verifies rollback, replay, and out-of-order
persistence without changing existing tables or sending email.
