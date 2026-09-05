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

## Server action policy

Shared policy is `packages/shared/src/cmsPermissions.ts`. Unknown actions and unknown roles grant nothing. Admin manages CMS content, publish and delivery. Teacher edits text only when every class targeted by an article is in live teacher scope; parent scope never grants writes. Dual teacher/parent roles union read scopes. Parents read published content in their live parent scope. Deleted articles and empty restricted scopes are hidden. Auth currently admits adults, not student identities; the student compatibility role grants no restricted read/write authority.

- `GET /api/auth/session`: live identity and effective roles/scopes.
- `GET/PATCH /api/cms/articles/:id`: read or edit after server policy; PATCH accepts only title, summary, content and author strings. Actor is derived from the token. Privileged metadata uses admin composition workflows.
- `/api/reader/weeks`, `/api/reader/weeks/:id`, `/api/reader/articles/:id`: backend-owned published/class-filtered reading.
- `/api/data/query`: admin-only compatibility surface with explicit table restrictions; cannot mutate identities, article/publication state or delivery history. Query filter operators are validated before dispatch.
- `/api/admin/rpc`: admin-only explicit method allowlist; private helpers, role-management mutations, plain publish and worker/provider send methods are denied.
- Local user-management controls are disabled and direct operators to SMZ Auth. Remaining local family/student/class tools edit delivery business records, not central directory access.

A permission-denied operation returns 403 without logging out an otherwise admitted user. Invalid token returns 401. Central revoked admission returns 403 with `access_revoked`; the frontend clears local credentials on those authentication failures. Directory timeout/network/5xx returns 503 and stops protected work; it never substitutes stale roles. Callback retry retains the consumed OIDC result in memory and retries CMS session resolution while preserving its safe intended URL. Browser reload after a consumed callback may require a fresh sign-in.

## Publish, prepare and deliver

Dashboard Publish opens the newsletter management page for readiness and audience review. Confirmed `POST /api/admin/newsletters/:id/publish-and-deliver` locks the newsletter, requires a non-template draft and successful readiness/audience resolution, then publishes and creates recipient snapshot, batch and queued job in one PostgreSQL transaction. Repeated publication returns 409. Failure rolls back all these writes. Audience is all eligible families unless explicitly narrowed.

Eligibility requires active family, active enrollment and `newsletter_subscription_status = subscribed`. Pending/absent/unsubscribed/bounced/complained are excluded. Never backfill consent from admission or enrollment. Existing data may therefore yield zero eligible recipients; that is an accurate outcome.

`NewsletterDeliveryWorker` claims queued jobs and calls `processQueuedBatch`. Actual preparation renders personalized HTML and validates pinned newsletter/template revision references. Only ready recipients reach `sendPreparedBatchViaKit` -> `backendEmailPlatformService.sendNewsletter` -> `KitAdapter.createBroadcast`; the provider boundary is Kit API, not SMTP. Recipient fields contain final CMS HTML and the batch tag selects the campaign audience. Local batch/recipient/job history remains authoritative. Fallback email summaries now include escaped HTTP(S) article links.

Kit callbacks use `/api/webhooks/kit` and configured shared-secret verification, event deduplication and lifecycle reconciliation. Tracking tokens correlate email events; they never authenticate the reader. Protected article URLs preserve intended route/query through OIDC, the callback, and reader initialization. Admin sign-in without an explicit destination opens the dashboard; authenticated readers without a published newsletter see an empty state. Resend remains a proposal in the saved checkout; no Resend SDK/provider cutover, Svix handler, deployment or real email was introduced.

## Validation limits and unresolved work

See [validation and documentation review](OWNERSHIP_REVIEW.md) for the final evidence. The Dia run now provides real Google and isolated PostgreSQL evidence plus local Kit API capture. Capture acknowledgments are not proof of real provider delivery or actual email receipt. The inherited Postgres migration has hundreds of TypeScript build errors; those block a production-build readiness claim and are compared with commit b9689c7. Do not treat old completion percentages as current validation.

Remaining implementation limits include immutable content snapshots versus revision mismatch detection, durable recovery after a crash during provider handoff, broader database migration verification, residual legacy editor/data clients, full analytics write APIs after gateway restriction, and reconciliation of central relationships with local delivery records. Those need scoped follow-up specifications/tests before claiming full launch readiness. This change does not implement a broad new permission-management UI or the Resend proposal. No production registration, data mutation, deployment or real send was performed.
