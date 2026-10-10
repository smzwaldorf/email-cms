import { databaseName } from './cloudflare-database-name.mjs'
const expectedDatabase = databaseName(process.env)
const { CLOUDFLARE_ACCOUNT_ID: account, CLOUDFLARE_API_TOKEN: token, CLOUDFLARE_HYPERDRIVE_ID: id } = process.env
if (!account || !token || !id) throw new Error('Cloudflare account, API token and Hyperdrive ID are required')
const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${account}/hyperdrive/configs/${id}`, { headers: { Authorization: `Bearer ${token}` } })
if (!response.ok) throw new Error(`Hyperdrive verification failed (HTTP ${response.status})`)
const body = await response.json()
if (!body.success || body.result?.caching?.disabled !== true) throw new Error('Hyperdrive query caching must be disabled')
if (body.result?.origin?.database !== expectedDatabase) throw new Error(`Hyperdrive must target ${expectedDatabase}`)
console.info(`Verified uncached Hyperdrive targeting ${expectedDatabase}`)
