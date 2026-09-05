# Ownership change review and validation

Reviewed 2026-09-05; final Dia verification completed 2026-09-06 Asia/Taipei in isolated branch `codex/cms-auth-permissions`, based on `b9689c7` (`migrate/backend-owned-reader-api`). The saved checkout, its docker-compose changes and untracked Resend proposal were inspected read-only and preserved. No deployment, real sends, original-database reset or production data changes were made. The user explicitly authorized committing the reviewed change on 2026-09-06 despite the documented inherited build failures. The later Dia validation used a disposable schema-only database with synthetic seed records, described below.

## Current evidence and commit authorization

| Check | Result | What it establishes |
| --- | --- | --- |
| OpenSpec strict change validation | Passed | Proposal/design/spec/tasks are syntactically valid |
| Spectra validate / analyze | Passed / clean | Artifact validity, coverage, consistency and examples |
| ESLint | Passed | Frontend/backend/shared lint |
| Shared TypeScript build | Passed | Shared action-policy package builds |
| Backend ordinary suite | 197 passed, 7 skipped | 3 opt-in joint cases and 4 database cases are excluded from normal run |
| Focused frontend suite | 22 passed | OIDC resource/state, callback URL return, outage retry, session and service contracts |
| Final cross-project joint suite | 3 passed | Real Auth tokens/directory and actual CMS HTTP with fixture SQL/provider seam |
| Transaction tests | 2 passed | Single-connection query routing, commit ordering and rollback on failure |
| Backend production build | Failed: 527 diagnostics | Baseline b9689c7 has 541; no new normalized diagnostics |
| Frontend production build | Failed: 98 diagnostics | Baseline b9689c7 has 99; no new normalized diagnostics |

The earlier instruction held commits until the overall workflow passed. On 2026-09-06, after reviewing the real Google/Dia + isolated PostgreSQL/local-capture results and inherited production build failures, the user explicitly authorized committing this reviewed source, tests, specifications and documentation. That authorization supersedes the earlier commit hold. Production builds remain blocked and actual provider delivery/receipt is untested; this commit is not approval to push, merge, deploy or send email.

Backend build blockers are inherited query-builder result typing (`src/lib/query.ts`), unknown row inference in `adminService`, `ArticleService`, delivery services and other Postgres compatibility clients. Frontend blockers include nullable storage results, missing storage metadata fields and incompatible legacy adapter/service row types. These prevent production `tsc && vite build`/backend output verification. They did not prevent the real HTTP integration test, which executes TypeScript through Vitest. No broad unrelated typing rewrite was attempted.

Pre-browser CMS runtime SHA-256: `d3802c7cb8f0cd6ad9d51726e1568e4e2ec660fb2c806937251d33e6eb4b072a` over sorted backend `.ts`, frontend `.ts/.tsx` and shared `.ts` source paths, each encoded as path + NUL + bytes + NUL. Auth peer's final runtime is documented in its own review; joint verification used the restarted bridge with the final central session/refresh and Google-email checks.

## Dia browser and isolated PostgreSQL validation

The parent task alone controlled Dia. Auth ran latest source on localhost:3000 with a disposable clone and the existing approved real Google identity; no fixture session replaced Google sign-in. CMS frontend ran on :5174, backend :8787, worker separately.

