# Two-family newsletter demo

This is an insert-only synthetic fixture for local rehearsal and a reviewed hosted demo. Auth owns people, families and classes; CMS owns articles, template, newsletter and explicit newsletter consent. The family/newsletter seeds never send an email, publish content, enable delivery, verify an address, create an admin, or register OAuth clients. The separate admin bootstrap command is an explicit, guarded step.

## Expected demo

| Recipient | Auth membership | Email content |
| --- | --- | --- |
| Demo Parent A / Demo Family A | Two children: Demo Grade 1A and 1B | Shared news + four illustrated weekly items + 1A garden story + 1B music story (7 articles) |
| Demo Parent B / Demo Family B | One child: Demo Grade 2A | Shared news + four illustrated weekly items + 2A nature story (6 articles); no 1A/1B content or links |

All IDs use `de900000-0000-4000-8000-*`. Family suffixes are 101/102; class suffixes 201/202/203; newsletter 301; articles 401–408; template 501, revision 502; the `weekly` tag is 601. Both repositories' `scripts/seed-demo.mjs` implement profile `smz-newsletter-demo-v1`. These are distinct from existing local school fixtures; no real family is relinked. CMS stores canonical IDs only, and runtime reads the directory via Auth APIs.

## Practical setup for a first real send

For the requested clean start, Family A uses **harryworld@gmail.com** and Family B uses **smzwaldorf.education@gmail.com**. These defaults are stored in Auth `scripts/demo-families.json`; environment variables can override them. Both are seeded as parents, not administrators. Bootstrap a separate approved administrator through the normal Auth setup after a reset. Neither address may already belong to another Auth person when applying this insert-only fixture. A hosted demo should use a separate demo database/deployment where possible. If sharing the deployed application, keep these clearly marked fixtures and restrict delivery to exactly the two demo addresses.

