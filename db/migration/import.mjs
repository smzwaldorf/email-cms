import { createHash } from 'node:crypto'

export const SOURCE_SHA256 = 'f6417e706c8ca377ae9f8feaa8bfccad1b27c91010478115f143c9c2988e51f3'
export const TABLES = ['user_roles', 'newsletters', 'classes', 'families', 'students', 'article_categories', 'article_tags', 'email_templates', 'email_template_revisions', 'articles', 'media_files', 'media_variants', 'media_usage', 'article_category_assignments', 'article_tag_assignments', 'article_media_references', 'family_enrollment', 'student_class_enrollment', 'teacher_profiles', 'teacher_class_assignment', 'newsletter_articles']
const quote = name => {
  if (!/^[a-z_]+$/.test(name)) throw new Error('Unsupported SQL identifier')
  return `"${name}"`
}
export const hash = value => createHash('sha256').update(value).digest('hex')
function decode(value) {
  if (value === '\\N') return null
  return value.replace(/\\([0-7]{1,3}|x[0-9a-fA-F]{1,2}|.)/g, (_, escaped) => {
    if (/^[0-7]/.test(escaped)) return String.fromCharCode(parseInt(escaped, 8))
    if (/^x[0-9a-fA-F]/.test(escaped)) return String.fromCharCode(parseInt(escaped.slice(1), 16))
    return ({ b: '\b', f: '\f', n: '\n', r: '\r', t: '\t', v: '\v', '\\': '\\' })[escaped] ?? escaped
  })
}
export function parseSnapshot(bytes) {
  if (hash(bytes) !== SOURCE_SHA256) throw new Error('Source snapshot changed; review a new inventory before import')
  const blocks = new Map()
  const lines = bytes.toString('utf8').split(/\r?\n/)
  for (let i = 0; i < lines.length; i++) {
    if (!lines[i].startsWith('COPY ')) continue
    const match = /^COPY public\.([a-z_]+) \(([^)]+)\) FROM stdin;$/.exec(lines[i])
    if (!match || blocks.has(match[1])) throw new Error('Unsupported or duplicate COPY block')
    const name = match[1], columns = match[2].split(',').map(c => c.trim().replace(/^"([a-z_]+)"$/, '$1'))
    columns.forEach(quote)
    const rows = []
    for (++i; i < lines.length && lines[i] !== '\\.'; i++) {
      const values = lines[i].split('\t')
      if (values.length !== columns.length) throw new Error(`Invalid row width in ${name}`)
      rows.push(Object.fromEntries(columns.map((column, j) => [column, decode(values[j])])))
    }
    if (i === lines.length) throw new Error(`Incomplete COPY block: ${name}`)
    blocks.set(name, { columns, rows })
  }
  for (const name of TABLES) if (!blocks.has(name)) throw new Error(`Missing source table: ${name}`)
  return blocks
}
async function fingerprint(client) {
  const { rows: schema } = await client.query(`SELECT table_name,column_name,data_type,udt_name,is_nullable,column_default FROM information_schema.columns WHERE table_schema='public' ORDER BY table_name,ordinal_position`)
  const { rows: constraints } = await client.query(`SELECT conrelid::regclass::text AS table_name,conname,pg_get_constraintdef(oid) AS definition FROM pg_constraint WHERE connamespace='public'::regnamespace ORDER BY conrelid::regclass::text,conname`)
  const { rows: triggers } = await client.query(`SELECT tgrelid::regclass::text AS table_name,tgname,tgenabled,pg_get_triggerdef(oid) AS definition FROM pg_trigger WHERE NOT tgisinternal AND tgrelid IN (SELECT oid FROM pg_class WHERE relnamespace='public'::regnamespace) ORDER BY tgrelid::regclass::text,tgname`)
  const content = {}
  for (const table of [...TABLES, 'user_auth_identities']) {
    const { rows } = await client.query(`SELECT count(*)::int AS count, md5(coalesce(string_agg(row_to_json(t)::text, E'\\n' ORDER BY row_to_json(t)::text),'')) AS checksum FROM public.${quote(table)} t`)
    content[table] = rows[0]
  }
  return { schemaHash: hash(JSON.stringify({ schema, constraints, triggers })), content }
}

