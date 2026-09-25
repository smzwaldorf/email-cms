# Cloudflare deployment

> Staging naming migration (2026-09-25): deployment resource names now use `staging-smz-*` (`news` replaces `cms` in Cloudflare resource names). `DEPLOYMENT_ENVIRONMENT=production` selects `production-smz-*` names for a future separately provisioned production deployment. The GitHub environment still named `production` is the existing staging secret store; changing that store is a separate migration.
>
> Canonical staging URLs: `https://staging-auth.smzwaldorf.com`, `https://staging-news.smzwaldorf.com`, `https://staging-news-api.smzwaldorf.com`, `https://staging-app-a.smzwaldorf.com`, and `https://staging-app-b.smzwaldorf.com`. App A Pages is `staging-smz-app-a`. Existing databases, credentials, and OAuth client IDs are retained. Fresh browser sign-in is required after the issuer change.
>
> `STAGING_RESOURCE_MIGRATION=true` enables the guarded, resumable in-place rename step. Disable it after the first successful deployment. No resource is copied or deleted by that step. Prior URLs and names elsewhere in this document are historical.


## Current configuration — September 14, 2026

Production runs on Cloudflare Pages (`smz-cms.pages.dev`) and Worker `smz-cms-api`, with SMZ Identity on Worker `smz-auth`. Pages forwards `/api/*` through its `CMS_API` service binding; the CMS Worker uses its `SMZ_AUTH` binding for Identity requests. The existing shared PlanetScale cluster holds separate logical databases: CMS uses `smz-cms` through uncached Hyperdrive `686ed1534b77435eb5537fabba62e61c`. Do not substitute Auth's database or binding.

