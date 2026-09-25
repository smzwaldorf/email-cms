# Hosted newsletter demo readiness

## Deployment boundary

Local reset and browser checks do not authorize a hosted reset, role reassignment, deployment, or email send. Release through reviewed commits and the existing main-branch CI pipeline. The workflow intentionally does not seed a production database automatically.

## Required configuration

The normal production configuration uses no `NEWSLETTER_TEST_RECIPIENTS` setting and defaults `NEWSLETTER_DEMO_MODE=false`. The generated Worker configuration sets `DELIVERY_ENABLED=true` and schedules queued jobs every minute. For a controlled hosted demo, set `NEWSLETTER_DEMO_MODE=true` and `NEWSLETTER_TEST_RECIPIENTS=harryworld@gmail.com,hacktofire@gmail.com` in the deployment environment **before deploying and publishing the demo newsletter**. The configuration generator requires exactly two distinct demo recipients. Confirm the generated Worker variables and actual audience before publication; setting shell variables only for the seed command does not change the deployed Worker.

CMS environment secrets: existing `CLOUDFLARE_API_TOKEN`, `CMS_SESSION_SECRET`, `CMS_OIDC_CLIENT_SECRET`, plus `RESEND_API_KEY`, `RESEND_FROM_EMAIL` (a verified sender), and an independent persistent `JWT_SECRET` of at least 32 characters for signed tracking links. Secrets stay server-side. Provisioning validates all inputs before writing any secret. Never rotate the tracking key just to run a demo; rotation invalidates existing links.

Confirmed Resend delivery/open/click metrics require separate [webhook activation](RESEND-WEBHOOKS.md): register the public endpoint and add its `RESEND_WEBHOOK_SECRET` as a Worker secret. The CI bulk secret step provisions the sending and tracking secrets above, but does not provision the webhook signing secret or create the Resend webhook. Verify the secret remains present after subsequent deployments.

Auth must configure a separate approved administrator and `STAGING_PARENT_EMAILS=harryworld@gmail.com,hacktofire@gmail.com`. Check Auth's current `scripts/demo-families.json` and seed collision guards; its older prose may still name a different Parent B. The existing deployment reserves `smzwaldorf.education@gmail.com` as its admin; Demo Parent B uses `hacktofire@gmail.com`, separately from that administrator. The Auth seed and existing unverified demo identity were updated together; sent CMS delivery snapshots retain their original recipient address. Prefer an explicitly provisioned isolated hosted demo with a separate admin; worker names, origins, resource audience, client callbacks and bindings must all match that environment.

## Migrations on an existing CMS database

The workflow executes `node scripts/cloudflare-migrate.mjs` before deploying. Normal deployments apply the additive migrations (sessions, newsletter week cascade, identity coexistence, and Resend webhooks). Identity retirement is included only when its one-time controls are supplied. Migrations run in one transaction with a checksum journal, lock existing public tables, fingerprint retained content/history, and roll back on any mismatch.

If legacy identity tables exist, first take and verify a database backup and reconcile reviewed canonical Auth ID mappings in `identity_reference_mappings`. Then, only for the approved migration, set `CMS_IDENTITY_RETIREMENT_APPROVED=true` and `CMS_IDENTITY_BACKUP_REFERENCE` to the backup/audit reference. Unmapped pending/opt-out families fail closed. Never invent mappings based solely on email or assume these flags themselves perform reconciliation. For an already-retired database, no retirement approval is needed. Remove one-time approval after migration. No script performs a hosted database reset.

Set `CMS_MIGRATION_DRY_RUN=true` with those controls to rehearse the same migration and preservation checks, then roll back. Unset it for the approved commit. Retirement verifies all nine legacy identity tables are absent before committing. It removes inbound legacy foreign keys while retaining historical UUIDs, CMS audit records, OIDC actor links, and newsletter preferences. The coexistence migration alone does not remove those foreign keys and cannot complete the Auth-backed delivery cutover.

## Explicit hosted seed procedure

