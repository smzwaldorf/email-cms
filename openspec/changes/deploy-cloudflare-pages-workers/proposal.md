## Why

The CMS needs a deployable Pages frontend and Workers backend alongside the existing SMZ Auth service. Current Node-only process wiring, shared pool and filesystem template loading are unsuitable for Worker invocation boundaries.

## What Changes

- Add a Workers HTTP adapter, invocation-scoped PostgreSQL pool through uncached Hyperdrive, bundled templates and explicit runtime configuration.
- Add a scheduled delivery adapter with an explicit disabled-by-default delivery switch; deployment alone must not send queued email.
- Build and publish the frontend to Pages with exact production OIDC/CORS origins and trusted logout frame headers.
- Add validated configuration, non-destructive schema bootstrap for the reserved empty smz-cms database, deployment checks and live smoke evidence.
- Preserve the existing long-running Node adapters and earlier uncommitted authentication/logout work.

## Capabilities

### New Capabilities

- `cms-cloudflare-deployment`: Pages and Workers deployment with isolated database lifecycle and safe delivery activation.

### Modified Capabilities

None.

## Impact

- New: apps/backend/src/cloudflare/worker.ts, apps/backend/src/runtime/environment.ts, apps/backend/wrangler.jsonc, scripts/cloudflare-config.mjs, scripts/cloudflare-templates.mjs, scripts/cloudflare-schema.mjs, specs/docs/CLOUDFLARE.md
- Modified: apps/backend/src/lib/db.ts, apps/backend/src/services/fileEmailTemplateLoader.ts, apps/frontend/vite.config.ts, package.json, README.md
- Cloudflare resources: Pages project, HTTP Worker and uncached Hyperdrive targeting the reserved smz-cms database; no new paid database cluster.
