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

## Follow-up: development Admin/Parent verification (2026-09-06)

The parent explicitly requested one-click synthetic Admin/Parent login owned by Auth. CMS required no authentication bypass or runtime policy change. The login copy now refers to the approved school account, allowing Auth to present its enabled methods. Before login, read-only inspection of `cms_browser_synthetic` found zero matching emails or subjects for the proposed dev identities; the existing `diatest001` article is public and published. No local privileged roles or delivery subscriptions were seeded for the dev users.

New regressions: `apps/backend/tests/integration/parent-readonly.test.ts` **8 passed**, using real CMS routes, identity resolution and article policy with only central HTTP/PostgreSQL boundaries stubbed. It checks identity bootstrap, stale local admin rejection, public-only reading, parent denials for admin/read-RPC, publish, article/media data mutation and text edit, and live central admin-to-parent downgrade. `apps/frontend/tests/pages/ParentReadonly.test.tsx` **2 passed**, checking the admin route and menu are unavailable to a parent. Auth reports its development runtime ready. Auth ran the CMS live probe within its own task, keeping credentials private: both sessions and the Parent public read passed, all five Parent mutation/admin attempts returned 403, and the article remained unchanged. The Admin list RPC exposed a missing `newsletter_articles(count)` aggregate projection; the query adapter now uses a correlated JSON count subquery that retains zero-child newsletters without duplicating multiple-child newsletters. Relation tests now total 4 passed; an actual PostgreSQL probe verified zero/multiple counts, successful Admin list service and rollback of all temporary records. The sanitized same-task live API rerun passed all 10 checks, including Admin `fetchNewsletters` 200, Parent reads, and all five Parent denial paths 403 with unchanged article content. No Admin write, publish or send was attempted. Parent-controlled Dia verification subsequently passed after Auth fixed its sign-in page referrer policy: fresh one-click Admin opened `/admin` with the working dashboard (1 newsletter / 1 article) and admin controls. After normal logout and App A confirming unauthenticated, the protected `/week/2026-W36/diatest001?from=dev-parent` link led to one-click Parent sign-in and returned to the exact path/query, displaying **Dia verified school news**, its content, and `dev.parent@smz.example.test`. No Edit control appeared. The user menu showed Parent and Sign Out only, without Admin navigation. Direct `/admin` navigation redirected to `/week/2026-W36` and retained the Parent session. These browser assertions were performed only by the parent task; they are separate from stubbed regressions and live API checks. Auth reported that automatic approval review rejected sharing a private token fixture between tasks, so no fixture or token was transferred to CMS.

This follow-up remains uncommitted. The previously reviewed ownership implementation is commit `1a9d7fc`; inherited production build limitations remain unchanged. Review servers remain available and the delivery worker remains stopped.

Dev-role follow-up runtime fingerprint: `1a000adab996494bac919ddb9b0475836df7c091fe7ad50ac910a040501e6486`. The backend was restarted with the count fix; provider settings were unchanged and the delivery worker stayed stopped. Live count probe: `/tmp/cms-count-probe.ts`.

Read-only post-login CMS DB verification found both synthetic issuer/subject links with local compatibility role `student`, including the central Admin. Effective privilege therefore continues to come from live central roles. The public article remained unchanged and total delivery jobs remained 1. The backend build rerun still reports 527 inherited diagnostics with zero new normalized diagnostics; no production-build pass is claimed.

The dev-role follow-up is complete and remains uncommitted as requested. Final documentation-only evidence update passed `git diff --check`; prior focused tests, real API checks and live PostgreSQL results remain applicable. Frontend, backend and capture previews remain available, with the delivery worker stopped and provider configuration unchanged. Auth reported deleting its private token fixture after the successful live checks.

## Follow-up: global logout across linked applications (2026-09-06)

The user requested that normal Sign Out end access in all linked applications for the current browser session. CMS now clears local state and enters Auth `/logout-all/email-cms`; Auth owns current-session revocation, registered cleanup destinations and the bounded coordinator. Unrelated devices and the upstream Google account are outside this logout scope.

