import { importSnapshot, hash } from './import.mjs'
const identifier = name => { if (!/^[a-z_]+$/.test(name)) throw new Error('Invalid table'); return `"${name}"` }
export async function captureDatabase(client) {
  const identity = await client.query('SELECT current_database() AS name')
  if (identity.rows[0]?.name !== 'smz-cms') throw new Error('Wrong database')
  await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY')
  try {
    await client.query("SET LOCAL search_path = public")
    await client.query("SET LOCAL timezone = 'UTC'")
    const {rows: tables} = await client.query("SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename")
    const {rows: columns} = await client.query("SELECT table_name,column_name,data_type,udt_name,is_nullable,column_default FROM information_schema.columns WHERE table_schema='public' ORDER BY table_name,ordinal_position")
    const {rows: constraints} = await client.query("SELECT conrelid::regclass::text AS table_name,conname,pg_get_constraintdef(oid) AS definition FROM pg_constraint WHERE connamespace='public'::regnamespace ORDER BY conrelid::regclass::text,conname")
    const data = {}, checksums = {}
    for (const {tablename} of tables) {
      const {rows} = await client.query(`SELECT row_to_json(t) AS row FROM public.${identifier(tablename)} t ORDER BY row_to_json(t)::text`)
      data[tablename] = rows.map(item => item.row)
      checksums[tablename] = hash(JSON.stringify(data[tablename]))
    }
    await client.query('COMMIT')
    return {database:'smz-cms',capturedAt:new Date().toISOString(),columns,constraints,data,checksums}
  } catch (error) {await client.query('ROLLBACK');throw error}
}
export async function runMigration(client, {mode, source, approved, backupReference}) {
  if (mode === 'backup' || mode === 'verify') return captureDatabase(client)
  if (!['dry-run','commit'].includes(mode)) throw new Error('Unsupported operation')
  return importSnapshot(client, Buffer.from(source, 'utf8'), {commit:mode==='commit',approved,backupReference})
}
