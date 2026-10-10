import { describe, expect, it } from 'vitest'
import '#/env'
import { poolFor } from '#/cloudflare/databasePool'
import { query, withClient, withDatabasePool, withTransaction } from '#/lib/db'

const url = new URL(process.env.DATABASE_URL ?? 'postgres://localhost/missing')
const local = ['localhost', '127.0.0.1'].includes(url.hostname) && url.port === '55440' && url.pathname === '/email_cms'

describe.skipIf(!local)('staging connection reuse against local PostgreSQL', () => {
  it('queues concurrent queries on one connection and reuses a held client without deadlocking', async () => {
    const pool = poolFor({ HYPERDRIVE: { connectionString: url.toString() }, MEDIA_STORAGE_ENVIRONMENT: 'staging' })
    try {
      const pids = await withDatabasePool(pool, async () => {
        const results = await Promise.all(Array.from({ length: 20 }, () => query('SELECT pg_backend_pid() AS pid, pg_sleep(0.005)')))
        await withClient(async client => {
          const held = await client.query('SELECT pg_backend_pid() AS pid')
          const nested = await query('SELECT pg_backend_pid() AS pid')
          expect(nested.rows[0].pid).toBe(held.rows[0].pid)
          await withTransaction(async () => { await query('SELECT 1') })
        })
        return results.map(result => result.rows[0].pid)
      })
      expect(new Set(pids).size).toBe(1)
      expect(pool.totalCount).toBe(1)
      expect(pool.idleCount).toBe(1)
      expect(pool.waitingCount).toBe(0)
    } finally { await pool.end() }
  })
})
