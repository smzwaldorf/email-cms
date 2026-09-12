import { readFile } from 'node:fs/promises'
import pg from 'pg'
// Run only with a direct, verified TLS connection to the reserved CMS database.
const url = new URL(process.env.CMS_DATABASE_URL ?? '')
if (decodeURIComponent(url.pathname.slice(1)) !== 'smz-cms') throw new Error('Refusing to initialize a database other than smz-cms')
if (!['verify-full', 'verify-ca'].includes(url.searchParams.get('sslmode') ?? '')) throw new Error('Verified TLS is required')
// PlanetScale's psql URI uses 'system'; node-postgres uses Node's trusted CA store.
if (url.searchParams.get('sslrootcert') === 'system') url.searchParams.delete('sslrootcert')
const client = new pg.Client({ connectionString: url.toString() })
try {
  await client.connect()
  const identity = await client.query('SELECT current_database() AS name')
  if (identity.rows[0]?.name !== 'smz-cms') throw new Error('Connected database does not match smz-cms')
  await client.query('BEGIN')
  await client.query("SELECT pg_advisory_xact_lock(hashtext('cms-schema-bootstrap'))")
  const { rows } = await client.query("SELECT tablename FROM pg_tables WHERE schemaname = 'public'")
  if (rows.length) throw new Error('Refusing initialization: public schema already contains tables')
  await client.query(await readFile(new URL('../db/schema.sql', import.meta.url), 'utf8'))
  await client.query('COMMIT')
  console.info('Initialized the empty smz-cms database; no seed data or directory eligibility imported')
} catch (error) {
  await client.query('ROLLBACK').catch(() => {})
  throw error
} finally { await client.end() }
