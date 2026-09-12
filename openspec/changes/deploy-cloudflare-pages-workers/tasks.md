## 1. Runtime
- [x] 1.1 Implement Invocation context with per-event environment/pool and verified closure using concurrent isolation tests.
- [x] 1.2 Implement HTTP and templates with bundled template parity and real workerd API/database smoke.
- [x] 1.3 Implement Delivery trigger with explicit disabled default and scheduled no-send tests.
## 2. Build and publish
- [x] 2.1 Prepare Pages and deployment configuration, logout headers, protected empty-database bootstrap and regression checks; verify production bundle and compiler status without suppressing failures.
- [x] 2.2 Resolve target account and CMS database access, initialize schema, configure uncached Hyperdrive and exact OIDC registration; verify read-only database and Auth checks.
- [x] 2.3 Publish Pages and Workers, verify live endpoints and record URLs, build/test results and remaining limits in the deployment guide.

2026-09-12: all six deployment tasks verified. Local PostgreSQL 17 accepted the 42-table schema; workerd passed concurrent health, auth/CORS and disabled scheduled checks. Auth release `6fd82cc` and CMS release `f68468d` deployed through push-to-main CI. CMS run 34691246901 initialized production through the uncached CMS Hyperdrive, passed schema/Auth preflight, published Pages and Worker, and passed all HTTP smoke checks. The one-time initializer flag and unused invalid GitHub database secret were removed.

Dia verified CMS login and the correct SMZ Identity/Google account chooser handoff. Completed Google login, authenticated reads, refresh and coordinated logout still require an existing eligible identity; no admission grants or seed users were added. Delivery stays disabled. Published URLs and remaining product limits are recorded in specs/docs/CLOUDFLARE.md.
