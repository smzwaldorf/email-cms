# Cloudflare R2 article media

The CMS stores private images and audio in R2 and stores their metadata in PostgreSQL. The backend generates object keys and identifies the uploader from the authenticated CMS session. Browser credentials never include an R2 API key.

| Runtime | R2 bucket | Object prefix |
| --- | --- | --- |
| Node development | `smz-cms-media-dev-staging` | `development/` |
| Staging Worker | `smz-cms-media-dev-staging` | `staging/` |
| Production Worker | `smz-cms-media-production` | `production/` |

Production and development/staging cannot use each other's configured buckets. Prefixes distinguish development and staging objects in the shared bucket. They do not create a security boundary between clients granted access to that shared bucket. The underlying buckets have no public R2 domain or `r2.dev` access. Dedicated Worker domains expose only explicitly approved assets. The R2 storage provider is recorded as `s3`, the existing database enum for S3-compatible object storage; `storage_bucket` and `storage_environment` record the R2 destination explicitly.

## Cloud setup

The school account is `f1b69ad88454573ccaa3364b628fd114`. On 2026-10-07 the dashboard showed R2 active, and both requested buckets were created there: `smz-cms-media-dev-staging` and `smz-cms-media-production`. Both were verified as Standard storage, empty (0 B), with public access disabled. The API Worker, media custom domains and cloud database migrations have not been deployed by this bucket-provisioning step. Standard storage's monthly free tier and usage rates are described in https://developers.cloudflare.com/r2/pricing/.

For CLI uploads or Worker deployment, authenticate Wrangler to the school account with access to R2 and Worker development bindings. The local Wrangler token was expired at provisioning time, so creation and verification used the existing authenticated school-account dashboard. Do not provision buckets in another account.

```sh
node scripts/cloudflare-media-storage.mjs --plan
node scripts/cloudflare-media-storage.mjs --apply
```

The setup preserves existing buckets and verifies both names. It does not activate subscriptions, modify public access, deploy code, or upload content.

## Media origin deployment status

On 2026-10-08 both dedicated media Workers were deployed to the school account with `workers_dev` and preview URLs disabled:

| Environment | Worker | Custom domain | Hyperdrive | Version |
| --- | --- | --- | --- | --- |
| Staging | `staging-smz-news-media` | `staging-media.smzwaldorf.com` | `686ed1534b77435eb5537fabba62e61c` (`smz-cms`) | `b91310b9-19bb-476b-b38b-4720bbeadc39` |
| Production | `production-smz-news-media` | `media.smzwaldorf.com` | `ad9d4424db9646beb0b427aeb264e6b2` (`production-news`) | `d59d7c4b-9a51-44fc-95a5-917d9d1bc139` |

The Cloudflare API verified query caching disabled for each Hyperdrive. Public DNS resolved both domains, HTTPS certificate validation passed, and both origins returned uncached 404 responses for the bare root, a nonexistent media ID and an upload POST. The nonexistent media request also exercised each environment's database lookup. No approved asset bytes were uploaded as part of this domain setup. The CMS application, cloud media schema migrations and authenticated upload UI have not been deployed by this domain-connection step; the media origin treats legacy records without approval fields as restricted.

## Node development

Apply both `db/migrations/20261007_r2_article_media.sql` and `db/migrations/20261007_email_media_serving.sql` through the reviewed migration runner. Preserve an existing `.env.local` and add the following backend settings after cloud activation and authentication:

```dotenv
MEDIA_STORAGE_ENVIRONMENT=development
MEDIA_R2_BUCKET=smz-cms-media-dev-staging
MEDIA_API_ORIGIN=http://localhost:8787
VITE_STORAGE_PROVIDER=r2
```

Set a private `MEDIA_SIGNING_SECRET` of at least 32 characters, or use the existing backend `JWT_SECRET` if it meets that requirement. Never prefix this secret with `VITE_`. Then restart the backend with `npm run backend:dev`. `config/r2-development.jsonc` uses a remote binding through Wrangler's `getPlatformProxy`, so uploaded objects are actually stored in the shared R2 bucket rather than an in-memory adapter. The existing PostgreSQL connection is preserved.

## Staging and production

The deployment configuration generator accepts `CMS_DEPLOY_ENVIRONMENT=staging` or `production` (default). Use the intended environment's Cloudflare account, Hyperdrive ID, CMS origins and Auth issuer when generating configuration with `npm run cloudflare:configure`. The staging Worker is `smz-cms-api-staging`, its Pages project is `smz-cms-staging`, and scheduled delivery is disabled. Configure the staging database and exact OIDC registration before deploying a staging app. Bucket setup alone does not provision a staging application or database.

Production retains the existing `smz-cms-api` Worker and `smz-cms` Pages project. Both generated configurations bind `MEDIA_BUCKET` to the appropriate private R2 bucket. Browser/media URLs use the configured CMS origin so the existing Pages API proxy serves them. Production's existing `JWT_SECRET` signs media URLs; a separate `MEDIA_SIGNING_SECRET` may be provisioned as a Worker secret if needed. The normal deployment migration list includes the R2 migration. Create both buckets before deploying code that binds them.

## Upload and article records

`POST /api/media/upload?filename=...&articleId=...` takes raw image or audio bytes. Supported images are JPEG, PNG, WebP and GIF (10 MiB maximum); supported audio is MP3, WAV, Ogg, M4A and WebM (50 MiB maximum). The backend checks CMS editor admission, article edit permission when an article ID is supplied, format signatures, actual byte count and a serialized per-owner 500 MiB quota. Client dimension/duration metadata is optional. Uploaded bytes determine the MIME type's accepted signature and storage key extension.

