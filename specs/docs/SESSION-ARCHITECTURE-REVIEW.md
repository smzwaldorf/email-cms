# Persistent identity and session architecture review

Reviewed 2026-09-12 against CMS `b852295` and SMZ Auth `6fd82cc`. This is an architecture audit and implementation contract, not a deployed change. The previous CMS session patch keeps an already-mounted page open; it does not yet satisfy persistent identity across the whole lifecycle.

## Required product behavior

Remember the signed-in person across access-token expiry, idle time, mobile suspension, reloads, and temporary Identity failures. Renew authorization silently when possible. A temporary inability to authorize must not erase identity, redirect to login, destroy an editor, or discard a draft. Explicit logout and confirmed revocation still terminate authenticated access. Clearing browser data or a genuinely unusable credential can require authentication again; remember the person and preserve work without claiming that remembered identity grants permissions.

Identity continuity is distinct from valid authorization. No architecture can guarantee new authorized operations during an Identity outage while also guaranteeing immediate central revocation enforcement. Retain identity and drafts during that interval, clearly show reconnecting status, and resume protected work after verification.

## Current flow

1. Pages runs a public OIDC client using Authorization Code + PKCE and `offline_access`.
2. `smzAuth.ts` stores the complete OIDC user in per-tab sessionStorage. `backendClient.ts` stores another bearer copy there. `tokenManager.ts` maintains a third in-memory copy.
3. `authService.ts` establishes the CMS user through `/api/auth/session`; AuthContext and protected routes use the in-memory user.
4. Most data requests use `backendApi.ts` and the stored bearer directly, bypassing TokenManager's renewal-aware getter.
5. Every protected CMS request calls Identity UserInfo and live directory access-context concurrently through the `SMZ_AUTH` service binding. Each call has a five-second timeout.
6. Identity verifies the token, checks the central session and current admission/roles in PostgreSQL. Both services use the existing PlanetScale cluster through Hyperdrive.
7. Explicit logout deletes central grants/session and coordinates local cleanup across applications. CMS epochs and a durable logout marker reject late results.

## Verified gaps

| Priority | Finding | Consequence and evidence |
| --- | --- | --- |
| High | Startup invalidates the stored OIDC session if an expired token cannot be refreshed. Startup backend failure also rejects the cached initialization promise before monitoring is installed. | A temporary outage on reload can appear as logout and leave automatic recovery disabled. `apps/frontend/src/services/authService.ts`, `initialize`; `apps/frontend/src/context/AuthContext.tsx`, initialization effect. |
| High | Every refresh failure clears the bearer, including a proactive refresh with a still-valid token. | Network failure unnecessarily removes usable authorization and makes data requests fail locally. Reproduced by audit test 1. `tokenManager.ts`, `performRefresh`. |
| High | `setAccessToken` increments the same epoch used to cancel refresh results. | oidc-client-ts raises `userLoaded` before `signinSilent` resolves. On a restored session the AuthService handler can set the new token, increment the epoch, and cause the successful refresh to return false. Reproduced by audit test 2. A completed callback promise also suppresses userLoaded processing indefinitely in that tab, making behavior depend on how the page was entered. |
| High | Data requests do not wait for proactive refresh or transparently recover the triggering 401. | The expiry event may start background renewal, but the original request still throws and the screen can retain its error after renewal. `backendApi.ts`, `backendClient.ts`. |
| High | Central session and refresh-grant lifetimes do not align. | Auth config sets access tokens to 15 minutes and refresh tokens to 30 days, but does not override Better Auth's seven-day session default. The installed refresh-grant handler carries the existing sessionId into new tokens; it does not renew that central session in the inspected path. Directory `hasLiveSession` requires a future session expiry, so continuing to rotate tokens does not by itself keep authorization alive. |
| High | Expired or missing central sessions are returned as `403 access_revoked`. | CMS clears local identity on this status even if the cause was time expiry, rather than a deliberate revocation. Auth `global-logout.ts`, `hasLiveSession`; `app.ts`, directory route; CMS `auth.ts`, `verifySmzAccessToken`. |
| High | Identity's directory route catches database/dependency failures in the same block as invalid JWTs and returns 401. CMS interprets any upstream 403 as admission revocation. | Infrastructure failure can trigger pointless refresh; status alone is insufficient to establish deliberate revocation. Error codes must remain typed across the boundary. Auth `app.ts` directory catch; CMS `auth.ts`. |
| Medium | Per-tab sessionStorage is the sole durable browser credential source. | Reload normally retains it, but new tabs/browser closure do not provide reliable persistent sign-in. There is no CMS server session to recover. Moving refresh tokens to localStorage would add shared-token rotation races and would not fix the central lifecycle. |
| Medium | Auth availability is required for every protected request, with two upstream calls per request and visible-page polling every 15 seconds. | Temporary upstream failure blocks the dashboard. CMS's five-second deadline can expire before Auth's ten-second database connection timeout. This is a latency/failure classification issue, not evidence that the photographed incident was specifically connection exhaustion. |
| Medium | Multiple error surfaces and a single renewal-required notice do not distinguish reconnecting from reauthentication. | The same upstream error appears twice in the supplied screenshot. Successful auth renewal does not centrally invalidate failed data queries. |
| Medium | Existing deployment smoke checks do not exercise an authenticated token refresh or session continuity. | Green CI and health checks cannot establish the requested behavior. `scripts/cloudflare-smoke.mjs` explicitly documents that authenticated checks are separate. |

