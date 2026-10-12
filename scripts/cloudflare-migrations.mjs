import { createHash } from 'node:crypto'
export const retiredTables = ['families','family_enrollment','students','student_class_enrollment','teacher_profiles','teacher_class_assignment','classes','user_roles','user_role_assignments']
const identifier = value => '"' + value.replaceAll('"','""') + '"'
async function fingerprints(client, tables, columns) {
  const result = {}
  for (const table of tables) {
    const projection = columns[table].map(identifier).join(', ')
    const {rows} = await client.query(`SELECT count(*)::text AS count, md5(coalesce(string_agg(h, ',' ORDER BY h), '')) AS digest FROM (SELECT md5(to_jsonb(t)::text) AS h FROM (SELECT ${projection} FROM public.${identifier(table)}) t) hashes`)
    result[table] = rows[0]
  }
  return JSON.stringify(result)
}
export async function applyMigrations(client, migrations, { retirementApproved = false, backupReference = '', dryRun = false } = {}) {
  await client.query('BEGIN')
  try {
    await client.query("SET LOCAL lock_timeout='5s'")
    await client.query("SET LOCAL statement_timeout='90s'")
    await client.query("SELECT pg_advisory_xact_lock(hashtext('cms-reviewed-migrations'))")
    const {rows} = await client.query("SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename")
    const tables = rows.map(row => row.tablename)
    const legacy = tables.filter(table => retiredTables.includes(table))
    const retiresIdentity = migrations.some(({name}) => name === '20260918_retire_identity_masters.sql')
    if (retiresIdentity && legacy.length && (!retirementApproved || !backupReference.trim())) throw new Error('Identity retirement requires reviewed Auth mappings and a verified backup reference')
    // Lock data before comparing it: a concurrent editor must not create a false mismatch.
    for (const table of tables) await client.query(`LOCK TABLE public.${identifier(table)} IN SHARE ROW EXCLUSIVE MODE`)
    const preserved = tables.filter(table => !retiredTables.includes(table) && !['identity_reference_mappings','newsletter_family_preferences','cms_schema_migrations'].includes(table))
    // Compare every original column. Newly added nullable provenance columns do not
    // change historical values, while changes to existing columns still roll back.
    const columns = {}
    for (const table of preserved) {
      const result = await client.query("SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1 ORDER BY ordinal_position", [table])
      columns[table] = result.rows.map(row => row.column_name)
      if (!columns[table].length) throw new Error(`Cannot fingerprint columns for ${table}`)
    }
    const before = await fingerprints(client, preserved, columns)
    await client.query('CREATE TABLE IF NOT EXISTS public.cms_schema_migrations (name text PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())')
    for (const {name, sql} of migrations) {
      const checksum = createHash('sha256').update(sql).digest('hex')
      const existing = await client.query('SELECT checksum FROM public.cms_schema_migrations WHERE name=$1',[name])
      if (existing.rows.length) {
        if (existing.rows[0].checksum !== checksum) throw new Error(`Applied migration changed: ${name}`)
        continue
      }
      // Repository migrations share one transaction so failed data checks roll everything back.
      await client.query(sql.replace(/^\s*(BEGIN|COMMIT);\s*$/gm,''))
      await client.query('INSERT INTO public.cms_schema_migrations(name,checksum) VALUES($1,$2)',[name,checksum])
    }
    if (before !== await fingerprints(client, preserved, columns)) throw new Error('Migration changed retained content or historical rows; rolled back')
    await client.query('SELECT id_hash FROM public.cms_browser_sessions LIMIT 0')
    await client.query('SELECT auth_family_id FROM public.newsletter_family_preferences LIMIT 0')
    await client.query('SELECT auth_id FROM public.identity_reference_mappings LIMIT 0')
    if (retiresIdentity) {
      const remaining = await client.query("SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename=ANY($1::text[])", [retiredTables])
      if (remaining.rows.length) throw new Error('Legacy identity tables remain after retirement')
    }
    await client.query(dryRun ? 'ROLLBACK' : 'COMMIT')
    return {migrations:migrations.map(m=>m.name),historyPreserved:true,outcome:dryRun ? 'rolled-back' : 'committed'}
  } catch(error) { await client.query('ROLLBACK'); throw error }
}
