# Email CMS contributor guide

This is a React/TypeScript monorepo with a PostgreSQL-backed CMS API. SMZ Auth owns login eligibility, roles and school-directory relationships. The CMS backend owns content permissions, newsletter composition, recipient snapshots, delivery and analytics.

## Workspaces and boundaries

- `apps/frontend` (`@email-cms/frontend`): Vite app and browser tests.
- `apps/backend` (`@email-cms/backend`): Node HTTP API, Cloudflare Worker entry, business services and delivery worker.
- `packages/shared` (`@email-cms/shared`): types and permission contracts.

Frontend pages call the backend HTTP API through `apps/frontend/src/services/backendApi.ts`. Admin service clients are thin proxies to `/api/admin/rpc`; business rules belong in backend services. Do not import backend modules into the frontend. The backend uses `#/*` and `#shared/*` subpath imports from its `package.json`.

Authentication is delegated to SMZ Auth. A user UUID is not an access token. Protected requests require current Identity admission and CMS action authorization. Production uses the confidential `email-cms-server` client and backend sessions; local `config/local.env.example` starts in public-client compatibility mode until the session prerequisites are configured.

## Local development

From the repository root:

```bash
npm install
npm run build -w @email-cms/shared
# New setup only: preserve an existing .env.local.
cp -n config/local.env.example .env.local
npm run backend:dev
# In another terminal:
npm run dev
```

Vite uses `http://localhost:5173` with `strictPort`; the backend defaults to `http://localhost:8787`, and local Auth uses `http://localhost:3000`. The example CMS database connection is on port `55440`. Set a real local `DATABASE_URL` privately in `.env.local`. Check the existing database before running `npm run db:up`; Compose also defaults to port `55440` and must not collide with an existing server. `npm run db:schema` resets the Compose database. `npm run seed` is an alias for the insert-only demo seed; it does not reset a database.

Local delivery is disabled by the example configuration. Start `npm run worker:dev` only when the intended audience and provider settings are ready. Local or demo sending requires `DELIVERY_ENABLED=true`, a `NEWSLETTER_TEST_RECIPIENTS` allowlist, and backend-only Resend and tracking secrets. Cloudflare's generated production configuration enables scheduled delivery by default; check its effective configuration before publishing.

## Commands

```bash
npm run lint
npm test
npm run test -w @email-cms/backend
npm run test -w @email-cms/frontend
npm run build
npm run cloudflare:check
npm run seed:demo -- --check
```

`npm test` runs frontend then backend Vitest suites. Backend business logic belongs in `apps/backend/tests`; frontend tests should cover the proxy contract and UI behavior. The repository uses ESLint 8 with `.eslintrc.cjs`. Keep `@typescript-eslint/no-explicit-any` and the frontend/backend import boundary enabled; use domain types or `unknown` with guards to resolve typing errors.

## Current runtime paths

- Frontend routes are in `apps/frontend/src/App.tsx`; they include `/week/:weekNumber`, `/newsletter/:newsletterId`, `/admin`, `/admin/articles`, `/admin/newsletters/id/:id`, `/admin/email-templates`, and `/admin/analytics`.
- HTTP routes are in `apps/backend/src/routes.ts`. The API includes server-session endpoints, reader and admin operations, tracking pixel/click, and the Resend webhook. Kit inbound webhook compatibility remains, while newsletter sending uses Resend.
- `apps/backend/src/services/emailPlatform/backendEmailPlatformService.ts` sends one personalized Resend message per recipient and stores each provider message ID.
- `apps/backend/src/cloudflare/worker.ts` handles Cloudflare requests and the scheduled delivery trigger. The Node delivery executor lives under `apps/backend/src/worker/`.
- Build-time email templates are in `apps/backend/templates/email/`; `scripts/cloudflare-templates.mjs` bundles and precompiles them for the backend.

For a controlled two-family rehearsal, use [the demo guide](docs/DEMO-NEWSLETTER.md). For delivery confirmation metrics, use [the Resend webhook guide](docs/RESEND-WEBHOOKS.md). Production deployment is performed by [the Cloudflare workflow](.github/workflows/cloudflare.yml) on pushes to `main`; verify the live Auth, database, browser and inbox journey separately from build and test results.
