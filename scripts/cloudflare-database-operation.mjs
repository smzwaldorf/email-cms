// Used only by a short-lived, authenticated deployment preview.
export async function verifyDatabase(client, { initialize = false, schema = '', expectedDatabase = 'smz-cms' } = {}) {
  const identity = await client.query('SELECT current_database() AS name')
  if (identity.rows[0]?.name !== expectedDatabase) throw new Error('Wrong logical database')
  if (initialize) {
    try {
      await client.query('BEGIN')
      await client.query("SELECT pg_advisory_xact_lock(hashtext('cms-schema-bootstrap'))")
      const { rows } = await client.query("SELECT tablename FROM pg_tables WHERE schemaname = 'public'")
      if (rows.length) throw new Error('Refusing initialization: public schema already contains tables')
      if (!schema) throw new Error('Missing schema')
      await client.query(schema)
      await client.query('COMMIT')
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {})
      throw error
    }
  }
  await client.query('SELECT id FROM public.newsletters LIMIT 0')
  await client.query('SELECT id FROM public.newsletter_delivery_jobs LIMIT 0')
  return { database: expectedDatabase, schema: 'verified', initialized: initialize }
}

// This is intentionally only called by the separately guarded production-reset
// script. Keeping the database identity check beside the destructive query makes
// it impossible for a caller to clear tables on an arbitrary Hyperdrive target.
export async function resetDatabase(client, { expectedDatabase } = {}) {
  const identity = await client.query('SELECT current_database() AS name')
  if (identity.rows[0]?.name !== expectedDatabase) throw new Error('Wrong logical database')
  try {
    await client.query('BEGIN')
    await client.query("SELECT pg_advisory_xact_lock(hashtext('cms-production-reset'))")
    // The managed production role owns application tables but not the public
    // schema. Retaining the reviewed schema and migration ledger also prevents
    // historical migrations from being reapplied to an already-current schema.
    const { rows } = await client.query("SELECT quote_ident(schemaname) || '.' || quote_ident(tablename) AS relation FROM pg_tables WHERE schemaname = 'public' AND tablename <> 'cms_schema_migrations' ORDER BY tablename")
    if (!rows.length) throw new Error('Production News schema contains no application tables')
    await client.query(`TRUNCATE TABLE ${rows.map(row => row.relation).join(', ')} RESTART IDENTITY CASCADE`)
    await client.query('COMMIT')
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {})
    throw error
  }
}
