# Production News deployment

Manual workflow: **Deploy production News**, from `main` only. It deploys `production-smz-news-api` and Pages `production-smz-news`, binding only to `production-smz-auth`. Main pushes continue deploying staging.

Provision an empty `production-news` logical database in the existing PlanetScale `smzwaldorf/main` cluster, with a restricted dedicated role and uncached Hyperdrive connector `production-smz-news`. Production checks reject the staging `smz-cms` database before initialization or migration. Production contains no demo seed content.

Configure the existing GitHub environment `production` with:

- Variable `PRODUCTION_NEWS_HYPERDRIVE_ID`
- Secret `PRODUCTION_CMS_SESSION_SECRET`: 64 random hexadecimal characters
- Secret `PRODUCTION_JWT_SECRET`: independent random value, at least 32 characters
- Secret `PRODUCTION_CMS_OIDC_CLIENT_SECRET`: same production-only value as Auth
- Variable `PRODUCTION_AUTH_REGISTRATION_VERIFIED=true` only after verifying exact production OAuth registration

Existing Cloudflare and Resend credentials are reused. Outbound delivery is disabled for the initial rollout. Enable it only after reviewing production recipients and validating the email configuration. No email is sent by deployment.

Run the manual workflow with `initialize_database=true` only on the first empty-database deployment. Subsequent runs leave it false. Initialization refuses a database with existing public tables.

The Worker maps `news-api.smzwaldorf.com`. After the production Pages deployment passes verification, move `news.smzwaldorf.com` from the staging Pages project to the production Pages project and update its DNS target. Keep `staging-news.smzwaldorf.com` on staging. Until that cutover, the public hostname still serves staging and the workflow's frontend smoke test is not proof of production routing.

Create a distinct production Resend webhook and signing secret before enabling delivery; preserve the existing staging webhook. Verify authenticated login, empty admin content, reader behavior, logout, and that staging still works after cutover.
