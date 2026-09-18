import { checkHyperdriveDatabase } from './cloudflare-database.mjs'
await checkHyperdriveDatabase({ migrateAll: true })
console.info('All CMS migrations and historical data checks passed')
