# Email CMS

For authoring, class audiences, template preview, controlled sending and reading analytics, see the [newsletter journey runbook](specs/docs/NEWSLETTER-JOURNEY.md).

React/TypeScript newsletter CMS with a Node backend, PostgreSQL and a separate delivery worker. SMZ Auth owns login eligibility, roles and school-directory relationships. CMS enforces action permissions and owns content and email delivery.

See [runtime adapters](specs/docs/RUNTIME_ADAPTERS.md) for the reusable Node request handler, HTTP and worker lifecycle, shared pool ownership and Cloudflare invocation boundaries. Importing application and guarded entrypoint modules starts no listener or delivery.

Start with the [current Auth/CMS contract](specs/docs/SMZ_AUTH_CMS_CONTRACT.md), [review and validation record](specs/docs/OWNERSHIP_REVIEW.md), and [local environment example](config/local.env.example).

```bash
npm install
npm run build -w @email-cms/shared
# For a new setup only; preserve an existing .env.local:
cp -n config/local.env.example .env.local
# Set the existing local DATABASE_URL and configure optional email-cms admission in SMZ Auth.
npm run backend:dev
# In another terminal:
npm run dev
```

CMS defaults to localhost:5173; backend to :8787; central Auth to :3000. The current local CMS database is on :55440. Do not launch another application on the same frontend port; any alternate origin needs matching CORS and OIDC registration. See [runtime environments](specs/docs/RUNTIME-ENVIRONMENTS.md) for existing database reuse, server-session parity and standalone Node hosting. Delivery is disabled unless separately configured.

```bash
npm run lint
npm run test -w @email-cms/backend
npm run test -w @email-cms/frontend
npm run build
```

Shared, backend and frontend production builds now pass. Deployment still requires the live database and Auth/browser workflow gates recorded in the review. No real email is used in verification.

See the [Cloudflare deployment guide](specs/docs/CLOUDFLARE.md) for the deployed Pages/Workers topology, existing CMS database, commit-triggered CI, session secrets and release evidence.

Authoritative runtime code lives under `apps/frontend`, `apps/backend`, and `packages/shared`. OpenSpec capability requirements are under `openspec/specs`; the ownership implementation is `openspec/changes/delegate-auth-and-enforce-cms-permissions`. Resend is the newsletter sending provider; Identity login emails also use Resend. See [delivery configuration and verification](specs/docs/NEWSLETTER-JOURNEY.md). Kit broadcast sending and outbound sync endpoints are disabled; historical records are retained.

The [previous README](specs/docs/history/README-before-auth-separation.md) preserves earlier architecture, completion reports and Supabase-era instructions as history. Those are not current setup or security guidance.

## Repeatable newsletter demo

See [the two-family demo guide](docs/DEMO-NEWSLETTER.md) for insert-only synthetic seeds and the Resend inbox test. `npm run seed:demo` prints a plan; `--check` rehearses with rollback and `--apply` writes only a new fixture.
