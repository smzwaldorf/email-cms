# CMS runtime environments

## Environment map

| Environment | Frontend/API | Database | Authentication |
| --- | --- | --- | --- |
| Cloudflare production | Pages `smz-cms.pages.dev`; `/api/*` service binding to `smz-cms-api` | Existing PlanetScale `smz-cms` via uncached Hyperdrive | Backend sessions, confidential `email-cms-server` |
| Current local development | Vite `localhost:5173`; Node `localhost:8787`; Identity `localhost:3000` | Existing CMS database `email_cms` on `127.0.0.1:55440` | Explicit legacy compatibility mode unless server-session prerequisites below are completed |
| Isolated migration rehearsal | No application frontend required | Disposable PostgreSQL on `127.0.0.1:55443` | Synthetic fixture only |
| Standalone Node hosting | Built frontend plus reverse proxy and `node apps/backend/dist/index.js` | Operator-provided PostgreSQL `DATABASE_URL` | Server-session mode requires the same callback, cookie, origin and secret contract as production |

No separate standalone Node production host or staging deployment is established by these instructions. `worker:dev` / `worker:start` run the Node delivery executor, not the Cloudflare API Worker. Cloudflare compilation is checked by `npm run cloudflare:check`.

## Reuse the existing development database

On the inspected development machine, `email-cms-browser-review-20260905` exposes the CMS database on `55440`; `smztest-postgres-1` occupies `55432`; Auth uses `5432`. Container names describe this machine, not a universal installation. Verify `docker ps` before starting anything.

The ignored `.env.local` now points to CMS port `55440` and allows frontend origin `http://localhost:5173`. Keep its existing password. Do not overwrite it wholesale with an example. The checked-in examples and Vite/backend defaults use these same CMS ports; Vite fails if its port is occupied instead of silently moving and breaking OIDC redirects.

For a new installation only, Compose creates `email-cms-postgres` with default host port `55440`, configurable through `CMS_POSTGRES_PORT`. Changing that variable also requires changing `DATABASE_URL`. Do not start this container while the existing CMS database already occupies the port. Changing a Compose port does not migrate or adopt another container's volume.

`npm run db:schema` drops and recreates the Compose database; `npm run seed` invokes it. Neither is a repair command for an existing database. Reuse the existing data and apply reviewed additive migrations when needed.

Start the local API with `npm run backend:dev` and the frontend with `npm run dev`. Start Identity from the sibling Auth repository using its own instructions. `DATABASE_URL` belongs only in backend configuration; credentials must never have a `VITE_` prefix.

## Optional production-equivalent session mode

The local templates explicitly keep both session flags false to preserve the currently registered public-client flow. This mode is useful for compatibility work but does not verify production session persistence. To exercise the backend-session architecture:

1. Apply `db/migrations/20260913_cms_sessions.sql` to the intended local CMS database using a verified connection. Do not run the content-import snapshot or reset the database.
2. Configure the local Identity confidential `email-cms-server` client with exact callback `http://localhost:5173/api/session/callback` and the matching local client secret. Follow Auth's registration procedure and retain reviewed admission; registering a technical client must not invent user grants.
3. Supply a local `CMS_SESSION_SECRET` (32 random bytes, hex encoded) and `CMS_OIDC_CLIENT_SECRET` in ignored backend configuration. Use local credentials, not production secrets.
4. Set `CMS_SESSION_ENABLED=true` and `VITE_CMS_SERVER_SESSION=true` together. Set `APP_URL` and `VITE_APP_URL` to `http://localhost:5173`, `BACKEND_CORS_ORIGIN` to that same origin, and both issuer settings to `http://localhost:3000/api/auth`.
5. Restart API and Vite. Vite forwards `/api` to `VITE_BACKEND_URL` (`http://localhost:8787`) while preserving the browser Origin. Verify login, reload, new tabs, renewal, outage recovery and explicit logout. Local HTTP is a development exception; hosted environments require HTTPS.

The existing cross-service verification harness in Auth (`scripts/cms-session-joint.ts`) is an isolated fixture, not a launcher for the user's development database. Check its explicit port/database guards before use.

## Standalone Node requirements

`npm run build` produces the Node backend; its workspace `start` command runs the compiled HTTP server. A real host must provide process supervision, HTTPS, same-origin `/api/*` reverse proxying, PostgreSQL connectivity, secrets and a separately registered exact Identity callback. Preserve `Origin` and cookie headers through the proxy. Production browser cookies are Secure and HttpOnly. A static frontend upload alone does not supply this backend.

There is no checked-in standalone-host deployment pipeline. Do not infer Node-host production readiness from Cloudflare CI, or enable the delivery executor merely to run the API.

## Historical artifacts

`db/migration/`, the four `*-data-migration`/`migrate-data` scripts, and `specs/docs/session-architecture-evidence/` preserve completed import procedures and pre-change audit evidence. They are not invoked by application startup or current CI. The active production session schema migration is under `db/migrations/` (plural). Preserve private backup files under ignored storage; do not commit credentials or raw backups.