Successful uploads create `media_files` with canonical `storage://media/...` URI, provider, R2 bucket, environment, size, MIME type, uploader, content hash and available dimensions/duration. A known failed metadata write removes the new object. If the database loses its COMMIT acknowledgement after insertion, the object is preserved and its media ID is logged for reconciliation; a possibly committed row must not lose its bytes. A failed compensating object deletion logs its media ID for recovery. Unlinked uploads remain available in the media library; cancelling an edit does not alter references in saved content.

Saving article content reconciles `article_media_references`, `media_usage`, `usage_count` and `referenced_articles` transactionally through a database trigger. Repeated image/audio occurrences count once per article. Saved removals deactivate usage without deleting the object. Soft deletion removes active references; restore and copied content rebuild them. Missing registered storage objects reject a save and preserve earlier content/references. HTML storage attributes, TipTap JSON and Markdown storage links are recognized. Existing external URL images are preserved as external embeds; this change does not download or migrate them into R2.

Editors can request short-lived signed URLs through `GET /api/media/sign`. Readers can request a URL only for media associated with an article they may read. Playback checks signatures scoped to the media ID, bucket and environment and supports audio byte ranges. Browser links expire after five minutes and remain separate from email HTML. Signed links are bearer access until expiry.

## Permanent email access

Dedicated read-only media Workers serve the media hostnames as Cloudflare Worker Custom Domains. They have only an R2 binding and Hyperdrive database binding; they do not contain CMS upload/session routes or scheduled delivery. Production uses `https://media.smzwaldorf.com`; development/staging uses `https://staging-media.smzwaldorf.com`. Only GET/HEAD `/media/<media-id>.<extension>` is served on those hosts; CMS APIs and uploads are unavailable there. R2 remains private.

An administrator uses the media library to explicitly approve or revoke public email access, after acknowledging that **anyone with the URL can retrieve the asset without a CMS login**. This includes audio if explicitly approved. Every upload, including draft images and audio, starts restricted. Approval is per asset, independent of article visibility: a restricted article containing an approved image does not make that image private. Removing an article reference does not expire an approved email URL. Revocation intentionally stops images in previously sent emails; recipients/providers may retain copies already retrieved. Approved assets must be revoked before deletion.

`PATCH /api/media/<id>/email-access` requires an authenticated administrator and the CMS CSRF header in cookie-session mode. The JSON body is `{ "enabled": true, "acknowledgePublicAccess": true }` to approve and `{ "enabled": false }` to revoke. The approval fields and `media_email_access_events` audit entry commit together. Generic database mutations cannot change approval fields.

The public lookup treats missing approval/provenance fields in legacy metadata as unapproved, allowing a domain to be deployed safely before the additive media migration. For every public request, the Worker checks the current media record, bucket, environment, MIME extension and approval. Responses use `Cache-Control: no-store` so the Worker never bypasses revocation with a cached approval decision. No bearer token or time limit appears in permanent URLs. Both email preparation paths resolve canonical storage references to these URLs and fail if an asset lacks approval or an expiring editor link remains.

On 2026-10-08 the school dashboard verified staging Hyperdrive `686ed1534b77435eb5537fabba62e61c` targeting `smz-cms`, and production Hyperdrive `ad9d4424db9646beb0b427aeb264e6b2` targeting `production-news`. Query caching was disabled on both. Use the corresponding binding for each media Worker.

The cloud Worker must use the database containing the approved media records. Local PostgreSQL cannot be queried by Cloudflare. Development assets in the shared bucket need their metadata available in the staging database before they can load on the staging media domain; the public serving query accepts development and staging records in that database. Until a shared staging registry is configured, keep local development assets restricted and exercise permanent email access through staging. Production never queries development/staging records.

`node scripts/cloudflare-media-config.mjs` generates a dedicated `staging-smz-news-media` or `production-smz-news-media` configuration using `CMS_DEPLOY_ENVIRONMENT`, `CLOUDFLARE_ACCOUNT_ID` and the corresponding `CLOUDFLARE_HYPERDRIVE_ID`. Deploy `.wrangler/media/staging.json` or `.wrangler/media/production.json` to register the respective media Custom Domain. Verify that each Hyperdrive configuration has query caching disabled before deployment; approval and revocation checks require current database records. The CMS API configurations do not own these media domain routes. Bucket creation alone does not register DNS, deploy the Worker, or migrate the cloud database. Those remain separate setup steps after cloud approval.

## Verification

```sh
npm run build
npm run cloudflare:check
node --test scripts/cloudflare-config.test.mjs scripts/cloudflare-migrations.test.mjs
node scripts/test-r2-article-media-db.mjs
node scripts/test-r2-binding.mjs
npm run test -w @email-cms/backend -- tests/unit/services/r2Media.test.ts tests/unit/services/emailMediaRendering.test.ts tests/integration/r2-media-route.test.ts
npm run test -w @email-cms/frontend -- tests/hooks/useMediaUpload.r2.test.tsx
```

The PostgreSQL check is localhost-only and rolls back all fixtures and schema changes. HTTP tests exercise raw uploads, signed image delivery and audio seeking. These local checks do not establish that cloud provisioning or a live cloud upload succeeded.