Use the intended release checkout and a secure shell with the direct database connection supplied as `DATABASE_URL`. Do not paste URLs/passwords into source or logs. Inventory existing identities before applying: the new seed aborts on collisions and never merges real users. A partial fixture aborts; investigate instead of deleting rows.

Auth, after current migrations and separate normal admin/OIDC bootstrap (the Auth `seed:demo-admin` command requires an explicit separate admin inbox; use `--check` before a separately authorized `--apply`):

```sh
export NODE_ENV=production ENABLE_DEV_LOGIN=false
export DEMO_PARENT_A_EMAIL=harryworld@gmail.com
export DEMO_PARENT_B_EMAIL=hacktofire@gmail.com
# Set DATABASE_URL privately to the intended Auth DB.
export DEMO_DATABASE_CONFIRM='actual-auth-host/actual-auth-database'
npm run seed:demo -- --check
# Execute only at the separately authorized hosted seed stage:
npm run seed:demo -- --apply
```

CMS, after all migrations:

```sh
export NODE_ENV=production DELIVERY_ENABLED=false NEWSLETTER_DEMO_MODE=true
export NEWSLETTER_TEST_RECIPIENTS=harryworld@gmail.com,hacktofire@gmail.com
# Set DATABASE_URL privately to the intended CMS DB.
export DEMO_DATABASE_CONFIRM='actual-cms-host/smz-cms'
# Set true only after the operator confirms both controlled inboxes are opted in.
export DEMO_SUBSCRIPTIONS_CONFIRMED=true
npm run seed:demo -- --check
# Execute only at the separately authorized hosted seed stage:
npm run seed:demo -- --apply
```

Check mode executes inserts in a rolled-back transaction. Apply is insert-only. The seed does not mark parent email addresses verified, grant admin, activate the template, publish articles/newsletter, or send. If a prior apply used pending consent, rerunning cannot change it; use reviewed consent management rather than forcing the seed.

## Activation and browser gate

1. Confirm both parent identities can complete normal Google/magic-link verification, while the independent admin retains access. No development login on hosted production.
2. Admin: verify exactly two demo families/three classes through Auth; in CMS select the draft `[DEMO] SMZ Waldorf Weekly` explicitly and render both previews. A must show shared+1A+1B; B shared+2A with no1A/1B links. Verify links use the hosted CMS origin.
3. Keep article/newsletter drafts until the presentation's publishing stage. Verify initial opted-in preferences and the selected two-parent audience. Pending/opt-out recipients must remain excluded.
4. Publishing queues delivery automatically for the selected eligible audience. Before publishing the demo, confirm the deployed Worker has demo mode and the two-address allowlist; normal production mode has neither. The scheduled worker runs every minute. `DELIVERY_ENABLED=false` is an operational pause override in Cloudflare Workers > smz-cms-api > Settings > Variables and Secrets; a later deployment regenerates `DELIVERY_ENABLED=true`, so recheck the effective value after deployment.
5. Verify Resend acceptance, actual inbox receipt, parent sign-in, article denial for B on 1A/1B direct URLs, and clicks/article-read analytics. If webhook activation is complete, verify provider delivery events and the delivered-recipient metric in the same CMS database. Local admin previews do not prove this hosted journey. Bounce/complaint suppression reconciliation remains tracked separately in issue 28.

## Read-only hosted inventory (2026-09-18)

At the September 18 read-only check, the GitHub CMS production environment lacked `NEWSLETTER_TEST_RECIPIENTS`, `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, and `JWT_SECRET`. Auth config then had staging admin `smzwaldorf.education@gmail.com` and staging parent `buildwithharry@gmail.com`; the additional-parent setting was absent. The latest successful CMS CI was an older deployed commit, not the working-tree changes reviewed then. No remote settings were changed during that check. Reinspect live settings before a hosted demo.

The same September 18 Cloudflare inventory found only the two session secrets on the deployed CMS Worker. Both Hyperdrive bindings then pointed to the intended `smz-auth` / `smz-cms` databases with caching disabled. This was infrastructure verification only; remote row data and the hosted parent journey were not inspected.
