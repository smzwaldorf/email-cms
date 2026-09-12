# Persistent CMS sessions

Implements SESSION-ARCHITECTURE-REVIEW.md; existing unrelated changes remain preserved.

- [x] Backend encrypted session/flow storage, cookie/CSRF, OIDC login and renewal, and logout
- [x] Same-origin Pages routing and production configuration
- [x] Frontend identity/reconnection state, no browser credentials, reload recovery
- [x] Identity lifetime/error contract and confidential client admission mapping
- [x] Additive migration and local cross-service PostgreSQL verification
- [x] Automated lifecycle/security regression tests and builds
- [x] Local browser verification of reload, outage recovery, new tabs and logout
- [ ] Production secret provisioning, commit-triggered deployment and production verification

Local implementation verified on 2026-09-13. No production migration or deployment has run for this change. Automatic approval review blocked uploading new production secrets until the user explicitly authorizes the GitHub production environment destinations. See [verification evidence](SESSION-VERIFICATION.md).