CMS adds unguarded `/logout/local` with no auth hydration. Only an iframe with configured Auth referrer origin and UUID logout state can clear/acknowledge; the acknowledgment target is fixed to Auth, and no caller return URL is followed. Vite dev/preview sets route-specific `frame-ancestors` to the configured Auth origin. The live route returned 200 with `frame-ancestors http://localhost:3000` and no X-Frame-Options blocker.

Local cleanup removes OIDC state/user, bearer and mapped user/roles; it broadcasts same-origin logout and persists a marker. Initialization, storage events, focus, visibility and page restoration detect missed logout; visible authenticated sessions revalidate every 15 seconds. Bearer storage is now per-tab sessionStorage, aligned with the OIDC store; legacy shared bearer storage is removed. Epoch/marker guards prevent delayed callback, session and refresh results from restoring logged-out privilege. Late OIDC user-loaded events are discarded. The old refresh resource identifier was corrected to the canonical directory resource. AuthContext owns monitoring cleanup, including initialization interrupted by unmount.

Validation: **31 focused frontend tests passed**, covering local/global logout ordering, cleanup failure still reaching central revocation, cross-tab and missed-event cleanup, in-flight races, fresh login after earlier logout, central role revalidation, per-tab bearer isolation, delayed401 isolation, trusted iframe/UUID/ACK, and existing callback/parent UI boundaries. Changed-file ESLint and diff check passed. Tests log: `/tmp/cms-global-logout-tests.log`. Auth subsequently reported its same-task live probe passed: CMS `/api/auth/session` returned 200 before global logout and 403 afterward; access checks for App A, App B and CMS returned 403, refresh requests returned 400, and the central get-session response was null. Tokens were neither shared nor persisted by that probe. Auth separately reports current-SID revocation tests preserve unrelated-device access. Parent-controlled Dia then passed both directions. CMS menu Sign Out entered the central coordinator, received all 3 cleanup acknowledgments and automatically returned to `/login`; the existing App A and App B tabs showed Not authenticated on focus without manual reload. For the reverse test, App B required the Auth chooser after the prior logout, one-click Admin signed in successfully, and fresh SSO reauthenticated existing App A and CMS tabs, with CMS reaching `/admin`. App B Sign out then returned automatically to its unauthenticated root; focusing the existing App A tab showed Not authenticated, and focusing the existing CMS admin tab redirected to `/login?redirect_to=%2Fadmin` without a manual reload. Retrying CMS login showed the Auth chooser, confirming the central session had ended. These observations also verify successful fresh login after an earlier global logout. The parent alone controlled Dia.

Current global-logout runtime fingerprint: `b2ceaeeb2176e8884f6bb27835f7dbe9f7fa2826949684351422ada7b80f9b14`. Earlier dev-role fingerprint is historical. Dev-role changes remain preserved and all follow-up changes remain uncommitted. The delivery worker stays stopped, provider settings unchanged, and previews remain available.

The global-logout frontend build rerun still fails with 98 inherited diagnostics and zero new normalized diagnostics against the previous reviewed frontend. Build log: `/tmp/cms-global-logout-build.log`. The unchanged backend previously reported 527 inherited diagnostics. No production-build pass is claimed.

Global-logout follow-up complete: final changes were documentation only, `git diff --check` passed, and no additional browser run was needed. All uncommitted dev-role and global-logout changes are preserved. Previews remain available, the delivery worker remains stopped, and no commit, deployment or email send was performed for these follow-ups.

### Runtime adapter boundary — 2026-09-07

Implemented under `openspec/changes/separate-runtime-adapters` after validated artifacts. Reusable createCmsApplication keeps the existing Node route handler; startNodeHttp owns listener startup, request drain and resource closure. The guarded HTTP/worker entrypoints own environment and process signals. The polling adapter is inert until start, prevents overlap and drains the existing runOnce batch before closing resources. Existing claims/retries/provider behavior is unchanged. See [runtime guide](RUNTIME_ADAPTERS.md) for interfaces, shared pool ownership, Node dependencies and the absence of a forced drain cutoff.

