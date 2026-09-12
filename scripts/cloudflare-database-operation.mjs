// Used only by a short-lived, authenticated deployment preview.
export async function verifyDatabase(client, { initialize = false, schema = '' } = {}) {
  const identity = await client.query('SELECT current_database() AS name')
  if (identity.rows[0]?.name !== 'smz-cms') throw new Error('Wrong logical database')
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
  return { database: 'smz-cms', schema: 'verified', initialized: initialize }
}
