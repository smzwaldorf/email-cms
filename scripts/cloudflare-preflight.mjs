import { checkHyperdriveDatabase } from './cloudflare-database.mjs'
import { configuration } from './cloudflare-config.mjs'
configuration(process.env)
if (process.env.CMS_AUTH_REGISTRATION_VERIFIED !== 'true') throw new Error('Exact CMS OIDC registration and coordinated logout must be verified before deployment')
const issuer = process.env.SMZ_AUTH_ISSUER
const discovery = await fetch(`${issuer}/.well-known/openid-configuration`)
if (!discovery.ok || (await discovery.json()).issuer !== issuer) throw new Error('Auth discovery does not match the configured issuer')
// Coordinated logout is verified separately with an authorized test session.
// Deployment preflight must not invoke a production session-ending endpoint.
await checkHyperdriveDatabase()
console.info('Auth and CMS schema preflight passed; authenticated browser smoke remains required')
