import { randomBytes } from 'node:crypto'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { createServer } from 'node:net'
import { fileURLToPath } from 'node:url'
import { configuration } from './cloudflare-config.mjs'

// Use production's Hyperdrive credential without a permanent admin endpoint.
export async function runProductionMigration({mode, outputPath, approvedPath, backupReference = ''}) {
  if (!['backup','dry-run','commit','verify'].includes(mode) || !outputPath) throw new Error('A valid mode and output file are required')
  if (mode === 'commit' && (!approvedPath || !backupReference)) throw new Error('Commit requires approved dry run and verified backup')
  const approved = approvedPath ? JSON.parse(await readFile(approvedPath, 'utf8')) : null
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
  const source = ['dry-run','commit'].includes(mode) ? await readFile(new URL('../db/seed-data.sql', import.meta.url), 'utf8') : ''
  await writeFile(`${directory}/worker.mjs`, `
import pg from 'pg';
import { runMigration } from '../../db/migration/production-operation.mjs';
const operation = ${JSON.stringify({mode, source, approved, backupReference})};
export default { async fetch(request, env) {
  if (request.headers.get('authorization') !== 'Bearer ' + env.CHECK_TOKEN) return new Response(null, {status:404});
  if (request.method === 'GET') return new Response(null, {status:204});
  if (request.method !== 'POST') return new Response(null, {status:405});
  const client = new pg.Client({connectionString:env.HYPERDRIVE.connectionString, connectionTimeoutMillis:15000});
  try {
    await client.connect();
    return Response.json(await runMigration(client, operation));
  } catch (error) {
    return Response.json({error:error.code ? 'PostgreSQL migration error' : error.message,code:error.code ?? null}, {status:503});
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
    if (!response.ok) throw new Error(JSON.stringify(result))
    await writeFile(outputPath, JSON.stringify(result, null, 2) + '\n', {mode:0o600,flag:'wx'})
    console.info(JSON.stringify({mode,outcome:result.outcome ?? 'captured',tables:result.data ? Object.keys(result.data).length : undefined,inserted:result.inserted,reusedUsers:result.reusedUsers}))
  } finally {
    if (child.exitCode === null) {
      process.kill(-child.pid, 'SIGTERM')
      await Promise.race([once(child, 'exit'), new Promise(resolve => setTimeout(resolve, 5000))])
      if (child.exitCode === null) process.kill(-child.pid, 'SIGKILL')
    }
    await rm(directory, { recursive: true, force: true })
  }
}

const [mode, outputPath, approvedPath, backupReference] = process.argv.slice(2)
await runProductionMigration({mode, outputPath, approvedPath, backupReference})