Verification: 22 runtime tests passed; the combined backend runtime/auth/parent/action-boundary/delivery/count selection passed 62 tests. Three optional cross-service fixture tests were skipped because no bridge fixture was supplied. Frontend session/global-logout/parent/callback regression tests passed 31 tests across eight files. Changed runtime files and tests passed ESLint; git diff whitespace checks passed; Spectra validation passed with no critical/warning findings. Backend compiler diagnostics stayed at 527 and frontend at 98, with zero new normalized diagnostics against the pre-adapter baseline. Production builds remain failing on inherited errors.

The unchanged HTTP development command successfully started the adapter on port 8787 for coordinated live smoke. This refactor verification did not start the live delivery worker, send email, migrate a database, change a provider or create a commit. Earlier dev-role/global-logout changes remain uncommitted and preserved. Runtime source digest (sorted source paths plus NUL-separated bytes, excluding Vite config) is `5d6e7fdf1cb144b39448bfd1d9764a3a3ff7c6edaaa2c8362902de2e72d6a90e`. The parent task owns fresh cross-service/browser smoke evidence; the existing browser evidence above predates this adapter refactor.

Parent independent live smoke on the restarted adapter passed: GET /api/auth/session returned 401 Missing bearer token with no-store and expected CORS; OPTIONS returned 204 with the same CORS; an unknown route returned 404. The parent also independently confirmed restarted Auth port 3000 returned 200 from /health and passed its diff check.

Final joint verification, reported by the Auth task and confirmed through the parent: a same-task private-token probe against the restarted Auth and CMS adapters returned 200 for Admin and Parent session/read requests, with management access returning 200 for Admin and 403 for Parent. After global logout, CMS returned 403, all three application access grants returned 403, refresh requests returned 400, and the central session was null. Only sanitized results were shared; the probe did not publish content or send email. Auth recorded 40 passing unit tests (including 17 runtime tests), 39 CMS-enabled and 38 default database tests, nine actual HTTP dev-login tests, and passing Auth/example typechecks and builds. This closes the pending authenticated cross-project verification for the adapter refactor. Earlier browser observations remain separately dated; no new browser run is claimed. CMS inherited compiler failures remain unchanged, and no commit was created.


### Cloudflare preparation — 2026-09-12

The current change supersedes the earlier compiler-failure status: shared, backend and frontend production builds pass, including the Worker-specific typecheck and Wrangler dry run (1,609.73 KiB / 337.26 KiB gzip). Schema-derived row contracts, explicit relation projections and numeric normalization fix typing at database boundaries. Composite upserts retain their conflict keys; legacy identity RPCs fail closed. Bundled templates and the HTML parser work under workerd. Compiled Node startup was separately verified with an unauthenticated 401 and graceful exit after resolving emitted aliases and the shared ESM export.

Focused regressions pass: 146 backend tests in 14 files and 76 frontend tests in 10 files. Local workerd session/CORS and disabled cron probes passed; no real database or provider was exercised. Changed TypeScript lint and whitespace checks pass. Production publication is prepared through push-to-main CI, with deployment preflight and HTTP smoke checks. See [Cloudflare guide](CLOUDFLARE.md).

**Not deployed.** Current Wrangler credentials cannot access the SMZ account. CMS schema/Hyperdrive are not live-verified. Current deployed Auth rejects `/logout-all/email-cms` with HTTP 400 `invalid_logout_return`, and its checked-out coordinator supports only app-a/app-b. Earlier local three-app logout evidence above does not establish compatibility with this current Auth deployment. Exact registration, Auth coordinator changes and fresh authenticated browser verification remain required. Durable media upload remains unsupported by the legacy/mock storage paths. Delivery stays disabled; no email, commit or push occurred.