- The stopped original CMS volume `email-cms_email-cms-postgres-data` was mounted read-only and copied to `email-cms-browser-review-20260905`. Read-only inspection of its copy found 10 articles, 5 newsletters, 3 families, 6 users, and 42 public tables. A schema-only database `cms_browser_synthetic` was then created in the disposable container on :55440. Original data/checkout were preserved.
- Synthetic newsletter `93000000-0000-4000-8000-000000000001`, article `94000000-0000-4000-8000-000000000001` / short ID `diatest001`, and two `example.test` recipient records were seeded. The backend used only a fake Kit key with `KIT_API_BASE_URL=http://127.0.0.1:8788`. The local capture server makes no outbound requests and rejects non-example.test subscriber addresses.
- Parent reported actual Google sign-in, CMS session, article-title save to **Dia verified school news**, readiness candidates 2 / eligible 1 / excluded 1, and explicit publish-and-deliver confirmation in Dia. The original publication produced batch `c52fbd9b-9621-476f-aa3f-a62677768768` and job `510d42bb-58cc-4de2-9304-63a6b6503612` in real PostgreSQL.
- Actual worker execution exposed three inherited compatibility gaps: relation projections split on embedded commas / omitted join hints; absent article-tag relation metadata; PostgreSQL Date versus persisted text revision equality. These were fixed. Revision normalization compares the same UTC instant and still rejects changed revisions.
- The first 4 attempts failed before provider calls. After the third failure, the same synthetic job was explicitly requeued with its attempt history retained and max attempts increased from 3 to 6. Attempt 5 succeeded. Exactly one subscriber and one broadcast were captured; the subscribed recipient is ready/sent with local ID `kit-broadcast-115`. The pending recipient remains skipped with `not_subscribed`. These are simulated provider acknowledgments, not real email delivery.
- Captured personalized HTML contains the saved title and `http://localhost:5174/week/2026-W36/diatest001`. Local evidence: `/tmp/cms-kit-capture/requests.jsonl`, `/tmp/cms-kit-capture/state.json`, `/tmp/cms-kit-capture/email.html`, `/tmp/cms-kit-capture/broadcast.json`. Preview: `http://127.0.0.1:8788/capture/email.html`. Capture harness: `/tmp/cms-kit-capture.mjs`; seed script: `/tmp/cms-browser-seed.sql`.
- Parent reported clone-only removal of admin role became effective: admin navigation returned to published reader, editing controls disappeared, and public published article remained readable. A callback interrupted by the backend restart recovered via the retry button.
- Browser fixes: Google-only login copy; admin default landing on dashboard; authenticated empty-reader home before any publication; incoming article path/query/hash retained instead of legacy reader normalization. A regression test targets the second of two articles, asserting its selection and complete URL retention. Parent subsequently confirmed the final fresh-Google assertion against the restarted final backend: normal central logout-all, App A unauthenticated and `/api/auth/get-session` null; opening `/week/2026-W36/diatest001?from=dia-email` led to the exact encoded login return, Google-only SMZ sign-in, the real approved-account chooser, and the exact original article path/query displaying **Dia verified school news** and its content. Parent also inspected the actual captured HTML in Dia and clicked its article link. Parent reported revoke denial and parent-only/admin denial had passed earlier.
- A separate real PostgreSQL probe (`/tmp/cms-live-verify.ts`) verified both multi-column relation joins and an intentional transaction rollback, confirming the newsletter title remained unchanged; it also asserted captured-only sent 1 / consent-skipped 1. This does not simulate a database crash during publish.

Post-fix checks: backend **197 passed / 7 skipped**; focused callback and reader tests **8 passed**; additional relation/date delivery tests included in backend count; changed-file ESLint passed. Final production build rerun remains 527 backend / 98 frontend diagnostics, with zero new normalized diagnostics against baseline b9689c7. Logs: `/tmp/cms-browser-backend-build.log`, `/tmp/cms-browser-frontend-build.log`; test logs: `/tmp/cms-browser-backend-tests.log`, `/tmp/cms-browser-front-tests.log`. Backend ordinary command used `DATABASE_URL=` to avoid enabling the four historical data-specific cases from the disposable `.env.local`.

Current source runtime SHA-256: `5d35b270f5b45e991fc33ba7b1aced9a88fa8d62987f568e46e3dbf18e276d77` using the same sorted path + NUL + bytes + NUL algorithm. The reviewed source is authorized for commit; the runtime fingerprint is unchanged by the documentation-only authorization update. After final browser confirmation, the owned delivery worker was stopped to prevent further queued sends. Frontend :5174, backend :8787, capture :8788 and disposable PostgreSQL :55440 remain available for review. No new sends were initiated.

## Joint workflow evidence

[auth-cms-email.joint.test.ts](../../apps/backend/tests/integration/auth-cms-email.joint.test.ts) ran against the Auth peer's disposable server at localhost:3300 and its disposable database at :55439. The test starts a real ephemeral loopback CMS HTTP server.

