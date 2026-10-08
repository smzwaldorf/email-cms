// Create only the two requested private buckets. R2 subscription activation is a separate, approved dashboard step.
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
const root = fileURLToPath(new URL('../', import.meta.url))
const configPath = `${root}config/r2-development.jsonc`
const config = JSON.parse(readFileSync(configPath, 'utf8'))
const buckets = ['smz-cms-media-dev-staging', 'smz-cms-media-production']
const apply = process.argv.includes('--apply')
if (process.argv.slice(2).some(arg => !['--apply','--plan'].includes(arg))) throw new Error('Use --plan or --apply')
console.info(`Account: ${config.account_id}; private Standard R2 buckets: ${buckets.join(', ')}`)
if (!apply) {
 console.info('Plan only. Development/staging use separate object prefixes; production uses a separate physical bucket. Public R2 access stays disabled.')
} else {
 const run = args => {
  const result = spawnSync(process.execPath, [`${root}node_modules/wrangler/bin/wrangler.js`, ...args, '--config', configPath], {
   cwd: root, encoding: 'utf8', env: { ...process.env, CLOUDFLARE_ACCOUNT_ID: config.account_id, WRANGLER_SEND_METRICS: 'false' },
  })
  if (result.status !== 0) { process.stderr.write(result.stderr || result.stdout); throw new Error('Cloudflare R2 operation failed; check school-account authentication and R2 activation') }
  return result.stdout.replace(/\x1b\[[0-9;]*m/g, '')
 }
 const list = run(['r2','bucket','list'])
 const names = new Set([...list.matchAll(/^name:\s+(\S+)\s*$/gm)].map(match => match[1]))
 for (const bucket of buckets) {
  if (names.has(bucket)) console.info(`Existing bucket preserved: ${bucket}`)
  else console.info(run(['r2','bucket','create',bucket,'--storage-class','Standard']).trim())
 }
 const verified = run(['r2','bucket','list'])
 for (const bucket of buckets) if (![...verified.matchAll(/^name:\s+(\S+)\s*$/gm)].some(match => match[1] === bucket)) throw new Error(`Bucket creation was not verified: ${bucket}`)
 console.info('Verified both buckets. No objects were uploaded and public access was not enabled.')
}
