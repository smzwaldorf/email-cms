import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
export function configuration(env) {
  for (const key of ['CLOUDFLARE_ACCOUNT_ID', 'CLOUDFLARE_HYPERDRIVE_ID']) {
    if (!/^[a-f0-9]{32}$/.test(env[key] ?? '') || /^0+$/.test(env[key])) throw new Error(`Missing or invalid ${key}`)
  }
  for (const key of ['CMS_ORIGIN', 'CMS_API_ORIGIN', 'SMZ_AUTH_ISSUER']) {
    const url = new URL(env[key])
    if (url.protocol !== 'https:' || url.username || url.password || /(^|\.)(localhost|example\.(com|org|test))$/.test(url.hostname)) throw new Error(`Invalid ${key}`)
    if (key !== 'SMZ_AUTH_ISSUER' && url.origin !== env[key]) throw new Error(`${key} must be an origin`)
  }
  if (!env.SMZ_AUTH_ISSUER.endsWith('/api/auth')) throw new Error('Invalid issuer path')
  const environment = env.CMS_DEPLOY_ENVIRONMENT || 'production'
  if (!['staging', 'production'].includes(environment)) throw new Error('Invalid CMS_DEPLOY_ENVIRONMENT')
  const mediaBucket = environment === 'production' ? 'smz-cms-media-production' : 'smz-cms-media-dev-staging'
  const serviceName = environment === 'production' ? 'smz-cms-api' : 'smz-cms-api-staging'
  const demoMode = env.NEWSLETTER_DEMO_MODE || 'false'
  if (!['true', 'false'].includes(demoMode)) throw new Error('Invalid NEWSLETTER_DEMO_MODE')
  const recipients = (env.NEWSLETTER_TEST_RECIPIENTS ?? '').split(',').map(value => value.trim().toLowerCase()).filter(Boolean)
  if (recipients.some(value => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value))) throw new Error('Invalid NEWSLETTER_TEST_RECIPIENTS')
  if (demoMode === 'true' && recipients.length !== 2) throw new Error('Demo deployment requires exactly two NEWSLETTER_TEST_RECIPIENTS')
  if (new Set(recipients).size !== recipients.length) throw new Error('Duplicate demo recipients')
  const root = fileURLToPath(new URL('../', import.meta.url))
  return {
    name: serviceName, main: path.join(root, 'apps/backend/src/cloudflare/worker.ts'),
    account_id: env.CLOUDFLARE_ACCOUNT_ID, compatibility_date: '2026-09-12',
    compatibility_flags: ['nodejs_compat', 'enable_nodejs_http_server_modules'],
    workers_dev: true, preview_urls: false, observability: { enabled: true },
    alias: { '@email-cms/shared': path.join(root, 'packages/shared/src/index.ts') },
    services: [{ binding: 'SMZ_AUTH', service: 'smz-auth' }],
    r2_buckets: [{ binding: 'MEDIA_BUCKET', bucket_name: mediaBucket }],
    hyperdrive: [{ binding: 'HYPERDRIVE', id: env.CLOUDFLARE_HYPERDRIVE_ID }],
    vars: { MEDIA_STORAGE_ENVIRONMENT: environment, MEDIA_R2_BUCKET: mediaBucket, MEDIA_API_ORIGIN: env.CMS_ORIGIN, CMS_SESSION_ENABLED: 'true', APP_URL: env.CMS_ORIGIN, BACKEND_CORS_ORIGIN: env.CMS_ORIGIN, SMZ_AUTH_ISSUER: env.SMZ_AUTH_ISSUER, DELIVERY_ENABLED: environment === 'production' ? 'true' : 'false', NEWSLETTER_DEMO_MODE: demoMode, ...(recipients.length ? { NEWSLETTER_TEST_RECIPIENTS: recipients.join(',') } : {}) },
    triggers: { crons: environment === 'production' ? ['* * * * *'] : [] },
  }
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const config = configuration(process.env)
  await mkdir(new URL('../.wrangler/deploy/', import.meta.url), { recursive: true })
  await writeFile(new URL('../.wrangler/deploy/cms.json', import.meta.url), JSON.stringify(config, null, 2) + '\n')
  await writeFile(new URL('../.wrangler/deploy/wrangler.json', import.meta.url), JSON.stringify({ name: config.vars.MEDIA_STORAGE_ENVIRONMENT === 'production' ? 'smz-cms' : 'smz-cms-staging', pages_build_output_dir: '../../apps/frontend/dist', compatibility_date: '2026-09-12', services: [{ binding: 'CMS_API', service: config.name }] }, null, 2) + '\n')
  console.info(`Generated .wrangler/deploy/cms.json for ${config.vars.MEDIA_STORAGE_ENVIRONMENT}; delivery enabled: ${config.vars.DELIVERY_ENABLED}`)
}
