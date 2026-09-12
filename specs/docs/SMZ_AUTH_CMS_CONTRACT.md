# SMZ Auth, CMS permissions and email contract

Reviewed 2026-09-05. This document supersedes the legacy Supabase authentication and direct database/RLS deployment instructions elsewhere in this repository. Historical implementation reports are not current readiness evidence.

## Ownership and runtime

| Responsibility | Owner |
| --- | --- |
| Google login, verified identity, approval, adult eligibility, central sessions | smz-auth |
| Roles, school relationships, per-client admission and revocation | smz-auth |
| Read/edit/delete/publish/delivery action policy | Email CMS backend |
| Composition, delivery subscription consent, recipient snapshots, batches/jobs, Kit handoff and callbacks | Email CMS |

CMS never accepts a user UUID as a token. `auth.ts` checks live access-context and UserInfo for each authenticated request. A central role downgrade overrides every legacy local role. The frontend delegates Authorization Code + PKCE/state/nonce and refresh handling to oidc-client-ts; it does not implement Google, passwords, magic links, or a second login allowlist.

## Local registration and configuration

| Setting | Value |
| --- | --- |
| Issuer | `http://localhost:3000/api/auth` |
| Resource | `http://localhost:3000/api/directory/v1` |
| Client | public `email-cms`, token auth method `none` |
| CMS origin | `http://localhost:5174` |
| Redirect URI | `http://localhost:5174/auth/callback` |
| Post-logout URI | `http://localhost:5174/login` |
| Backend / CORS origin | port `8787` / `http://localhost:5174` |
| Scopes | `openid profile email offline_access directory:access` |

Request the canonical resource at authorization, token exchange and refresh. The old `smz-directory` alias is invalid. The two Auth examples retain ports 5173 and 4000. CMS Vite uses strictPort so callbacks cannot drift silently.

In the Auth repository, review `packages/auth-server/seeds/email-cms.registration.example.json`, then use its documented seed dry-run/apply workflow and `ENABLE_EMAIL_CMS=true`. Registration alone grants nobody admission; a reviewed private directory seed must explicitly grant approved adults `email-cms` access. No Auth seed or database was applied by this CMS task. Consult Auth `docs/AUTH-CONTRACT.md` for approval, expiry, Google linking and revocation semantics.

Copy [config/local.env.example](../../config/local.env.example) to `.env.local`, supply the existing local DATABASE_URL, and use `npm run build -w @email-cms/shared`, `npm run backend:dev`, and `npm run dev`. Start `npm run worker:dev` only in an explicitly authorized sending environment. Never run `npm run seed` against existing data merely to configure authentication.

## Identity, roles and relationships

`user_auth_identities(issuer, subject)` is the durable link to CMS `user_roles.id`. Existing links win over email changes. A unique normalized verified-email match may bootstrap legacy data linkage; ambiguous or conflicting links stop rather than replace data. A centrally admitted identity with no local record receives a nonprivileged local anchor. Legacy `user_roles.role` and role-assignment rows remain history/compatibility data and never authorize HTTP requests.

Access-context has `sub`, `clientId`, `access: active`, `roles`, `familyMemberships`, `relatedStudentIds`, and `classScopes: {parent, teacher, effective}`. CMS binds `sub` to UserInfo and `clientId` to `email-cms`. It validates roles and scope arrays. Class scope values are Auth `classes.code`, mapped exactly to CMS `classes.class_code`, then to local `classes.id`. Missing, inactive or ambiguous codes grant no class access; display names and UUID resemblance are never matching rules.

Central family/student UUIDs are not CMS family/student IDs. Current reader access uses central class scopes, so it needs no family UUID join. CMS retains its existing family/enrollment/subscription records solely as delivery business data. Synchronizing those records with central family/student identities requires an explicit reviewed mapping/import contract and is not implemented here. Local relationship changes do not change login or reader authorization.

## Development role sign-in

