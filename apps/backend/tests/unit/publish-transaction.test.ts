import { describe, expect, it, vi } from 'vitest'
import type { Pool } from 'pg'
import { inTransaction, query, withDatabasePool, withTransaction } from '#/lib/db'
function fixture() {
 const execute = vi.fn().mockResolvedValue({ rows: [] })
 const release = vi.fn()
 const pool = { connect: vi.fn().mockResolvedValue({ query: execute, release }) } as unknown as Pool
 return { execute, release, pool }
}
describe('publication transaction scope', () => {
 it('shares the existing publish-and-deliver connection without nested transactions', async () => {
  const { pool, execute, release } = fixture()
  await withDatabasePool(pool, () => withTransaction(async () => {
   await inTransaction(async () => { await query('article publication') })
   await query('delivery enqueue')
  }))
  expect(execute.mock.calls.map(([sql]) => sql)).toEqual(['BEGIN', 'article publication', 'delivery enqueue', 'COMMIT'])
  expect(release).toHaveBeenCalledTimes(1)
 })
 it('rolls back article publication when standalone publish-and-deliver fails', async () => {
  const { pool, execute, release } = fixture()
  await expect(withDatabasePool(pool, () => inTransaction(async () => {
   await inTransaction(async () => { await query('article publication'); await query('newsletter publication') })
   throw new Error('enqueue failed')
  }))).rejects.toThrow('enqueue failed')
  expect(execute.mock.calls.map(([sql]) => sql)).toEqual(['BEGIN', 'article publication', 'newsletter publication', 'ROLLBACK'])
  expect(release).toHaveBeenCalledTimes(1)
 })
})
