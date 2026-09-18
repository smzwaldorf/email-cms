import type { IdentityTransport } from '#/runtime/environment'

export interface Env {
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
  return { CMS_SESSION_ENABLED: env.CMS_SESSION_ENABLED, CMS_SESSION_SECRET: env.CMS_SESSION_SECRET, CMS_OIDC_CLIENT_SECRET: env.CMS_OIDC_CLIENT_SECRET, SMZ_AUTH_ISSUER: env.SMZ_AUTH_ISSUER, APP_URL: env.APP_URL, BACKEND_CORS_ORIGIN: env.BACKEND_CORS_ORIGIN,
    DELIVERY_ENABLED: env.DELIVERY_ENABLED, NEWSLETTER_DEMO_MODE: env.NEWSLETTER_DEMO_MODE, NEWSLETTER_TEST_RECIPIENTS: env.NEWSLETTER_TEST_RECIPIENTS,
    RESEND_API_KEY: env.RESEND_API_KEY, RESEND_FROM_EMAIL: env.RESEND_FROM_EMAIL,
    KIT_API_TOKEN: env.KIT_API_TOKEN, KIT_WEBHOOK_SECRET: env.KIT_WEBHOOK_SECRET, JWT_SECRET: env.JWT_SECRET, NODE_ENV: 'production' }
}
