import { databaseName } from './cloudflare-database-name.mjs'
import { verifyHyperdrivePolicy } from './hyperdrive-policy.mjs'
const expectedDatabase = databaseName(process.env)
const { CLOUDFLARE_ACCOUNT_ID: account, CLOUDFLARE_API_TOKEN: token, CLOUDFLARE_HYPERDRIVE_ID: id } = process.env
if (!account || !token || !id) throw new Error('Cloudflare account, API token and Hyperdrive ID are required')
const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${account}/hyperdrive/configs/${id}`, { headers: { Authorization: `Bearer ${token}` } })
if (!response.ok) throw new Error(`Hyperdrive verification failed (HTTP ${response.status})`)
const body = await response.json()
if (!body.success) throw new Error('Hyperdrive verification failed')
verifyHyperdrivePolicy(body.result, expectedDatabase)
console.info(`Verified uncached Hyperdrive targeting ${expectedDatabase}:${body.result.origin.port}, origin connection limit 5`)
