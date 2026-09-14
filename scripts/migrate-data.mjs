import { readFile, writeFile } from 'node:fs/promises'
import pg from 'pg'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { importSnapshot } from '../db/migration/import.mjs'

const options = new Map()
for (let i = 2; i < process.argv.length; i += 2) {
  const key = process.argv[i], value = process.argv[i + 1]
  if (!['--mode', '--report', '--approved', '--backup-reference'].includes(key) || !value || options.has(key)) throw new Error('Expected --mode dry-run|commit --report file.json [--approved reviewed.json --backup-reference reference]')
  options.set(key, value)
}
const mode = options.get('--mode') ?? 'dry-run'
if (!['dry-run', 'commit'].includes(mode)) throw new Error('Invalid mode')
if (!options.has('--report')) throw new Error('--report is required; keep reports outside the public frontend')
const reportPath = resolve(options.get('--report'))
if (!reportPath.endsWith('.json') || reportPath === resolve(options.get('--approved') ?? '') || reportPath === fileURLToPath(new URL('../db/seed-data.sql', import.meta.url))) throw new Error('Use a separate JSON report path')
if (mode === 'commit' && (!options.has('--approved') || !options.has('--backup-reference'))) throw new Error('Commit requires a reviewed dry-run manifest and backup reference')
const url = new URL(process.env.CMS_MIGRATION_DATABASE_URL ?? '')
if (decodeURIComponent(url.pathname.slice(1)) !== 'smz-cms') throw new Error('Only the smz-cms database is allowed')
if (!['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) && !['verify-full', 'verify-ca'].includes(url.searchParams.get('sslmode'))) throw new Error('Verified TLS is required for remote connections')
if (url.searchParams.get('sslrootcert') === 'system') url.searchParams.delete('sslrootcert')
const client = new pg.Client({ connectionString: url.toString(), connectionTimeoutMillis: 10000 })
let committed = false
try {
  const approved = options.has('--approved') ? JSON.parse(await readFile(options.get('--approved'), 'utf8')) : null
  await client.connect()
  const report = await importSnapshot(client, await readFile(new URL('../db/seed-data.sql', import.meta.url)), { commit: mode === 'commit', approved, backupReference: options.get('--backup-reference') })
  committed = report.outcome === 'committed'
  await writeFile(reportPath, JSON.stringify(report, null, 2) + '\n', { mode: 0o600 })
  console.info(`${report.outcome}: ${Object.values(report.inserted).reduce((a, b) => a + b, 0)} rows; ${report.reusedUsers} existing users reused`)
} catch (error) {
  // PostgreSQL error details may contain personal source values; keep them out of logs.
  if (committed) console.error('Database commit succeeded but writing the report failed. Do not retry; inspect cms_data_migrations.')
  console.error(error.code ? `Migration stopped with PostgreSQL code ${error.code}; transaction rolled back unless commit was already confirmed` : error.message)
  process.exitCode = 1
} finally { await client.end() }