Auth source evidence: `packages/auth-server/src/auth-factory.ts`, `app.ts`, `global-logout.ts`, and `db/database.ts` in the sibling smz-auth repository. Installed Better Auth context confirms seven-day expiry and one-day update age; the [official session documentation](https://better-auth.com/docs/concepts/session-management) describes these defaults. Installed oidc-client-ts `_useRefreshToken` stores the user and raises its load event before returning. Library behavior was checked against the installed release dependencies rather than inferred from current documentation alone.

The actual screenshot request has not been correlated with production logs. Its CMS error indicates an Identity transport exception, timeout, or upstream 5xx. The findings above explain architectural failure modes; they do not establish which specific upstream request failed on that phone.

## Target architecture

Use a same-origin CMS backend session, with Pages continuing to serve the UI and the Worker owning login/callback/session/API operations.

- Route the browser's `/api/*` and backend authentication endpoints through a Pages Function/service binding or an equivalent same-origin Worker route. Do not depend on a cross-site cookie between pages.dev and workers.dev or a hidden third-party Identity iframe.
- Browser holds a persistent, Secure, HttpOnly, SameSite=Lax, host-only opaque CMS session cookie. Keep OAuth access/refresh tokens encrypted in CMS PostgreSQL, not in browser storage. Use the existing smz-cms database and cluster; no additional paid database is required by this design.
- Store a hash of the opaque session identifier, issuer/subject, central grant/session reference, encrypted token material and expiry, generation/version, revocation state, and last successful verification. A retained identity record is not a cached grant of roles.
- Make expiry of an access token change credential state, not delete the CMS identity session. A refresh-grant expiry or terminal invalid_grant changes state to reauthentication-required; retain the remembered identity and saved drafts, and restore authority only after verified authentication. Cookie/session retention must be an explicit product policy, separate from OAuth lifetimes.
- One renewal owner on the server. Serialize rotation per session across Worker instances using database coordination and compare-and-swap; a process-local Promise alone is insufficient. Bound leases and account for crashed workers, token rotation response loss and any provider-supported replay window. Do not hold scarce PostgreSQL connections open across long Identity calls.
- Coordinate Auth's central session/grant lifetime with active application use. Extend a still-live session on verified eligible renewal under an explicit rolling policy, or introduce a separately revocable durable grant family. Never resurrect a deleted/revoked session merely because a refresh token exists. Existing sessions and global logout must migrate together; increasing refresh TTL alone is insufficient.
- Protect cookie-based mutations with origin checks and CSRF defenses; keep state/nonce/PKCE and exact callback registration. Register a separate confidential CMS client for the server flow so migration does not silently change the public client's token contract. Drain the old client under a documented transition and remove its browser tokens only after successful exchange or explicit logout.
- Retain direct Worker service binding and live authorization for protected operations. Do not cache stale admin permissions as an outage workaround. Reduce duplicate verification only through a defined verified identity/access-context contract preserving issuer, audience, client and subject binding.
- Provide safe structured diagnostics: request correlation ID, upstream endpoint name, error class, status and duration. Never log credentials, authorization headers, callback codes or token bodies. Map infrastructure errors to retryable 503, not invalid_token.
- Persist editor drafts independently, scoped to the verified person's stable identity. Never replay writes automatically after an ambiguous network failure; the write may have committed. Refresh then retry only an explicit authentication rejection guaranteed to occur before the handler, or use idempotency keys.

The sibling Auth App B is not a drop-in implementation of this target. The inspected current checkout uses encrypted cookie chunks with a one-hour fixed expiry; it is not the durable server-side session described in older project notes.

## Shared state/error contract

| State/event | Identity and UI | Protected operations |
| --- | --- | --- |
| Active | Display verified identity; page remains mounted | Proceed after current server authorization |
| Access token nearing/at expiry | Same identity; silently renew | Wait for single renewal; retry an auth-rejected request once |
| Offline, timeout, Identity/DB 5xx | Retain identity and drafts; show one reconnecting status | Fail closed with retryable error; backoff and recover on online/focus |
| Recovery | Clear reconnecting state, preserve route/editor | Revalidate and refetch failed reads without a full reload |
| Expired/unusable refresh grant | Retain remembered identity and drafts; explicit reauthentication action | Block until new verified credentials, no automatic navigation |
| Ordinary permission denial | Keep the user signed in | Deny only the requested action |
| Confirmed app/person/session revocation | Remove authenticated authority and sensitive in-memory data; explain access ended | Reject; prevent pending refresh/callback from restoring access |
| Explicit local/global logout | Clear browser session and revoke server session/grants | Reject; invalidate other tabs and late results |

Frontend state must distinguish `identity` from `authorizationStatus`. A nullable user and `isAuthenticated = user !== null` cannot express this contract. Route guards should preserve the mounted workspace for reconnecting/reauthentication states without presenting remembered roles as current authorization.

## Implementation sequence and release gates

1. Establish typed Auth error semantics and central rolling-session/grant policy, preserving explicit revocation. Add real PostgreSQL tests with controlled time for expired versus deleted sessions and concurrent refresh/logout.
2. Add CMS durable session schema, encrypted token storage, same-origin routing, confidential client registration and server renewal. Test cookie/CSRF boundaries, callback replay protection, rotation races, recovery after crash and explicit logout. Use the existing shared cluster; measure request fan-out and database contention.
3. Replace the three browser token copies with the server session client and explicit frontend state machine. Add retryable reconnecting behavior and draft persistence. Correct startup recovery and await renewal before protected calls during the transition.
4. Reconcile current session/auth contracts and mark historical timeout/logout documents superseded. The existing SESSION-BEHAVIOR.md describes only the shipped partial patch; SMZ_AUTH_CMS_CONTRACT.md still contains outdated statements that a confirmed 401 clears state.
5. Validate the full workflow before committing for production deployment: real Google sign-in, 15-minute token boundary using controlled test lifetimes, central expiry boundary, concurrent tabs, Safari suspension/resume, reload and browser reopen, dropped refresh response, Identity outage/recovery, permission downgrade, explicit CMS/global logout and logout racing refresh. Check API outcomes and retained unsaved work, not just rendered identity.

## Audit validation

Two executable contract probes against the current TokenManager both failed, reproducing still-valid token loss on network failure and false refresh failure after userLoaded synchronization. Fixtures are synthetic and no production credentials were inspected. The source and output are retained in `session-architecture-evidence/`; the test source has a .txt suffix so intentionally failing audit probes are not added to CI. These are findings, not completed fixes.

No production configuration, session lifetime, registration, schema, role or deployment was changed by this review. Production health checks from the preceding investigation returned success but did not test the affected authenticated request. The implementation and full end-to-end gates above remain outstanding.
