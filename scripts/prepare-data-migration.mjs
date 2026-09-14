import { createHash } from 'node:crypto'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { resolve, dirname } from 'node:path'

// Read-only inventory of a pg_dump COPY snapshot. Never executes source SQL.
const args = process.argv.slice(2)
if (args.length > 3 || (args[2] && args[2] !== '--confirmed-source')) throw new Error('Usage: node scripts/prepare-data-migration.mjs [source.sql] [report.json] [--confirmed-source]')
const source = resolve(args[0] ?? 'db/seed-data.sql')
const output = resolve(args[1] ?? 'db/migration/source-inventory.json')
if (source === output) throw new Error('Report must not overwrite the source snapshot')
const bytes = await readFile(source)
const text = bytes.toString('utf8')
const tables = []
const seen = new Set()
const excluded = new Set([
  'auth_events', 'authorization_decision_trace', 'user_auth_identities', 'user_role_assignments',
  'tracking_tokens', 'newsletter_delivery_jobs', 'newsletter_delivery_batches',
  'newsletter_delivery_batch_recipients', 'email_platform_sync_jobs',
  'email_platform_webhook_events', 'email_platform_subscriber_mappings',
  'email_platform_subscription_audit',
])
const lines = text.split(/\r?\n/)
for (let index = 0; index < lines.length; index++) {
  const line = lines[index]
  if (!line.startsWith('COPY ')) continue
  const match = /^COPY public\.([a-z_]+) \(([^)]+)\) FROM stdin;$/.exec(line)
  if (!match) throw new Error(`Unsupported COPY format at line ${index + 1}`)
  const [, name, columnsText] = match
  if (seen.has(name)) throw new Error(`Duplicate COPY block: ${name}`)
  seen.add(name)
  const columns = columnsText.split(',').map(value => value.trim())
  let rows = 0
  for (++index; index < lines.length && lines[index] !== '\\.'; index++) {
    if (lines[index].split('\t').length !== columns.length) throw new Error(`Column count mismatch in ${name} at line ${index + 1}`)
    rows++
  }
  if (index === lines.length) throw new Error(`Unterminated COPY block: ${name}`)
  const handling = excluded.has(name) ? 'exclude-from-initial-import'
    : name === 'user_roles' ? 'reconcile-local-user-ids-without-granting-auth-roles'
    : name.endsWith('_audit_log') || name === 'permission_mutation_audit_log' || name.startsWith('analytics_') ? 'retain-in-source-archive; separate-history-decision'
    : 'candidate-domain-data'
  tables.push({ table: `public.${name}`, columns, rows, handling })
}
if (!tables.length) throw new Error('No supported COPY blocks found')
const report = {
  source: args[0] ?? 'db/seed-data.sql', sourceSha256: createHash('sha256').update(bytes).digest('hex'),
  sourceBytes: bytes.length, targetDatabase: 'smz-cms', mode: 'preparation-only',
  sourceAuthorityConfirmed: args[2] === '--confirmed-source', productionWritesPerformed: false,
  tableCount: tables.length, totalRows: tables.reduce((sum, table) => sum + table.rows, 0),
  triggerDisablingStatements: (text.match(/^ALTER TABLE .* DISABLE TRIGGER ALL;/gm) ?? []).length,
  blockers: [
    'Confirm the authoritative source and take a fresh consistent export if this snapshot is stale.',
    'Back up production and reconcile source user IDs with existing CMS identity links.',
    'Rehearse parameterized inserts with constraints enabled; do not execute this dump directly.',
    'Resolve foreign-key, unique-key and external-media checks before enabling import.',
  ],
  tables,
}
await mkdir(dirname(output), { recursive: true })
await writeFile(output, JSON.stringify(report, null, 2) + '\n', { flag: 'w' })
console.info(`Prepared ${tables.length}-table, ${report.totalRows}-row inventory; no database connection or writes`)
