# Persistent session verification

Verified locally and deployed on 2026-09-13. Auth release `f9df45f` and CMS release `fdd1e34` completed their commit-triggered production pipelines.

- Frontend: 17 selected test files, 130 passing tests covering authentication, cookie API requests, draft recovery and affected editors. React test act warnings remain non-fatal.
- CMS backend: all 154 selected regression tests passed across the initial run and a rerun of socket-dependent tests with local listener permission. Includes encrypted storage, CSRF, concurrent renewal, logout races and protected table boundaries.
- Auth: 20 unit tests and 20 integration tests passed; malformed credentials, central expiry, logout and the confidential CMS client are covered.
- CMS full build, production Pages build with server-session mode, Cloudflare typecheck/dry-run, configuration test and Auth build/typecheck/dry-run passed.
- Real isolated PostgreSQL and local HTTP OIDC verification passed, including code/PKCE exchange, six concurrent renewals, recovery from a lost refresh response, Identity outage/recovery, central expiry, CSRF rejection and explicit logout. The additive session migration was applied twice successfully.
- Interactive local browser checks confirmed preserved identity after an outage and reload, automatic dashboard recovery without another login or reload, session restoration in a new tab and explicit logout. This used synthetic local identities; it does not establish production Google login readiness.

The saved CMS implementation matches the source used for final validation. Local fixture servers and their isolated PostgreSQL instance were stopped afterward. The local verification did not change production data or the shared PlanetScale cluster. The subsequent production release applied only the additive session schema and Auth client registration; it did not import newsletter data or provision another cluster.

Production secrets were provisioned after the user explicitly approved deployment in response to the secret-destination authorization question. `CMS_SESSION_SECRET` is stored in the GitHub production environment of `smzwaldorf/email-cms`; the shared `CMS_OIDC_CLIENT_SECRET` is stored in both repositories' production environments.

- [Auth production pipeline](https://github.com/smzwaldorf/auth/actions/runs/34706892358): passed validation, migrations, client registration, Worker deployment and smoke checks.
- [CMS production pipeline](https://github.com/smzwaldorf/email-cms/actions/runs/34707476873): passed validation, additive session migration, Worker and Pages deployment, and smoke checks. Two earlier attempts stopped at Pages configuration validation; the final config uses the standard filename in its working directory and inherits the account from CI. Wrangler Pages config validation now runs before production mutations.
- Live Worker health returned HTTP 200 with `database: connected`. Pages `/api/session/current` returned the expected signed-out JSON for an unauthenticated request; protected API access returned 401 and cross-origin login returned 403.
- Browser sign-in through production SMZ Identity succeeded and loaded the admin dashboard with all five newsletters. Reload and a new tab both restored the authorized dashboard and its data without another sign-in.
- No artificial production outage, forced credential expiry or global logout was performed. Those lifecycle cases are covered by local cross-service and regression tests above; natural long-duration production renewal remains unobserved at release time.

Users entering the new server-session flow must sign in once to establish the HttpOnly cookie. Expired credentials thereafter preserve remembered identity and drafts but may require explicit reauthentication before protected actions resume. Confirmed revocation and explicit logout still remove identity.

## Subsequent updates

CMS `d876ca3` changed the default login destination for every role to the newsletter front page while preserving explicit safe return links. [CI passed](https://github.com/smzwaldorf/email-cms/actions/runs/34727389222); production browser login and root navigation reached the newsletter.

On September 14 the local database connection was repaired by selecting existing CMS port `55440` instead of another project on `55432`, and allowing frontend origin `5173`. The password and data were unchanged; a fresh local login loaded newsletter content. This was a local configuration repair, not a production deployment. See [runtime environments](RUNTIME-ENVIRONMENTS.md).