1. Deploy the reviewed Auth directory API and CMS identity-retirement changes together through the existing commit/CI workflow. Apply reviewed migrations first; do not run a database-reset command on a hosted database. CMS server login needs `20260913_cms_sessions.sql` as well as the current baseline.
2. Register the existing `email-cms-server` client with the exact CMS HTTPS `/api/session/callback` URL. Keep normal Auth admission and verification. `ENABLE_DEV_LOGIN=false`, `CMS_SESSION_ENABLED=true`, `VITE_CMS_SERVER_SESSION=true`; set the real Auth issuer/CMS origins and server secrets. Technical-client registration is separate from seeding people.
3. Use the saved recipient defaults or the environment overrides below in the **Auth** repository. Configure the database connection privately; do not check it into source.
4. The controlled demo inboxes are seeded as subscribed so the rehearsal can proceed. Set `DEMO_SUBSCRIPTIONS_CONFIRMED=false` in **CMS before first apply** only when testing the consent gate. A seed rerun never upgrades an explicit opt-out, restores disabled relationships, or clears a suppression; use the audited consent-management workflow (#31) for those cases.
5. Run plan, transactional rehearsal and apply separately in each repository. `--check` runs the real inserts and rolls the transaction back, checking constraints. `--apply` commits. Both require the exact destination guard, and neither drops a database. A partial fixture or identity collision aborts; a complete existing fixture is a no-op even after edits.

```sh
# Auth repo; these are also the checked-in clean-start defaults.
export DEMO_PARENT_A_EMAIL='harryworld@gmail.com'
export DEMO_PARENT_B_EMAIL='smzwaldorf.education@gmail.com'
export DEMO_DATABASE_CONFIRM='database-host/database-name'
npm run seed:demo
npm run seed:demo -- --check
npm run seed:demo -- --apply

# CMS repo; use its own DATABASE_URL and exact host/name guard.
export DEMO_DATABASE_CONFIRM='cms-database-host/cms-database-name'
# Only after the operator confirms opt-in for both controlled demo inboxes:
export DEMO_SUBSCRIPTIONS_CONFIRMED=true
npm run seed:demo
npm run seed:demo -- --check
npm run seed:demo -- --apply

# Existing four-article demo fixture only: safely add the illustrated weekly articles.
npm run seed:demo:weekly-articles -- --check
npm run seed:demo:weekly-articles -- --apply
```

`DEMO_DATABASE_CONFIRM` is hostname plus `/database-name`, without password, username or port. Explicit shell variables override local env files. Auth uses `.env`; CMS uses `.env.local` then `.env`. For production execution set `NODE_ENV=production`; placeholder `.invalid`/`.test` addresses and development login are rejected by the Auth demo seed. If either real address already exists, stop and choose a separate demo address; this seed intentionally does not merge real identities.

## Send through the real application

- Set `RESEND_API_KEY` and `RESEND_FROM_EMAIL` privately. Use an already verified sender domain. Set `NEWSLETTER_DEMO_MODE=true` and `NEWSLETTER_TEST_RECIPIENTS` to **exactly the two demo addresses**, including on production. Demo mode rejects an empty allowlist even under `NODE_ENV=production`. Keep `DELIVERY_ENABLED=false` until previews pass, then explicitly enable it for the demonstration.
- Sign into Auth normally as each parent and verify email ownership. Use separate browser profiles for the two parents; using two tabs in one profile shares a session. Sign in to CMS as the separately provisioned administrator through server login.
- Open `[DEMO] Two-family school newsletter`, make the articles ready using the normal editor/publish workflow, and select `[DEMO] SMZ Waldorf Weekly` explicitly in Email Preview. The template is draft and does not replace the existing active template. Check both previews against the table above, including links.
- Publish with the selected template revision and **selected demo classes only** (DEMO-1A, DEMO-1B, DEMO-2A), not an unrestricted all-family audience on a shared deployment. Verify exactly two eligible parent recipients before confirmation. The allowlist rejects any unexpected recipient.
- Process only the new batch. Node: set `NEWSLETTER_DELIVERY_BATCH_ID` to the new batch UUID and run `npm run worker:batch -w @email-cms/backend` after building. Hosted Cloudflare uses its existing scheduled delivery worker. Do not start a broad polling worker just to retry one batch on a shared database.
- Check the two Resend message IDs and actual inboxes. Open each email in the matching parent's browser profile; verify article access and analytics clicks/reads. Test that Parent B cannot open the 1A/1B direct article URLs. The worker rechecks live admin session, contacts, class scope and consent before sending.
- For another presentation, duplicate the demo newsletter in the CMS; rerunning the seed intentionally does not reset the published newsletter or delivery history.

## What this proves

Seed tests establish insertion/rollback/rerun behavior, not delivery. Resend acceptance is not an inbox or article-access check. CMS signed tracking links/pixels and article reads are the current analytics path; provider webhook suppression/reconciliation remains tracked in email-cms#28. Do not claim provider delivery/bounce events are reflected in CMS until that feature is verified. Mail privacy features can affect open counts, so demonstrate clicks and authenticated article reads as well.

For provider-only simulation, Resend provides `delivered@resend.dev`, `bounced@resend.dev`, and `complained@resend.dev`; they are not inboxes for parent sign-in or the full browser demo. Never send to the offline `example.invalid` fixtures.

Sources: [Resend test addresses](https://resend.com/docs/dashboard/emails/send-test-emails), [verified sender domains](https://resend.com/docs/dashboard/domains/introduction).

## Historical seeds

Auth's `development:school` and development login remain local-only, user-specific fixtures; do not promote them to production. The general `directory:seed` importer replaces selected roles and relationships and is not this insert-only demo command. The former CMS SQL dump contained historical people-related snapshots, delivery batches, provider IDs and analytics; it is retired from the default seed workflow. Existing databases and backups are not changed by this source cleanup. Historical import evidence is retained for reference only.

## Saved email template

The demo seed uses `db/seeds/current-email-template.json`, captured from the active **SMZ Waldorf Weekly** revision 4. It preserves the subject, HTML, and all six blocks with their order, visibility, and configuration. The featured shared-article block excludes `sourceTag: weekly`, while the weekly-summary block includes that tag. A new demo installation creates a draft copy at revision 1; it does not activate the copy or overwrite existing templates on rerun. The snapshot retains the current sample announcement and placeholder telephone/fax values; edit these in the CMS before a public presentation if needed.

## Clean-start boundary

Resetting is a separate operator action; `seed:demo` never resets either database. After restoring the current schemas/migrations and normal Auth administrator/OIDC configuration, run the Auth seed first, then CMS using the commands above. The saved template and A/B class relationships are included. Delivery remains disabled until configured, and newsletter preferences are subscribed by default unless `DEMO_SUBSCRIPTIONS_CONFIRMED=false` is set for the first CMS apply. Do not run the older school fixture first: it can claim these email addresses under different identities.

For deployment configuration, guarded migrations, explicit hosted seeding, and activation, see [Hosted demo readiness](HOSTED-DEMO-READINESS.md).
