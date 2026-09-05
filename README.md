# Email CMS

React/TypeScript newsletter CMS with a Node backend, PostgreSQL and a separate delivery worker. SMZ Auth owns login eligibility, roles and school-directory relationships. CMS enforces action permissions and owns content and email delivery.

Start with the [current Auth/CMS contract](specs/docs/SMZ_AUTH_CMS_CONTRACT.md), [review and validation record](specs/docs/OWNERSHIP_REVIEW.md), and [local environment example](config/local.env.example).

```bash
npm install
npm run build -w @email-cms/shared
cp config/local.env.example .env.local
# Set the existing local DATABASE_URL and configure optional email-cms admission in SMZ Auth.
npm run backend:dev
# In another terminal:
npm run dev
```

CMS runs on localhost:5174; backend on :8787; central Auth on :3000. The Auth examples retain :5173 and :4000. This task does not start the sending worker or change local/production registrations.

```bash
npm run lint
npm run test -w @email-cms/backend
npm run test -w @email-cms/frontend
npm run build
```

Shared package builds and focused workflow tests are separate from production build readiness; existing migration typing failures and the joint workflow gate are recorded in the review. No real email is used in verification.

Authoritative runtime code lives under `apps/frontend`, `apps/backend`, and `packages/shared`. OpenSpec capability requirements are under `openspec/specs`; the ownership implementation is `openspec/changes/delegate-auth-and-enforce-cms-permissions`. Kit is the current provider. The unimplemented Resend proposal is not deployment authorization.

The [previous README](specs/docs/history/README-before-auth-separation.md) preserves earlier architecture, completion reports and Supabase-era instructions as history. Those are not current setup or security guidance.
