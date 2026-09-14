import assert from 'node:assert/strict'
import { readFile, writeFile, rm } from 'node:fs/promises'
import pg from 'pg'
import { importSnapshot, parseSnapshot } from '../db/migration/import.mjs'

// Dedicated disposable server only: never accepts a remote target or production URL.
await rm(new URL('../db/migration/rehearsal-result.json', import.meta.url), { force: true })
const port = Number(process.env.CMS_REHEARSAL_PORT ?? 55443)
if (port !== 55443) throw new Error('Rehearsal uses only the dedicated local port 55443')
const base = 'postgres://migration_test@127.0.0.1:55443/'
const control = new pg.Client({ connectionString: base + 'postgres' })
await control.connect()
try { await control.query(`CREATE DATABASE "smz-cms" TEMPLATE template0 ENCODING 'UTF8'`) }
finally { await control.end() }
const client = new pg.Client({ connectionString: base + 'smz-cms' })
const bytes = await readFile(new URL('../db/seed-data.sql', import.meta.url))
const snapshot = parseSnapshot(bytes)
const targetUserId = '11111111-1111-4111-8111-111111111111'
await client.connect()
try {
  await client.query(await readFile(new URL('../db/schema.sql', import.meta.url), 'utf8'))
  const sourceUser = snapshot.get('user_roles').rows[0]
  await client.query("INSERT INTO public.user_roles(id,email,role) VALUES($1,$2,'student')", [targetUserId, sourceUser.email])
  await client.query('INSERT INTO public.user_auth_identities(issuer,subject,user_id) VALUES($1,$2,$3)', ['https://auth.school.test/api/auth', 'existing-verified-subject', targetUserId])
  await assert.rejects(importSnapshot(client, Buffer.concat([bytes, Buffer.from('\n')])), /Source snapshot changed/)
  await assert.rejects(importSnapshot(client, bytes, { commit: true }), /reviewed dry-run/)
  const interrupted = { query: (...args) => {
    if (args[0].startsWith('INSERT INTO public."articles"')) throw new Error('Injected mid-import failure')
    return client.query(...args)
  } }
  await assert.rejects(importSnapshot(interrupted, bytes), /Injected mid-import failure/)
  assert.equal((await client.query('SELECT count(*)::int AS n FROM public.newsletters')).rows[0].n, 0)
  assert.equal((await client.query('SELECT count(*)::int AS n FROM public.user_roles')).rows[0].n, 1)
  const dry = await importSnapshot(client, bytes)
  assert.equal(dry.outcome, 'rolled-back')
  assert.equal(dry.reusedUsers, 1)
  assert.equal((await client.query('SELECT count(*)::int AS n FROM public.newsletters')).rows[0].n, 0)
  assert.equal((await client.query('SELECT count(*)::int AS n FROM public.user_roles')).rows[0].n, 1)
  await client.query("UPDATE public.user_roles SET display_name='drift' WHERE id=$1", [targetUserId])
  await assert.rejects(importSnapshot(client, bytes, { commit: true, approved: dry, backupReference: 'disposable-local-baseline' }), /reviewed dry-run/)
  const approved = await importSnapshot(client, bytes)
  const applied = await importSnapshot(client, bytes, { commit: true, approved, backupReference: 'disposable-local-baseline' })
  assert.equal(applied.outcome, 'committed')
  assert.equal((await client.query('SELECT count(*)::int AS n FROM public.newsletters')).rows[0].n, 5)
  assert.equal((await client.query('SELECT count(*)::int AS n FROM public.articles')).rows[0].n, 10)
  assert.equal((await client.query('SELECT user_id FROM public.user_auth_identities')).rows[0].user_id, targetUserId)
  assert.equal((await client.query("SELECT count(*)::int AS n FROM public.user_roles WHERE role <> 'student'")).rows[0].n, 0)
  for (const table of ['newsletter_delivery_jobs', 'email_platform_sync_jobs', 'tracking_tokens']) assert.equal((await client.query(`SELECT count(*)::int AS n FROM public.${table}`)).rows[0].n, 0)
  assert.equal((await client.query('SELECT count(*)::int AS n FROM public.article_audit_log')).rows[0].n, 10)
  assert.equal((await client.query('SELECT count(*)::int AS n FROM public.articles WHERE created_by=$1 OR author_id=$1', [sourceUser.id])).rows[0].n, 0)
  await assert.rejects(importSnapshot(client, bytes), /populated table|already complete/)
  await writeFile(new URL('../db/migration/rehearsal-result.json', import.meta.url), JSON.stringify({
    environment: 'disposable-local-PostgreSQL-17', sourceSha256: applied.sourceSha256,
    productionWritesPerformed: false, inserted: applied.inserted, reusedUsers: applied.reusedUsers,
    checks: ['source hash refusal', 'unapproved commit refusal', 'dry-run rollback', 'mid-import failure rollback', 'destination drift refusal', 'typed row comparison', 'foreign-key constraints', 'existing OIDC link preservation', 'legacy creator reference remapping', 'no legacy role grants', 'delivery and sync job exclusion', 'audit triggers retained', 'repeat import refusal'],
  }, null, 2) + '\n')
  console.info('Migration rehearsal passed: rollback, protected commit, drift/repeat refusal and identity preservation')
} catch (error) {
  console.error(/^[0-9A-Z]{5}$/.test(error.code ?? '') ? `Rehearsal failed: PostgreSQL ${error.code} at ${error.table ?? error.constraint ?? 'query'}` : error.message)
  process.exitCode = 1
} finally { await client.end() }
