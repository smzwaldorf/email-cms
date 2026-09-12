## 1. Runtime
- [x] 1.1 Implement Invocation context with per-event environment/pool and verified closure using concurrent isolation tests.
- [x] 1.2 Implement HTTP and templates with bundled template parity and real workerd API/database smoke.
- [x] 1.3 Implement Delivery trigger with explicit disabled default and scheduled no-send tests.
## 2. Build and publish
- [x] 2.1 Prepare Pages and deployment configuration, logout headers, protected empty-database bootstrap and regression checks; verify production bundle and compiler status without suppressing failures.
- [ ] 2.2 Resolve target account and CMS database access, initialize schema, configure uncached Hyperdrive and exact OIDC registration; verify read-only database and Auth checks.
- [ ] 2.3 Publish Pages and Workers, verify live endpoints and record URLs, build/test results and remaining limits in the deployment guide.

Verification note: 1.2 has bundled templates and local workerd auth/CORS/no-send coverage, but database smoke remains blocked. 2.2 and 2.3 remain blocked by SMZ account access, database setup and the live Auth coordinator rejecting email-cms. No publication has occurred.

2026-09-12: task 1.2 verified with a disposable PostgreSQL 17 database (42 tables), workerd database health under five concurrent requests, and disabled scheduled execution. Auth prerequisite release 6fd82cc passed CI and deployed; production CMS initialization/publication remain pending.