Auth owns the explicitly enabled development-only Admin/Parent sign-in buttons and their environment guards. CMS has no development token, cookie or role bypass: either button must complete normal OIDC Authorization Code + PKCE and provide verified UserInfo plus active `email-cms` access-context on every protected request.

The synthetic identities are `dev.admin@smz.example.test` (subject `d0000000-0000-4000-8000-000000000001`, role `admin`) and `dev.parent@smz.example.test` (subject ending `0002`, role `parent`). They bootstrap ordinary local identity anchors; do not assign local admin roles, reuse a Google identity, or map the dev parent into delivery families solely to enable reading. The parent has no class scope and may read published public articles; restricted articles still require actual central class memberships.

The Parent cannot access the admin panel, edit articles, publish newsletters, or mutate data/media through direct APIs. The same server policy applies to synthetic and Google identities. The 2026-09-06 parent-controlled Dia run verified one-click Admin dashboard access, one-click Parent return to the exact protected article path/query, no Parent edit/admin menu controls, and redirection away from `/admin`; the separate live API probe verified Parent write/admin denials as HTTP 403. A successful dev login is not email subscription consent and creates no delivery enrollment. Local review uses only `cms_browser_synthetic`, with the worker stopped and Kit configured to local capture.

## Server action policy

Shared policy is `packages/shared/src/cmsPermissions.ts`. Unknown actions and unknown roles grant nothing. Admin manages CMS content, publish and delivery. Teacher edits text only when every class targeted by an article is in live teacher scope; parent scope never grants writes. Dual teacher/parent roles union read scopes. Parents read published content in their live parent scope. Deleted articles and empty restricted scopes are hidden. Auth currently admits adults, not student identities; the student compatibility role grants no restricted read/write authority.

- `GET /api/auth/session`: live identity and effective roles/scopes.
- `GET/PATCH /api/cms/articles/:id`: read or edit after server policy; PATCH accepts only title, summary, content and author strings. Actor is derived from the token. Privileged metadata uses admin composition workflows.
- `/api/reader/weeks`, `/api/reader/weeks/:id`, `/api/reader/articles/:id`: backend-owned published/class-filtered reading.
- `/api/data/query`: admin-only compatibility surface with explicit table restrictions; cannot mutate identities, article/publication state or delivery history. Query filter operators are validated before dispatch.
- `/api/admin/rpc`: admin-only explicit method allowlist; private helpers, role-management mutations, plain publish and worker/provider send methods are denied.
- Local user-management controls are disabled and direct operators to SMZ Auth. Remaining local family/student/class tools edit delivery business records, not central directory access.

A permission-denied operation returns 403 without logging out an otherwise admitted user. Invalid token returns 401. Central revoked admission returns 403 with `access_revoked`; the frontend clears local credentials on those authentication failures. Directory timeout/network/5xx returns 503 and stops protected work; it never substitutes stale roles. Callback retry retains the consumed OIDC result in memory and retries CMS session resolution while preserving its safe intended URL. Browser reload after a consumed callback may require a fresh sign-in.

## Global logout across linked applications

CMS Sign Out clears its local session and navigates to the configured Auth origin at `/logout-all/email-cms`. It does not use a caller-supplied return URL or the former client-only OIDC signout redirect. Auth revokes the current browser's central session and its cross-client access/refresh grants before bounded front-channel cleanup, then returns only to the registered CMS `/login` URL. This does not sign out unrelated devices or the upstream Google account.

Register CMS `metadata.frontChannelLogoutUri` as `http://localhost:5174/logout/local`. This unguarded route skips session hydration, requires an iframe from the configured Auth origin (verified against `document.referrer`) and a UUID `logout_state`, then clears the local OIDC/user/role/bearer state. It acknowledges `{type: 'smz:logout-complete', state}` only to the configured Auth origin. It never follows a caller return parameter. Auth validates the acknowledgment's origin, frame source and one-time state. Unreachable client cleanup cannot undo central revocation; Auth owns the bounded timeout and incomplete-cleanup reporting.

