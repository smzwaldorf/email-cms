## Context

CMS has working Node lifecycle adapters, central OIDC and PostgreSQL-backed content/delivery. The live Auth deployment uses a PlanetScale cluster with a reserved empty smz-cms logical database. Current local Wrangler login lists a different account, so target access must be resolved before publishing.

## Goals / Non-Goals

Goals: deploy frontend to Pages and API to Workers, preserve Node operation and authorization, validate real workerd behavior, initialize only the verified empty CMS database, record published URLs and live checks.

Non-goals: provisioning another paid database cluster, importing production personal data, sending email during deployment, silently enabling delivery, replacing Auth, destructive database resets or suppressing type errors to claim a clean build.

## Decisions

### Invocation context

Use AsyncLocalStorage for invocation environment and pool. getPool returns the invocation pool inside Workers, otherwise the existing lazy Node pool. Construct each Worker pool inside the request or scheduled event; await routing/execution and close that pool. Preserve transaction AsyncLocalStorage and fail closed if Worker configuration is invalid. Route client remains the existing PostgreSQL compatibility client.

### HTTP and templates

Use Cloudflare's Node HTTP bridge for IncomingMessage/ServerResponse parity, with the app invoked inside an explicit request scope. Bundle template strings through a generated JSON module shared by Node and Workers instead of filesystem reads at import. Test actual workerd health, CORS, auth denial and database routing.

### Delivery trigger

Provide scheduled execution of the existing bounded runOnce executor with DELIVERY_ENABLED required to equal true. Default false and no automatic send on deploy. PostgreSQL conditional claims remain the cross-invocation protection. Invocation environment supplies existing provider config without exposing secrets to the frontend. Publish readiness and central admin checks remain unchanged.

### Pages and deployment

Produce a real Vite production bundle and Pages headers permitting only the configured Auth origin to frame /logout/local. Preserve SPA callback paths and queries. Generate Wrangler configuration with HTTPS production origins, uncached Hyperdrive and verified account identifiers. Bootstrap schema with a single transaction only after checking the logical database name and absence of application tables, never run the destructive local reset script. Register the email-cms OIDC client with exact Pages callback/logout metadata before login smoke. Production publication runs only through push-to-main CI after preflight gates; no send or seed of directory eligibility is implied.

## Implementation Contract

Workers fetch and scheduled handlers run with separate pools and environment even under concurrent calls. Node dev/start commands remain supported. Static template metadata and rendered HTML match the original disk assets. Missing/unsafe production configuration returns an unavailable response without leaking credentials. DELIVERY_ENABLED=false prevents execution on scheduled events. Pages /auth/callback and /logout/local serve the SPA with correct headers. Deployment checks verify database/schema, auth discovery, protected API denial and frontend assets; authenticated smoke requires existing eligible identity and exact registration. Test results distinguish bundle success, inherited type errors, published services and complete browser behavior.

## Risks / Trade-offs

- Existing compiler failures are an independent release gate; fix reachable typing/runtime defects without weakening checks.
- The current CMS storage implementation contains mock/legacy paths; deployment documentation must disclose unsupported media operations and avoid claiming tested durable uploads.
- Account and database access might require user action; complete implementation and local verification while access is resolved.
- Production delivery stays disabled until provider configuration and activation are explicitly authorized.

### Build compatibility corrections

Generate SQL row contracts from schema, retain explicit joined projection types, preserve composite upsert conflict keys and normalize PostgreSQL numeric values at DTO boundaries. Use a Worker-compatible HTML parser and bundle templates. Resolve emitted backend import aliases and the shared runtime export for plain Node. Compiler checks remain enabled.
