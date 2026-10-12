import { beforeEach, describe, expect, it, vi } from 'vitest'
const m = vi.hoisted(() => ({ clientQuery: vi.fn(), poolQuery: vi.fn(), release: vi.fn() }))
vi.mock('pg', () => ({ Pool: vi.fn(() => ({ query: m.poolQuery, connect: async () => ({ query: m.clientQuery, release: m.release }) })) }))
import { query, withClient, withTransaction } from '#/lib/db'
beforeEach(() => { vi.clearAllMocks(); process.env.DATABASE_URL = 'postgresql://fixture'; m.clientQuery.mockResolvedValue({ rows: [] }) })
describe('publish transaction routing', () => {
  it('reuses a checked-out connection for nested service queries', async () => {
    await withClient(async () => {
      await query('class aliases')
      await withClient(async () => { await query('nested read') })
    })
    expect(m.clientQuery.mock.calls.map(call => call[0])).toEqual(['class aliases', 'nested read'])
    expect(m.poolQuery).not.toHaveBeenCalled()
    expect(m.release).toHaveBeenCalledOnce()
    await query('outside')
    expect(m.poolQuery).toHaveBeenCalledWith('outside', [])
  })
  it('routes all service queries through one connection before commit', async () => {
    await withTransaction(async () => { await query('publish'); await query('batch'); await query('job') })
    expect(m.clientQuery.mock.calls.map(call => call[0])).toEqual(['BEGIN', 'publish', 'batch', 'job', 'COMMIT'])
    expect(m.poolQuery).not.toHaveBeenCalled()
    expect(m.release).toHaveBeenCalledOnce()
  })
  it('rolls back a failed enqueue and restores nontransaction query routing', async () => {
    await expect(withTransaction(async () => { await query('publish'); throw new Error('enqueue failure') })).rejects.toThrow('enqueue failure')
    expect(m.clientQuery.mock.calls.map(call => call[0])).toEqual(['BEGIN', 'publish', 'ROLLBACK'])
    await query('outside')
    expect(m.poolQuery).toHaveBeenCalledWith('outside', [])
    expect(m.release).toHaveBeenCalledOnce()
  })
})