The latest CMS release recorded here is `d876ca3`: [successful CI](https://github.com/smzwaldorf/email-cms/actions/runs/34727389222), followed by production browser verification of login and the newsletter front-page destination. This is release evidence, not a continuously updated live status. [Session verification](SESSION-VERIFICATION.md) records the earlier session release and its verification limits.

## Release path

Only pushes to `main` trigger the production job in `.github/workflows/cloudflare.yml`; pull requests validate without deployment. CI generates `.wrangler/deploy/cms.json` and `.wrangler/deploy/wrangler.json`, validates Pages configuration and Hyperdrive, provisions session secrets, applies the additive session migration, runs preflight, builds, deploys Worker then Pages, and performs HTTP smoke checks. Pages deploy runs from `.wrangler/deploy` with the standard config filename and inherits the account from the environment.

Required GitHub production variables: `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_HYPERDRIVE_ID`, `CMS_ORIGIN`, `CMS_API_ORIGIN`, `SMZ_AUTH_ISSUER`, and `CMS_AUTH_REGISTRATION_VERIFIED`.

Required GitHub production secrets:

- `CLOUDFLARE_API_TOKEN`: deployment access.
- `CMS_SESSION_SECRET`: 32-byte hex key encrypting backend session credentials.
- `CMS_OIDC_CLIENT_SECRET`: confidential client secret shared with Auth's `email-cms-server` registration.

The CMS database credential lives in Hyperdrive. The retired `CMS_DATABASE_URL` GitHub secret is not used. Never put database or client secrets in Vite variables.

## Authentication and migrations

Production enables `CMS_SESSION_ENABLED=true` and builds with `VITE_CMS_SERVER_SESSION=true`. The confidential `email-cms-server` client uses the exact callback `https://smz-cms.pages.dev/api/session/callback`. The old public `email-cms` client remains for compatibility; it is not the production server-session registration. See [session behavior](SESSION-BEHAVIOR.md).

CI runs `db/migrations/20260913_cms_sessions.sql` through `scripts/cloudflare-session-migrate.mjs`. This repeatable additive schema migration is distinct from the completed September 12 content import under `db/migration/`. The latter is historical operational tooling and must not be added to startup or CI. `CMS_INITIALIZE_EMPTY_DATABASE` is a guarded first-time bootstrap flag and should remain unset after initialization.

Delivery remains disabled. Scheduled session cleanup still runs; disabled delivery does not disable all scheduled work. Worker and Pages publication is not atomic, so inspect both deployment results after a failed run.

## Development and other servers

See [runtime environments](RUNTIME-ENVIRONMENTS.md) for local ports, database reuse, optional server-session parity and standalone Node requirements. Do not use production credentials to repair localhost configuration.

## Historical deployment record

The following September 12 material is retained for audit. Its old release status, public-client instructions, secret inventory and setup-pending statements are superseded by the configuration above; they are not current setup instructions.


## Status — 2026-09-12

CMS Pages and Worker deployed successfully through commit-triggered CI run [34691246901](https://github.com/smzwaldorf/email-cms/actions/runs/34691246901), commit `f68468de28b7ed77f6a525d729b99bbeb5e08b1d`. The production schema was initialized in the existing PlanetScale `smz-cms` logical database through its uncached Hyperdrive binding. The one-time initializer flag and unused invalid GitHub database secret were removed after success. No new paid cluster was provisioned; delivery remains disabled.

Live services: [CMS](https://smz-cms.pages.dev) and [API health](https://smz-cms-api.black-tree-204e.workers.dev/health). Worker version `14c4fe53-3d92-47f3-8b02-c3c16b1efe03`; Pages deployment [374d7abe](https://374d7abe.smz-cms.pages.dev).

All CI build, regression, database preflight and HTTP smoke checks passed. Dia verified the CMS login page, correct CMS PKCE redirect to SMZ Identity, and arrival at Google's account chooser. An eligible user's completed login, authenticated CMS reads, refresh and coordinated logout remain unverified; the browser is left at account selection. No people or CMS admission grants were seeded.

## Topology

| Component | Target |
| --- | --- |
| Frontend | Cloudflare Pages project `smz-cms`; `https://smz-cms.pages.dev` |
| API and disabled scheduled executor | Worker `smz-cms-api`; `https://smz-cms-api.black-tree-204e.workers.dev` in the existing SMZ account |
| Identity | Existing `https://smz-auth.black-tree-204e.workers.dev/api/auth` |
| Data | Reserved `smz-cms` logical database on the existing PlanetScale cluster |
| SQL connection | Separate uncached Hyperdrive binding targeting `smz-cms` |

Do not provision another paid cluster or point CMS at Auth's `smz-auth` logical database/Hyperdrive. The live PlanetScale SQL console confirmed `current_database() = smz-cms` and zero public tables on 2026-09-12. A CMS-only role and uncached Hyperdrive `686ed1534b77435eb5537fabba62e61c` now target this database. The working database credential is stored in Hyperdrive. Deployment checks use this same connection; the separate GitHub `CMS_DATABASE_URL` copy failed authentication and is no longer used.

Workers uses Cloudflare's Node HTTP bridge with the existing application handler. Environment and pg pools are invocation-scoped, and owned pools close after execution. Templates are bundled from the checked-in email assets. `DELIVERY_ENABLED=false` is generated by default, so cron events do not execute jobs or send email. Activating delivery is a separate action requiring provider secrets and end-to-end verification.

## Prerequisites

1. Resolve the target Cloudflare account and provide access to it. For the existing SMZ account, the account ID is `f1b69ad88454573ccaa3364b628fd114`. A production API token must have Workers, Pages and Hyperdrive permissions for that account.
2. Configure the CMS Hyperdrive connection with verified origin TLS. On the verified empty database only, CI runs `npm run cloudflare:schema` through a short-lived Wrangler remote preview using this binding. The script checks the actual database name, refuses existing public tables and applies schema in a transaction. It is intentionally not a recurring migration runner. Do not use the destructive local reset scripts in production.
3. Create an uncached Hyperdrive targeting `smz-cms`, and record its ID. `node scripts/cloudflare-check-binding.mjs` verifies both the destination database and disabled caching through Cloudflare's API.
4. Create Pages project `smz-cms` with production branch `main` in the chosen account. Confirm the resulting domain and Worker subdomain before building.
5. In the existing Auth deployment, register public client `email-cms` with exact CMS origin, `/auth/callback` redirect and approved post-logout origin. Use the existing CMS scopes `openid profile email directory:access offline_access`; do not seed people, roles or admission grants. Extend Auth's coordinated logout to support `email-cms` and to clear CMS tab sessions through its trusted `/logout/local` page. Verify both CMS-initiated and other-app-initiated logout with an existing eligible identity before setting the registration verification flag.

## Commit-triggered deployment

`.github/workflows/cloudflare.yml` validates pull requests. Only a push to `main` enters the `production` deployment job. There is no manual workflow dispatch or local production deploy script. Do not commit/push solely because the bundle passes: the database, Auth integration and browser workflow gates still apply.

Configure these GitHub **production environment variables**:

| Variable | Value |
| --- | --- |
| `CLOUDFLARE_ACCOUNT_ID` | Confirmed target account ID |
| `CLOUDFLARE_HYPERDRIVE_ID` | Verified uncached CMS binding ID |
| `CMS_ORIGIN` | Exact HTTPS Pages origin |
| `CMS_API_ORIGIN` | Exact HTTPS Worker origin |
| `SMZ_AUTH_ISSUER` | Existing Auth issuer ending `/api/auth` |
| `CMS_AUTH_REGISTRATION_VERIFIED` | `true` only after exact registration and coordinated logout are verified |

Production **secrets**: `CLOUDFLARE_API_TOKEN`. The database password lives only in Hyperdrive; `CMS_DATABASE_URL` is not required by CI. No provider sending secrets are required while delivery is disabled. Database credentials and API tokens must never be Vite variables.

The workflow builds and tests, validates configuration and Hyperdrive, checks Auth discovery and CMS schema, builds Pages with production origins, deploys Worker then Pages, and runs HTTP smoke checks. Inspect the actual CI result and published URLs after the requested push. Deployment across the two services is not atomic; if either publish or smoke fails, inspect both current versions before retrying or reverting through a commit.

## Local preparation and verification

```bash
npm install
npm run build
npm run cloudflare:check
# Set the non-secret production origins before preparing the Pages artifact:
npm run cloudflare:pages:build
# With confirmed account and Hyperdrive IDs, generate ignored deployment config:
npm run cloudflare:configure
```

`cloudflare:check` performs a Worker type check and Wrangler dry run. The checked-in Wrangler config uses the account and issuer from the generated SMZ Auth deployment config, plus the planned CMS Pages origin. Its Hyperdrive ID targets the verified CMS-specific connection; Auth’s binding targets `smz-auth` and must not be copied for CMS. `cloudflare:configure` rejects missing/placeholder IDs and writes `.wrangler/deploy/cms.json`. Pages build writes `/logout/local` frame policy restricted to the Auth origin; callback and logout routes use Pages SPA fallback.

Verification in this task:

- Shared, backend and production frontend TypeScript/build checks pass; no type-check suppression was added.
- Worker-specific TypeScript and Wrangler dry-run bundle checks pass.
- Backend focused suite: 146 tests across 14 files, covering invocation isolation, lifecycle, auth, parent access, delivery fixtures, SQL relations/upserts, templates and HTML import.
- Frontend focused auth/logout/media regressions: 76 tests across 10 files pass.
- Compiled Node startup returns the expected unauthenticated 401 and exits cleanly on SIGTERM.
- Real local workerd returns the expected session 401, CORS preflight 204 and disabled scheduled-event success.
- Production initialization and read-only schema preflight passed through Hyperdrive. Local verification used an isolated PostgreSQL 17 server because Docker was unavailable. Provider sending and completed authenticated browser workflows remain unverified.

After publication, run `node scripts/cloudflare-smoke.mjs` with the production origins, then browser-test login, callback, role restrictions, newsletter reads and coordinated logout across tabs/apps using existing authorized identities. The HTTP smoke intentionally does not substitute for those browser checks.

## Remaining product limitations

Existing media storage contains mock/legacy adapters; durable uploads are not implemented by this deployment. Unsupported storage operations must not be represented as successful production persistence. Legacy identity RPCs fail closed because SMZ Auth owns identity; this change does not recreate identity administration inside CMS. Existing legacy content queries and untested workflows still require their own acceptance checks. Delivery remains disabled until separately authorized and verified.

### Historical setup progress (superseded by published status above)

The GitHub production environment has the account ID, CMS/API origins and Auth issuer. The approved 90-day account token `smz-cms-github-production` was created with Hyperdrive Read, Pages Write and Workers Scripts Write for 善美真 and saved as `CLOUDFLARE_API_TOKEN` in the GitHub production environment. It expires December 12, 2026. Production SQL console access was temporarily enabled for database verification and restored to disabled. The approved role `smz-cms-production` was created with no inherited cluster-wide permissions. CMS database CONNECT/CREATE and public-schema USAGE/CREATE grants succeeded; a SQL check confirmed CMS CREATE true and Auth database CREATE false. GitHub `CMS_DATABASE_URL` and `CLOUDFLARE_HYPERDRIVE_ID` are saved, and the CMS Hyperdrive connection was created successfully with caching disabled. The initial database password accidentally appeared in a tool output. The user reset the role credentials; the replacement was then saved to GitHub and Hyperdrive without displaying it. Hyperdrive accepted the updated connection. No paid cluster, schema, Worker, email send or application deployment was created in this retry.

### Historical Auth source investigation (resolved by release 6fd82cc)

The matching registration-driven global logout implementation exists as uncommitted work in `/Users/harryworld/.codex/worktrees/5fb1/smz-auth` on `codex/auth-login-ownership`. Production Auth `main` at `c3b102a` does not contain it. Do not publish that entire unfinished worktree as an incidental CMS deployment; port and validate the required registration, revocation, coordinator and client cleanup changes against production Auth first. CMS schema initialization and authenticated production verification are still pending.

The initial commit-triggered deployment may set `CMS_INITIALIZE_EMPTY_DATABASE=true` in the production environment to run the guarded one-time bootstrap before preflight. Remove that variable after the bootstrap succeeds, including before retrying any later failed publish step. The bootstrap continues to refuse existing public tables. No recurring destructive initialization is introduced.


### Release validation on 2026-09-12

Auth prerequisite commit `6fd82ccdd48e1ea961846ccec99446df4d39a85a` deployed successfully through https://github.com/smzwaldorf/auth/actions/runs/34690297142. Its production launcher lists Email CMS, and the provider accepts the exact CMS PKCE authorization request. The required coordinator and central grant revocation passed 20 unit tests and 17 real PostgreSQL integration tests before publication. This supersedes the earlier Auth-blocked status above.

An isolated PostgreSQL 17 database accepted all 42 CMS tables. Local workerd passed five concurrent database health requests, unauthenticated 401, CORS 204 and disabled scheduled execution. The CMS release checkout passed the full production build, Worker type check/dry run, 146 backend tests and 76 frontend tests. PlanetScale's `sslrootcert=system` URI option is translated to Node's default trusted CA store while retaining verified TLS. Production schema initialization and CMS publication follow in the commit-triggered pipeline; browser login is a separate post-publication check.

### Hyperdrive preflight correction — September 12, 2026

Auth commit `6fd82cc` deployed successfully. CMS run `34690582524` passed validation but stopped before schema changes because the separate GitHub database password failed authentication. A read-only remote Hyperdrive query succeeded against `smz-cms` and confirmed zero public tables. Bootstrap and recurring preflight now use the production Hyperdrive binding through a temporary Wrangler preview. Each preview accepts only a random bearer token and fixed operations, is terminated after the check, and is never deployed as a permanent administration endpoint. Schema initialization still refuses other databases or existing tables and runs in one transaction. The release continues through push-to-main CI.

### CMS login transport correction

The first authenticated login exposed Cloudflare error 1042 on public CMS-to-Auth subrequests. A remote runtime probe reproduced 404/1042 for JWKS, user-info and directory endpoints. The public-fetch compatibility flag alone did not resolve that probe. A direct `SMZ_AUTH` service binding to `smz-auth` returned JWKS 200 and the expected 401 for synthetic invalid tokens. CMS now routes identity checks through this invocation-scoped binding; the Node runtime retains ordinary fetch. Bearer validation and directory admission remain enforced by Auth. Regression checks cover both Wrangler configurations, concurrent transport isolation and the Node fallback. Worker type checking, bundle dry run and 23 focused auth/runtime tests passed before publication.

Login fix release `874237dd7c51ddeca318de47bb2ba2adf7fc785f` passed validation and deployment in [CI run 34693940795](https://github.com/smzwaldorf/email-cms/actions/runs/34693940795). A fresh Google login as the explicitly approved `harryworld@gmail.com` reached the live CMS Admin Dashboard and its empty newsletter list in Dia. This verifies authenticated callback, Auth service-binding verification and CMS admin access. Refresh, cross-application logout, content editing and delivery are separate checks; delivery remains disabled.

### Production data migration — September 12, 2026

The user-authorized `db/seed-data.sql` import completed after verified backup restoration and a successful live rolled-back dry run. Production now contains 5 newsletters and 10 articles among 68 imported domain/reference rows. The existing CMS user and OIDC link were preserved; Auth admission and roles were unchanged by the import. Dia verified admin login and both populated lists. Delivery/sync jobs were excluded and email delivery remains disabled. See `db/migration/production-result.json` and `db/migration/PLAN.md`.

The shared PlanetScale server reports 25 total connections with 3 reserved. Hyperdrive origin limits are now CMS 5 and Auth 10 to prevent the competing pools from exhausting that capacity. Both bindings remain uncached and on the original cluster.