- Auth bridge minted actual public `email-cms` Authorization Code + PKCE tokens and checked state/callback to the registered :5174 URL. Its sessions are fixture-created; this is not browser/Google UI evidence.
- CMS used actual live UserInfo/access-context with matching subject and client. Parent+teacher roles produced G4 parent/C4 read scope and G6 teacher/C6 edit scope.
- A real HTTP article edit succeeded; role downgrade, class membership removal, privileged metadata edit and teacher publication were denied. Central revoke returned 403, invalid token 401, and controlled directory outage 503, without local-role fallback.
- Real admin HTTP readiness/publication called actual newsletter, batch, recipient and durable-job services against an in-memory SQL fixture. Worker and personalized HTML preparation ran unchanged. Pending subscription was excluded. Only one ready recipient reached the mocked Kit send seam; its provider message/status persisted. Repeated publication returned 409.
- Actual Kit webhook route/verifier accepted the fixture shared secret, persisted one callback, deduplicated repeated event ID and retained the unresolved subscriber for reconciliation. Missing secret returned 401 and wrote no event.
- Generated HTML includes the protected article URL. The frontend callback tests separately prove safe intended route/query return and retry after a directory outage without replaying the consumed OIDC callback.
- [transaction.test.ts](../../apps/backend/tests/unit/lib/transaction.test.ts) separately verifies rollback/query routing. It uses a mocked PoolClient, not live PostgreSQL transaction semantics.

Reproduce after the Auth peer deliberately starts its test-only `tests/integration/cms-bridge.ts`:

```bash
SMZ_CMS_BRIDGE_FIXTURE=/tmp/smz-auth-cms-fixture.json npm run test -w @email-cms/backend -- tests/integration/auth-cms-email.joint.test.ts tests/unit/lib/transaction.test.ts
```

The fixture contains temporary tokens/control secret, is local mode 0600, must never be committed or printed, and changes after bridge resets. Normal `npm test` skips joint cases unless explicitly enabled. The bridge is separate from the saved local services on 3000/5173/4000. The peer owns its lifecycle.

Other verification commands:

```bash
npm run lint
npm run build -w @email-cms/shared
npm run test -w @email-cms/backend
npm run test -w @email-cms/frontend -- tests/pages/AuthCallbackPage.test.tsx tests/context/AuthContext_SmzSession.test.tsx tests/unit/authService.test.ts tests/services/readerApi.proxy.test.ts tests/services/adminService.proxy.test.ts tests/unit/utils/urlUtils.test.ts tests/unit/services/newsletterDeliveryService.test.ts
OPENSPEC_TELEMETRY=0 openspec validate delegate-auth-and-enforce-cms-permissions --type change --strict --no-interactive
spectra validate delegate-auth-and-enforce-cms-permissions
```

## Documentation inventory and disposition

The review covered repository entry points, all `specs/docs` guides, requirements/roadmaps, all 21 current OpenSpec capabilities, both existing active OpenSpec changes, the new ownership change, and the relevant versioned database/auth/admin setup, API, security and deployment records. Archived OpenSpec changes and historical completion results were preserved as history. Legacy `src/` trace paths in old records may predate the monorepo.

| Group | Review outcome |
| --- | --- |
| README, CLAUDE and docs index | Current ownership/setup rewritten; old README preserved under history |
| New SMZ_AUTH_CMS_CONTRACT and config/local.env.example | Canonical API, scope/port, identity/class mapping, permission, failure, publishing and provider contract |
| Magic-link, email setup, quick reference and database deployment guides | Explicitly marked superseded; SMTP/Supabase login instructions are historical |
| Login model, auth strategy and security review | Marked historical; no current assurance inferred from old zero-findings/completion claims |
| Email platform and personalization operations | Current subscribed-only/admin/transaction boundary added; old deployment checkmarks retained as history |
| Analytics strategy | Historical note rejects treating tracking tokens as login credentials |
| Requirements and roadmaps | Ownership override; earlier local role/magic-link plans are historical |
| Advanced-permission-management artifacts | Marked superseded for local role assignment; future CMS policy UI must consume central facts |
| Analytics-and-reporting artifacts | Reviewed as separate pending product scope; retention/export/reconciliation gaps remain unchanged |
| Current OpenSpec class/family/student/teacher capabilities | Ownership notes distinguish central directory changes from local delivery business data |
| Newsletter/personalization/template/media capabilities | Reviewed against implementation; newsletter/admin/delivery/journey and Kit specs gain current boundary notes; unrelated template/media semantics retained |
| Versioned database/auth/admin guides | 20 direct-entry historical records marked superseded without rewriting original results |
| Saved untracked replace-kit-delivery-with-resend proposal | Read-only planning reference; not copied, activated, deployed or implemented |