The CMS cleanup route's response must permit framing by the configured Auth origin only: `Content-Security-Policy: frame-ancestors http://localhost:3000` locally, without `X-Frame-Options: SAMEORIGIN` on that route. Vite dev and preview apply this scoped header; a deployed static host must preserve the equivalent response policy. Auth sends `Referrer-Policy: origin` on the coordinator so the iframe can verify its parent without receiving query details.

CMS broadcasts same-origin logout and writes a durable localStorage marker. Every CMS tab checks that marker on initialization, focus, visibility and page restoration; active visible sessions also revalidate every 15 seconds. Bearer tokens now use per-tab sessionStorage, matching the OIDC user store; the legacy shared bearer is removed. Confirmed backend 401 or revoked-session 403 clears state. Epoch and marker checks discard session/refresh results that complete after logout, including delayed OIDC user-loaded events. Ordinary permission 403 does not log out an admitted user. Server authorization remains live on every protected request, including when a tab was suspended or iframe cleanup could not run. The 2026-09-06 Dia run verified CMS-initiated and App-B-initiated logout: all linked applications became unauthenticated, existing CMS admin tabs redirected to login on focus without reloading, and fresh sign-in worked after the previous logout. The same-task live API probe separately confirmed CMS session 200 before logout and 403 afterward, plus access/refresh rejection across all three applications.

## Publish, prepare and deliver

Dashboard Publish opens the newsletter management page for readiness and audience review. Confirmed `POST /api/admin/newsletters/:id/publish-and-deliver` locks the newsletter, requires a non-template draft and successful readiness/audience resolution, then publishes and creates recipient snapshot, batch and queued job in one PostgreSQL transaction. Repeated publication returns 409. Failure rolls back all these writes. Audience is all eligible families unless explicitly narrowed.

Eligibility requires active family, active enrollment and `newsletter_subscription_status = subscribed`. Pending/absent/unsubscribed/bounced/complained are excluded. Never backfill consent from admission or enrollment. Existing data may therefore yield zero eligible recipients; that is an accurate outcome.

`NewsletterDeliveryWorker` claims queued jobs and calls `processQueuedBatch`. Actual preparation renders personalized HTML and validates pinned newsletter/template revision references. Only ready recipients reach `sendPreparedBatchViaKit` -> `backendEmailPlatformService.sendNewsletter` -> `KitAdapter.createBroadcast`; the provider boundary is Kit API, not SMTP. Recipient fields contain final CMS HTML and the batch tag selects the campaign audience. Local batch/recipient/job history remains authoritative. Fallback email summaries now include escaped HTTP(S) article links.

Kit callbacks use `/api/webhooks/kit` and configured shared-secret verification, event deduplication and lifecycle reconciliation. Tracking tokens correlate email events; they never authenticate the reader. Protected article URLs preserve intended route/query through OIDC, the callback, and reader initialization. Admin sign-in without an explicit destination opens the dashboard; authenticated readers without a published newsletter see an empty state. Resend remains a proposal in the saved checkout; no Resend SDK/provider cutover, Svix handler, deployment or real email was introduced.

## Validation limits and unresolved work

See [validation and documentation review](OWNERSHIP_REVIEW.md) for the final evidence. The Dia run now provides real Google and isolated PostgreSQL evidence plus local Kit API capture. Capture acknowledgments are not proof of real provider delivery or actual email receipt. The inherited Postgres migration has hundreds of TypeScript build errors; those block a production-build readiness claim and are compared with commit b9689c7. Do not treat old completion percentages as current validation.

Remaining implementation limits include immutable content snapshots versus revision mismatch detection, durable recovery after a crash during provider handoff, broader database migration verification, residual legacy editor/data clients, full analytics write APIs after gateway restriction, and reconciliation of central relationships with local delivery records. Those need scoped follow-up specifications/tests before claiming full launch readiness. This change does not implement a broad new permission-management UI or the Resend proposal. No production registration, data mutation, deployment or real send was performed.
