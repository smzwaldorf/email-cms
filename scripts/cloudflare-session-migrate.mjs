import { checkHyperdriveDatabase } from './cloudflare-database.mjs'
await checkHyperdriveDatabase({ migrateSessions: true })
console.info('Additive CMS session migration verified')