// Caller owns the connection. Dry run is the default and always rolls back.
export async function importSnapshot(client, bytes, { commit = false, approved = null, backupReference = '' } = {}) {
  const blocks = parseSnapshot(bytes)
  const { rows: databases } = await client.query('SELECT current_database() AS name')
  if (databases[0]?.name !== 'smz-cms') throw new Error('Refusing a database other than smz-cms')
  await client.query('BEGIN')
  try {
    await client.query("SET LOCAL search_path = public")
    await client.query("SET LOCAL timezone = 'UTC'")
    await client.query("SET LOCAL lock_timeout = '5s'")
    await client.query("SET LOCAL statement_timeout = '30s'")
    await client.query("SET LOCAL idle_in_transaction_session_timeout = '60s'")
    await client.query("SELECT pg_advisory_xact_lock(hashtext('cms-data-migration'))")
    const { rows: relations } = await client.query("SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename")
    await client.query(`LOCK TABLE ${relations.map(r => `public.${quote(r.tablename)}`).join(',')} IN SHARE ROW EXCLUSIVE MODE`)
    const before = await fingerprint(client)
    const beforeHash = hash(JSON.stringify(before))
    if (commit && (!backupReference || !approved || approved.sourceSha256 !== SOURCE_SHA256 || approved.destinationBeforeHash !== beforeHash || approved.outcome !== 'rolled-back')) throw new Error('A matching reviewed dry-run manifest and backup reference are required')
    for (const name of TABLES.filter(name => name !== 'user_roles')) {
      if (before.content[name].count !== 0) throw new Error(`Refusing import into populated table: ${name}`)
    }
    const migrationId = `seed-${SOURCE_SHA256}`
    await client.query(`CREATE TABLE IF NOT EXISTS public.cms_data_migrations (id text PRIMARY KEY, source_sha256 text NOT NULL, manifest jsonb NOT NULL, backup_reference text NOT NULL, completed_at timestamptz NOT NULL DEFAULT now())`)
    if ((await client.query('SELECT id FROM public.cms_data_migrations WHERE id=$1', [migrationId])).rowCount) throw new Error('This source migration is already complete')
    const { rows: foreignKeys } = await client.query(`SELECT child.relname AS table_name, a.attname AS column_name FROM pg_constraint c JOIN pg_class child ON child.oid=c.conrelid JOIN pg_attribute a ON a.attrelid=c.conrelid AND a.attnum=c.conkey[1] WHERE c.contype='f' AND c.confrelid='public.user_roles'::regclass`)
    const { rows: keyRows } = await client.query(`SELECT r.relname AS table_name, array_agg(a.attname::text ORDER BY k.ordinality) AS columns FROM pg_constraint c JOIN pg_class r ON r.oid=c.conrelid CROSS JOIN LATERAL unnest(c.conkey) WITH ORDINALITY k(attnum,ordinality) JOIN pg_attribute a ON a.attrelid=c.conrelid AND a.attnum=k.attnum WHERE c.contype='p' AND c.connamespace='public'::regnamespace GROUP BY r.relname`)
    const primaryKeys = new Map(keyRows.map(row => [row.table_name, row.columns]))
    const userMap = new Map(), inserted = {}, insertedKeys = {}, expectedRows = {}
    const sourceEmails = new Set()
    for (const source of blocks.get('user_roles').rows) {
      const email = source.email.trim().toLowerCase()
      if (!email || sourceEmails.has(email)) throw new Error('Ambiguous source user email')
      sourceEmails.add(email)
      const { rows: existing } = await client.query('SELECT id FROM public.user_roles WHERE lower(trim(email))=$1', [email])
      if (existing.length > 1) throw new Error('Ambiguous destination user email')
      if (existing.length === 1) { userMap.set(source.id, existing[0].id); continue }
      userMap.set(source.id, source.id)
    }
    async function insert(table, row) {
      const columns = Object.keys(row)
      const keys = primaryKeys.get(table)
      if (!keys?.length) throw new Error(`Missing primary key in ${table}`)
      const result = await client.query(`INSERT INTO public.${quote(table)} (${columns.map(quote).join(',')}) VALUES (${columns.map((_, i) => `$${i + 1}`).join(',')}) RETURNING ${keys.map(quote).join(',')}`, columns.map(column => row[column]))
      ;(insertedKeys[table] ??= []).push(result.rows[0])
      inserted[table] = (inserted[table] ?? 0) + 1
      ;(expectedRows[table] ??= []).push(row)
    }
    for (const table of TABLES) {
      inserted[table] = 0
      for (const source of blocks.get(table).rows) {
        const row = { ...source }
        if (table === 'user_roles') {
          const existing = await client.query('SELECT id FROM public.user_roles WHERE lower(trim(email))=$1', [row.email.trim().toLowerCase()])
          if (existing.rowCount) continue
          row.email = row.email.trim().toLowerCase()
          row.role = 'student' // Local reference only. No SMZ admission or role grant.
        }
        // Legacy creator/audit references are not all backed by foreign keys.
        const userColumns = new Set([
          ...foreignKeys.filter(fk => fk.table_name === table).map(fk => fk.column_name),
          ...['created_by', 'updated_by', 'added_by', 'author_id', 'last_edited_by', 'deleted_by', 'uploaded_by', 'parent_id', 'teacher_id', 'user_id'].filter(column => column in row),
        ])
        for (const column of userColumns) {
          const old = row[column]
          if (old === null || old === undefined) continue
          if (!userMap.has(old)) throw new Error(`Unmapped source user reference in ${table}.${column}`)
          row[column] = userMap.get(old)
        }
        if (table === 'email_templates') row.current_revision_id = null
        await insert(table, row)
      }
    }
    // Resolve the nullable template/revision cycle with constraints enabled.
    for (const source of blocks.get('email_templates').rows) {
      if (source.current_revision_id !== null) {
        await client.query('UPDATE public.email_templates SET current_revision_id=$1 WHERE id=$2', [source.current_revision_id, source.id])
        expectedRows.email_templates.find(row => row.id === source.id).current_revision_id = source.current_revision_id
      }
    }
    // PostgreSQL casts the expected values to real column types before comparison.
    for (const [table, rows] of Object.entries(expectedRows)) {
      for (const row of rows) {
        const columns = Object.keys(row).filter(column => !(table === 'email_templates' && column === 'updated_at'))
        const { rows: matches } = await client.query(`SELECT count(*)::int AS count FROM public.${quote(table)} actual WHERE ${columns.map((column, i) => `actual.${quote(column)} IS NOT DISTINCT FROM $${i + 1}`).join(' AND ')}`, columns.map(column => row[column]))
        if (matches[0].count !== 1) throw new Error(`Imported data mismatch in ${table}`)
      }
    }
    const after = await fingerprint(client)
    if (JSON.stringify(before.content.user_auth_identities) !== JSON.stringify(after.content.user_auth_identities)) throw new Error('Existing OIDC identity links changed')
    for (const table of TABLES) if (after.content[table].count !== before.content[table].count + inserted[table]) throw new Error(`Unexpected row count in ${table}`)
    const report = { sourceSha256: SOURCE_SHA256, destinationBeforeHash: beforeHash, before, after, inserted, insertedKeys, userIdMap: Object.fromEntries(userMap), reusedUsers: blocks.get('user_roles').rows.length - inserted.user_roles, outcome: commit ? 'committed' : 'rolled-back' }
    await client.query('INSERT INTO public.cms_data_migrations(id,source_sha256,manifest,backup_reference) VALUES($1,$2,$3::jsonb,$4)', [migrationId, SOURCE_SHA256, JSON.stringify(report), backupReference || 'dry-run-only'])
    await client.query(commit ? 'COMMIT' : 'ROLLBACK')
    return report
  } catch (error) { await client.query('ROLLBACK').catch(() => {}); throw error }
}