All 117 checked local documentation links resolve. Historical bodies retain original external links and old trace paths; those were not presented as currently valid deployment instructions.

The current [contract](SMZ_AUTH_CMS_CONTRACT.md) was cross-reviewed with the Auth peer's `docs/AUTH-CONTRACT.md`. Both agree that the present reader needs class-code mapping only; future cross-system family/student joins require explicit identifiers/mappings. No contract discrepancy remained after that clarification.

## Remaining discrepancies and follow-on scope

1. Production build blockers above prevent full production readiness; they no longer prohibit the explicitly authorized commit. Four old data-specific database cases remain skipped in the ordinary suite; the isolated PostgreSQL browser workflow and live rollback probe below provide separate real-database evidence.
2. Legacy frontend database-client methods still exist outside the exercised reader/edit/admin paths. The gateway now denies unsafe direct mutations. Full analytics write APIs and remaining legacy editor/media workflows require scoped migration and UI tests; denial must not be described as feature completion.
3. CMS retains local delivery family/student/class records. There is no authoritative directory-to-delivery synchronization/import mapping yet. Local changes must not be mistaken for central admission changes.
4. Batch code pins revision references and rejects mismatches; it does not yet store a complete immutable content/template snapshot. Worker crash recovery/provider ambiguity and automatic retry safety require further durable-state design/testing before production sends.
5. The Resend migration is still proposed, including its distinct provider IDs, idempotency and Svix callback contract. Current callbacks are Kit shared-secret handlers.
6. Older advanced permission UI and analytics/export/retention plans are not fully implemented by this ownership change. Historical guides retain their original body/examples under explicit superseded notices.
7. Real provider delivery and actual mailbox receipt remain untested. The later Dia run verified a real Google roundtrip and local provider capture, and the isolated PostgreSQL probe verified rollback. No implied deployment approval follows from these results.

## Updated document paths

