import pg from 'pg'
import { configuration } from './cloudflare-config.mjs'
configuration(process.env)
if (process.env.CMS_AUTH_REGISTRATION_VERIFIED !== 'true') throw new Error('Exact CMS OIDC registration and coordinated logout must be verified before deployment')
const issuer = process.env.SMZ_AUTH_ISSUER
const discovery = await fetch(`${issuer}/.well-known/openid-configuration`)
if (!discovery.ok || (await discovery.json()).issuer !== issuer) throw new Error('Auth discovery does not match the configured issuer')
// Coordinated logout is verified separately with an authorized test session.
// Deployment preflight must not invoke a production session-ending endpoint.
const url = new URL(process.env.CMS_DATABASE_URL ?? '')
if (decodeURIComponent(url.pathname.slice(1)) !== 'smz-cms' || !['verify-full', 'verify-ca'].includes(url.searchParams.get('sslmode') ?? '')) throw new Error('A direct verified TLS connection to smz-cms is required')
// PlanetScale's psql URI uses 'system'; node-postgres uses Node's trusted CA store.
if (url.searchParams.get('sslrootcert') === 'system') url.searchParams.delete('sslrootcert')
const client = new pg.Client({ connectionString: url.toString() })
try {
  await client.connect()
  const { rows } = await client.query('SELECT current_database() AS name')
  if (rows[0]?.name !== 'smz-cms') throw new Error('Wrong logical database')
  await client.query('SELECT id FROM public.newsletters LIMIT 0')
  await client.query('SELECT id FROM public.newsletter_delivery_jobs LIMIT 0')
  console.info('Auth endpoint and CMS schema preflight passed; authenticated browser smoke remains required')
} finally { await client.end() }
