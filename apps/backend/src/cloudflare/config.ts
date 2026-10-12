import type { IdentityTransport } from '#/runtime/environment'
import type { R2Bucket } from '@cloudflare/workers-types'

export interface Env {
  OPENAI_API_KEY?: string
  OPENAI_PDF_MODEL?: string
  MEDIA_BUCKET?: R2Bucket
  MEDIA_R2_BUCKET?: string
  MEDIA_STORAGE_ENVIRONMENT?: string
  MEDIA_API_ORIGIN?: string
  MEDIA_SIGNING_SECRET?: string
  CMS_SESSION_ENABLED?: string
  CMS_SESSION_SECRET?: string
  CMS_OIDC_CLIENT_SECRET?: string
  SMZ_AUTH?: IdentityTransport
  HYPERDRIVE: { connectionString: string }
  SMZ_AUTH_ISSUER: string
  APP_URL: string
  BACKEND_CORS_ORIGIN: string
  DELIVERY_ENABLED?: string
  NEWSLETTER_DEMO_MODE?: string
  NEWSLETTER_TEST_RECIPIENTS?: string
  RESEND_WEBHOOK_SECRET?: string
  RESEND_API_KEY?: string
  RESEND_FROM_EMAIL?: string
  KIT_API_TOKEN?: string
  KIT_WEBHOOK_SECRET?: string
  JWT_SECRET?: string
}

export function validateEnvironment(env: Env): Record<string, string | undefined> {
  for (const key of ['SMZ_AUTH_ISSUER', 'APP_URL', 'BACKEND_CORS_ORIGIN'] as const) {
    const url = new URL(env[key])
    if (url.protocol !== 'https:' || url.username || url.password || /(^|\.)(localhost|example\.(com|test|org))$/.test(url.hostname)) {
      throw new Error(`Invalid production ${key}`)
    }
    if (key !== 'SMZ_AUTH_ISSUER' && url.origin !== env[key]) throw new Error(`${key} must be an exact origin`)
  }
  if (!env.SMZ_AUTH_ISSUER.endsWith('/api/auth') || env.APP_URL !== env.BACKEND_CORS_ORIGIN) throw new Error('Invalid CMS origins')
  if (!env.HYPERDRIVE?.connectionString) throw new Error('Missing Hyperdrive binding')
  if (env.DELIVERY_ENABLED !== undefined && !['true', 'false'].includes(env.DELIVERY_ENABLED)) throw new Error('Invalid delivery switch')
  if (env.NEWSLETTER_DEMO_MODE !== undefined && !['true', 'false'].includes(env.NEWSLETTER_DEMO_MODE)) throw new Error('Invalid demo switch')
  if (env.CMS_SESSION_ENABLED === 'true' && (!/^[a-f0-9]{64}$/i.test(env.CMS_SESSION_SECRET ?? '') || (env.CMS_OIDC_CLIENT_SECRET?.length ?? 0) < 32)) throw new Error('Missing backend session secrets')
  if (env.MEDIA_STORAGE_ENVIRONMENT !== undefined) {
    if (!['staging', 'production'].includes(env.MEDIA_STORAGE_ENVIRONMENT) || !env.MEDIA_BUCKET) throw new Error('Missing or invalid R2 binding')
    const expected = env.MEDIA_STORAGE_ENVIRONMENT === 'production' ? 'smz-cms-media-production' : 'smz-cms-media-dev-staging'
    if (env.MEDIA_R2_BUCKET !== expected || env.MEDIA_API_ORIGIN !== env.APP_URL || (env.MEDIA_SIGNING_SECRET ?? env.JWT_SECRET ?? '').length < 32) throw new Error('Invalid R2 media configuration')
  }
  return { OPENAI_API_KEY: env.OPENAI_API_KEY, OPENAI_PDF_MODEL: env.OPENAI_PDF_MODEL, MEDIA_STORAGE_ENVIRONMENT: env.MEDIA_STORAGE_ENVIRONMENT, MEDIA_R2_BUCKET: env.MEDIA_R2_BUCKET, MEDIA_API_ORIGIN: env.MEDIA_API_ORIGIN, MEDIA_SIGNING_SECRET: env.MEDIA_SIGNING_SECRET, CMS_SESSION_ENABLED: env.CMS_SESSION_ENABLED, CMS_SESSION_SECRET: env.CMS_SESSION_SECRET, CMS_OIDC_CLIENT_SECRET: env.CMS_OIDC_CLIENT_SECRET, SMZ_AUTH_ISSUER: env.SMZ_AUTH_ISSUER, APP_URL: env.APP_URL, BACKEND_CORS_ORIGIN: env.BACKEND_CORS_ORIGIN,
    DELIVERY_ENABLED: env.DELIVERY_ENABLED ?? 'true', NEWSLETTER_DEMO_MODE: env.NEWSLETTER_DEMO_MODE, NEWSLETTER_TEST_RECIPIENTS: env.NEWSLETTER_TEST_RECIPIENTS,
    RESEND_WEBHOOK_SECRET: env.RESEND_WEBHOOK_SECRET, RESEND_API_KEY: env.RESEND_API_KEY, RESEND_FROM_EMAIL: env.RESEND_FROM_EMAIL,
    KIT_API_TOKEN: env.KIT_API_TOKEN, KIT_WEBHOOK_SECRET: env.KIT_WEBHOOK_SECRET, JWT_SECRET: env.JWT_SECRET, NODE_ENV: 'production' }
}
