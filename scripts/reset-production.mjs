import { checkHyperdriveDatabase } from './cloudflare-database.mjs'

if (process.env.DEPLOYMENT_ENVIRONMENT !== 'production' || process.env.PRODUCTION_DATABASE_RESET_APPROVED !== 'true') {
  throw new Error('Production reset requires the explicit workflow approval')
}

await checkHyperdriveDatabase({ reset: true, initialize: true, migrateAll: true })
console.info('Wiped, initialized, and migrated production News through Hyperdrive')
