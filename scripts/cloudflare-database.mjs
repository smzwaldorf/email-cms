import { randomBytes } from 'node:crypto'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { createServer } from 'node:net'
import { fileURLToPath } from 'node:url'
import { configuration } from './cloudflare-config.mjs'

export const additiveMigrationFiles = [
  '20260913_cms_sessions.sql',
  '20260916_newsletter_week_updates.sql',
  '20260920_identity_coexistence.sql',
]

export function migrationFilesFor(env) {
  const retirementRequested = env.CMS_IDENTITY_RETIREMENT_APPROVED === 'true' || Boolean(env.CMS_IDENTITY_BACKUP_REFERENCE?.trim())
  return retirementRequested ? [...additiveMigrationFiles, '20260918_retire_identity_masters.sql'] : additiveMigrationFiles
}

// Use production's Hyperdrive credential without a permanent admin endpoint.
export async function checkHyperdriveDatabase({ initialize = false, migrateSessions = false, migrateAll = false } = {}) {
  const config = configuration(process.env)
  const root = fileURLToPath(new URL('../', import.meta.url))
  await mkdir(`${root}.wrangler/`, { recursive: true })
  const directory = await mkdtemp(`${root}.wrangler/database-check-`)
  const token = randomBytes(32).toString('hex')
  const server = createServer()
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  const port = server.address().port
  await new Promise(resolve => server.close(resolve))
  const schema = initialize ? await readFile(new URL('../db/schema.sql', import.meta.url), 'utf8') : ''
  const sessionSchema = migrateSessions ? await readFile(new URL('../db/migrations/20260913_cms_sessions.sql', import.meta.url), 'utf8') : ''
  const migrations = migrateAll ? await Promise.all(migrationFilesFor(process.env).map(async name => ({name, sql:await readFile(new URL('../db/migrations/' + name, import.meta.url),'utf8')}))) : []
  const migrationOptions = {retirementApproved:process.env.CMS_IDENTITY_RETIREMENT_APPROVED === 'true',backupReference:process.env.CMS_IDENTITY_BACKUP_REFERENCE ?? ''}
  await writeFile(`${directory}/worker.mjs`, `
import pg from 'pg';
import { verifyDatabase } from '../../scripts/cloudflare-database-operation.mjs';
import { applyMigrations } from '../../scripts/cloudflare-migrations.mjs';
const schema = ${JSON.stringify(schema)};
const sessionSchema = ${JSON.stringify(sessionSchema)};
export default { async fetch(request, env) {
  if (request.headers.get('authorization') !== 'Bearer ' + env.CHECK_TOKEN) return new Response(null, {status:404});
  if (request.method === 'GET') return new Response(null, {status:204});
  if (request.method !== 'POST') return new Response(null, {status:405});
  const client = new pg.Client({connectionString:env.HYPERDRIVE.connectionString, connectionTimeoutMillis:15000});
  try {
    await client.connect();
    const verified = await verifyDatabase(client, {initialize:${initialize}, schema});
    if (${migrateAll}) await applyMigrations(client, ${JSON.stringify(migrations)}, ${JSON.stringify(migrationOptions)});
    if (sessionSchema) {
      await client.query('BEGIN');
      await client.query("SET LOCAL lock_timeout='5s'");
      await client.query("SET LOCAL statement_timeout='30s'");
      await client.query("SELECT pg_advisory_xact_lock(hashtext('cms-session-migration'))");
      await client.query(sessionSchema);
      await client.query('SELECT id_hash FROM cms_browser_sessions LIMIT 0');
      await client.query('SELECT state_hash FROM cms_login_flows LIMIT 0');
      await client.query('COMMIT');
    }
    return Response.json(verified);
  } catch (error) {
    return Response.json({error:'CMS database check failed',code:error.code ?? null}, {status:503});
  } finally { await client.end().catch(() => {}); }
}};
`)
  await writeFile(`${directory}/wrangler.json`, JSON.stringify({
    name: 'smz-cms-db-verification', main: './worker.mjs',
    account_id: config.account_id, compatibility_date: config.compatibility_date,
    compatibility_flags: ['nodejs_compat'], hyperdrive: config.hyperdrive,
    vars: { CHECK_TOKEN: token },
  }))
  const child = spawn(process.execPath, [`${root}node_modules/wrangler/bin/wrangler.js`, 'dev', '--remote', '--config', `${directory}/wrangler.json`, '--ip', '127.0.0.1', '--port', String(port)], {
    cwd: root, detached: true, stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, CI: 'true', WRANGLER_SEND_METRICS: 'false', WRANGLER_LOG_PATH: `${directory}/logs` },
  })
  let output = ''
  const capture = data => { output = (output + data.toString().replaceAll(token, '[redacted]')).slice(-6000) }
  child.stdout.on('data', capture)
  child.stderr.on('data', capture)
  const endpoint = `http://127.0.0.1:${port}/`
  const headers = { Authorization: `Bearer ${token}` }
  try {
    let ready = false
    for (let attempt = 0; attempt < 120; attempt++) {
      if (child.exitCode !== null) throw new Error(`Hyperdrive preview exited: ${output}`)
      try { ready = (await fetch(endpoint, { headers, signal: AbortSignal.timeout(1000) })).status === 204 } catch {}
      if (ready) break
      await new Promise(resolve => setTimeout(resolve, 1000))
    }
    if (!ready) throw new Error(`Hyperdrive preview did not become ready: ${output}`)
    // Never retry initialization: a lost response may follow a successful commit.
    const response = await fetch(endpoint, { method: 'POST', headers, signal: AbortSignal.timeout(120000) })
    const result = await response.json()
    if (!response.ok || result.database !== 'smz-cms' || result.schema !== 'verified') throw new Error(JSON.stringify(result))
    console.info(initialize ? 'Initialized empty smz-cms through Hyperdrive; no seed data imported' : 'Verified production CMS schema through Hyperdrive')
  } finally {
    if (child.exitCode === null) {
      process.kill(-child.pid, 'SIGTERM')
      await Promise.race([once(child, 'exit'), new Promise(resolve => setTimeout(resolve, 5000))])
      if (child.exitCode === null) process.kill(-child.pid, 'SIGKILL')
    }
    await rm(directory, { recursive: true, force: true })
  }
}
