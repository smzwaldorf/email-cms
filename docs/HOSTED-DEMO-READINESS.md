# Hosted newsletter demo readiness

## Deployment boundary

Local reset and browser checks do not authorize a hosted reset, role reassignment, deployment, or email send. Release through reviewed commits and the existing main-branch CI pipeline. The workflow intentionally does not seed a production database automatically.

## Required configuration

CMS GitHub `production` environment variables: `NEWSLETTER_TEST_RECIPIENTS=harryworld@gmail.com,smzwaldorf.education@gmail.com` plus existing account, Hyperdrive and origin variables. Workflow forces `NEWSLETTER_DEMO_MODE=true` and `DELIVERY_ENABLED=false`.

CMS environment secrets: existing `CLOUDFLARE_API_TOKEN`, `CMS_SESSION_SECRET`, `CMS_OIDC_CLIENT_SECRET`, plus `RESEND_API_KEY`, `RESEND_FROM_EMAIL` (a verified sender), and an independent persistent `JWT_SECRET` of at least 32 characters for signed tracking links. Secrets stay server-side. Provisioning validates all inputs before writing any secret. Never rotate the tracking key just to run a demo; rotation invalidates existing links.

Auth must configure a separate approved administrator and `STAGING_PARENT_EMAILS=harryworld@gmail.com,smzwaldorf.education@gmail.com`. Read Auth's demo guide for the additive allowlist and collision checks. The existing deployment reserves `smzwaldorf.education@gmail.com` as its admin; the requested Parent B cannot be activated there without a separately approved administrator/account transition. Do not change the old staging identity migration or remove the current admin. Prefer an explicitly provisioned isolated hosted demo with a separate admin; worker names, origins, resource audience, client callbacks and bindings must all match that environment.

## Migrations on an existing CMS database

The workflow executes `node scripts/cloudflare-migrate.mjs` before deploying. It applies sessions, newsletter week cascade, and identity retirement in one transaction with a migration checksum journal. It locks existing public tables, fingerprints retained content/history, and rolls back on any mismatch.

If legacy identity tables exist, first take and verify a database backup and reconcile reviewed canonical Auth ID mappings in `identity_reference_mappings`. Then, only for the approved migration, set `CMS_IDENTITY_RETIREMENT_APPROVED=true` and `CMS_IDENTITY_BACKUP_REFERENCE` to the backup/audit reference. Unmapped pending/opt-out families fail closed. Never invent mappings based solely on email or assume these flags themselves perform reconciliation. For an already-retired database, no retirement approval is needed. Remove one-time approval after migration. No script performs a hosted database reset.

## Explicit hosted seed procedure

Use the intended release checkout and a secure shell with the direct database connection supplied as `DATABASE_URL`. Do not paste URLs/passwords into source or logs. Inventory existing identities before applying: the new seed aborts on collisions and never merges real users. A partial fixture aborts; investigate instead of deleting rows.

Auth, after current migrations and separate normal admin/OIDC bootstrap (the Auth `seed:demo-admin` command requires an explicit separate admin inbox; use `--check` before a separately authorized `--apply`):

```sh
export NODE_ENV=production ENABLE_DEV_LOGIN=false
export DEMO_PARENT_A_EMAIL=harryworld@gmail.com
export DEMO_PARENT_B_EMAIL=smzwaldorf.education@gmail.com
# Set DATABASE_URL privately to the intended Auth DB.
export DEMO_DATABASE_CONFIRM='actual-auth-host/actual-auth-database'
npm run seed:demo -- --check
# Execute only at the separately authorized hosted seed stage:
npm run seed:demo -- --apply
```

CMS, after all migrations:

```sh
export NODE_ENV=production DELIVERY_ENABLED=false NEWSLETTER_DEMO_MODE=true
export NEWSLETTER_TEST_RECIPIENTS=harryworld@gmail.com,smzwaldorf.education@gmail.com
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
4. Only when sending is explicitly authorized, enable delivery for the allowlisted two inboxes and publish the selected demo newsletter/template. Keep the allowlist, target only the new batch, and restore delivery disabled afterward. Current deployment generation deliberately resets delivery disabled; do not treat a redeploy as a send command.
5. Verify Resend acceptance, actual inbox receipt, parent sign-in, article denial for B on1A/1B direct URLs, and clicks/article-read analytics. Local admin previews do not prove this hosted journey. Provider suppression/webhook reconciliation remains tracked separately in issue28.

## Read-only hosted inventory (2026-09-18)

GitHub CMS production environment currently lacks `NEWSLETTER_TEST_RECIPIENTS`, `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, and `JWT_SECRET`. Auth config still has staging admin `smzwaldorf.education@gmail.com` and staging parent `buildwithharry@gmail.com`; additional-parent setting is absent. Latest successful CMS CI is an older deployed commit, not these working-tree changes. No remote settings were changed during this readiness work.

Cloudflare read-only inventory also confirms the deployed CMS Worker currently has only the two session secrets. Both Hyperdrive bindings point to the intended `smz-auth` / `smz-cms` databases with caching disabled. This is infrastructure verification only; remote row data and the hosted parent journey were not inspected.
