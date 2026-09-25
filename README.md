# Email CMS

For a controlled author-to-reader rehearsal, see the [two-family demo guide](docs/DEMO-NEWSLETTER.md). For confirmed email delivery metrics, see the [Resend webhook guide](docs/RESEND-WEBHOOKS.md).

React/TypeScript newsletter CMS with a Node backend, PostgreSQL and a separate delivery worker. SMZ Auth owns login eligibility, roles and school-directory relationships. CMS enforces action permissions and owns content and email delivery.

The backend has separate Node HTTP, Node delivery-worker and Cloudflare Worker entrypoints. Importing application modules starts no listener or delivery.

Start with the [local environment example](config/local.env.example) and the [contributor guide](CLAUDE.md). Production uses backend sessions with the confidential `email-cms-server` client; the local example starts in public-client compatibility mode.

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

CMS defaults to localhost:5173; backend to :8787; central Auth to :3000. The example local CMS database is on :55440. Do not launch another application on the same frontend port; any alternate origin needs matching CORS and OIDC registration. Local example delivery is disabled. Generated Cloudflare production configuration enables scheduled delivery, so verify its effective settings and audience before publishing.

```bash
npm run lint
npm run test -w @email-cms/backend
npm run test -w @email-cms/frontend
npm run build
```

Build and test results verify the checkout, not live login, hosted migrations, inbox receipt or reader access. Verify those separately in the target environment.

The [Cloudflare workflow](.github/workflows/cloudflare.yml) validates pull requests and deploys on pushes to `main`. It provisions the CMS session, Resend sending and tracking secrets, applies additive migrations, then deploys Worker and Pages. Resend webhook registration and its signing secret are separate activation steps.

Authoritative runtime code lives under `apps/frontend`, `apps/backend`, and `packages/shared`. Resend sends newsletters; Identity login emails also use Resend. Kit broadcast sending and outbound sync endpoints are disabled; historical records are retained.

## Repeatable newsletter demo

See [the two-family demo guide](docs/DEMO-NEWSLETTER.md) for insert-only synthetic seeds and the Resend inbox test. `npm run seed:demo` prints a plan; `--check` rehearses with rollback and `--apply` writes only a new fixture.
