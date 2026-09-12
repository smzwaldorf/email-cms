# Persistent session verification

Verified locally on 2026-09-13. Implementation is saved in the CMS and SMZ Auth checkouts; it is not yet committed or deployed.

- Frontend: 17 selected test files, 130 passing tests covering authentication, cookie API requests, draft recovery and affected editors. React test act warnings remain non-fatal.
- CMS backend: all 154 selected regression tests passed across the initial run and a rerun of socket-dependent tests with local listener permission. Includes encrypted storage, CSRF, concurrent renewal, logout races and protected table boundaries.
- Auth: 20 unit tests and 20 integration tests passed; malformed credentials, central expiry, logout and the confidential CMS client are covered.
- CMS full build, production Pages build with server-session mode, Cloudflare typecheck/dry-run, configuration test and Auth build/typecheck/dry-run passed.
- Real isolated PostgreSQL and local HTTP OIDC verification passed, including code/PKCE exchange, six concurrent renewals, recovery from a lost refresh response, Identity outage/recovery, central expiry, CSRF rejection and explicit logout. The additive session migration was applied twice successfully.
- Interactive local browser checks confirmed preserved identity after an outage and reload, automatic dashboard recovery without another login or reload, session restoration in a new tab and explicit logout. This used synthetic local identities; it does not establish production Google login readiness.

The saved CMS implementation matches the source used for final validation. Local fixture servers and their isolated PostgreSQL instance were stopped afterward. Existing production data and the shared PlanetScale cluster were not changed.

Production release still requires `CMS_SESSION_SECRET` in the GitHub production environment of `smzwaldorf/email-cms`, and `CMS_OIDC_CLIENT_SECRET` in the production environments of both `smzwaldorf/email-cms` and `smzwaldorf/auth`. Automatic approval review rejected provisioning these secrets because it requires explicit authorization for those destinations; no secrets were uploaded. After approval, release through the existing commit-triggered CI pipelines, then verify production login, renewal, outage handling and logout.

Users entering the new server-session flow must sign in once to establish the HttpOnly cookie. Expired credentials thereafter preserve remembered identity and drafts but may require explicit reauthentication before protected actions resume. Confirmed revocation and explicit logout still remove identity.