- [CLAUDE.md](../../CLAUDE.md)
- [README.md](../../README.md)
- [openspec/changes/advanced-permission-management/README.md](../../openspec/changes/advanced-permission-management/README.md)
- [openspec/changes/advanced-permission-management/design.md](../../openspec/changes/advanced-permission-management/design.md)
- [openspec/changes/advanced-permission-management/implementation-audit.md](../../openspec/changes/advanced-permission-management/implementation-audit.md)
- [openspec/changes/advanced-permission-management/proposal.md](../../openspec/changes/advanced-permission-management/proposal.md)
- [openspec/changes/advanced-permission-management/specs/admin-access-control-workflow/spec.md](../../openspec/changes/advanced-permission-management/specs/admin-access-control-workflow/spec.md)
- [openspec/changes/advanced-permission-management/specs/multi-role-permission-resolution/spec.md](../../openspec/changes/advanced-permission-management/specs/multi-role-permission-resolution/spec.md)
- [openspec/changes/advanced-permission-management/tasks.md](../../openspec/changes/advanced-permission-management/tasks.md)
- [openspec/specs/class-management-workflow/spec.md](../../openspec/specs/class-management-workflow/spec.md)
- [openspec/specs/family-management-workflow/spec.md](../../openspec/specs/family-management-workflow/spec.md)
- [openspec/specs/kit-contact-sync/spec.md](../../openspec/specs/kit-contact-sync/spec.md)
- [openspec/specs/kit-webhook-reconciliation/spec.md](../../openspec/specs/kit-webhook-reconciliation/spec.md)
- [openspec/specs/newsletter-admin-workflow/spec.md](../../openspec/specs/newsletter-admin-workflow/spec.md)
- [openspec/specs/newsletter-delivery-workflow/spec.md](../../openspec/specs/newsletter-delivery-workflow/spec.md)
- [openspec/specs/newsletter-email-reader-journey/spec.md](../../openspec/specs/newsletter-email-reader-journey/spec.md)
- [openspec/specs/student-association-management/spec.md](../../openspec/specs/student-association-management/spec.md)
- [openspec/specs/student-onboarding-wizard/spec.md](../../openspec/specs/student-onboarding-wizard/spec.md)
- [openspec/specs/teacher-management-workflow/spec.md](../../openspec/specs/teacher-management-workflow/spec.md)
- [specs/002-database-structure/docs/CONTRIBUTING.md](../002-database-structure/docs/CONTRIBUTING.md)
- [specs/002-database-structure/docs/DEPLOYMENT.md](../002-database-structure/docs/DEPLOYMENT.md)
- [specs/002-database-structure/docs/ERD.md](../002-database-structure/docs/ERD.md)
- [specs/002-database-structure/docs/RLS_POLICY_EXPLANATION.md](../002-database-structure/docs/RLS_POLICY_EXPLANATION.md)
- [specs/002-database-structure/docs/SETUP.md](../002-database-structure/docs/SETUP.md)
- [specs/002-database-structure/docs/TESTING.md](../002-database-structure/docs/TESTING.md)
- [specs/002-database-structure/docs/short-id-implementation.md](../002-database-structure/docs/short-id-implementation.md)
- [specs/002-database-structure/spec.md](../002-database-structure/spec.md)
- [specs/003-passwordless-auth/README.md](../003-passwordless-auth/README.md)
- [specs/003-passwordless-auth/docs/API-ENDPOINTS.md](../003-passwordless-auth/docs/API-ENDPOINTS.md)
- [specs/003-passwordless-auth/docs/DEPLOYMENT.md](../003-passwordless-auth/docs/DEPLOYMENT.md)
- [specs/003-passwordless-auth/docs/PHASE-12-OPTIMIZATIONS.md](../003-passwordless-auth/docs/PHASE-12-OPTIMIZATIONS.md)
- [specs/003-passwordless-auth/docs/SECURITY.md](../003-passwordless-auth/docs/SECURITY.md)
- [specs/003-passwordless-auth/docs/SETUP.md](../003-passwordless-auth/docs/SETUP.md)
- [specs/003-passwordless-auth/spec.md](../003-passwordless-auth/spec.md)
- [specs/005-admin-dashboard/docs/ADMIN_API.md](../005-admin-dashboard/docs/ADMIN_API.md)
- [specs/005-admin-dashboard/docs/IMPLEMENTATION_STATUS.md](../005-admin-dashboard/docs/IMPLEMENTATION_STATUS.md)
- [specs/005-admin-dashboard/docs/SECURITY_REVIEW.md](../005-admin-dashboard/docs/SECURITY_REVIEW.md)
- [specs/005-admin-dashboard/docs/SESSION_TIMEOUTS.md](../005-admin-dashboard/docs/SESSION_TIMEOUTS.md)
- [specs/005-admin-dashboard/spec.md](../005-admin-dashboard/spec.md)
- [specs/FUTURE-PLANS-DETAILS.md](../FUTURE-PLANS-DETAILS.md)
- [specs/FUTURE-PLANS.md](../FUTURE-PLANS.md)
- [specs/docs/EMAIL_PLATFORM_OPERATIONS.md](EMAIL_PLATFORM_OPERATIONS.md)
- [specs/docs/EMAIL_SETUP_GUIDE.md](EMAIL_SETUP_GUIDE.md)
- [specs/docs/MAGIC_LINK.md](MAGIC_LINK.md)
- [specs/docs/PERSONALIZED_EMAIL_WORKFLOW.md](PERSONALIZED_EMAIL_WORKFLOW.md)
- [specs/docs/QUICK_REFERENCE.md](QUICK_REFERENCE.md)
- [specs/docs/README.md](README.md)
- [specs/docs/UX_UI_AUDIT_DESIGN_SYSTEM.md](UX_UI_AUDIT_DESIGN_SYSTEM.md)
- [specs/docs/analytics/ANALYTICS-STRATEGY.md](analytics/ANALYTICS-STRATEGY.md)
- [specs/docs/database/DATABASE_AND_DEPLOYMENT.md](database/DATABASE_AND_DEPLOYMENT.md)
- [specs/docs/login/SECURITY_REVIEW.md](login/SECURITY_REVIEW.md)
- [specs/docs/login/authentication-authorization.md](login/authentication-authorization.md)
- [specs/docs/login/user-system-model.md](login/user-system-model.md)
- [specs/requirements.md](../requirements.md)
- [Current contract](SMZ_AUTH_CMS_CONTRACT.md)
- [Environment example](../../config/local.env.example)
- [Historical README](history/README-before-auth-separation.md)
