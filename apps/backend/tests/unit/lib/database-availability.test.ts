import { describe, expect, it, vi } from 'vitest'
import type { Pool } from 'pg'
import { withDatabasePool } from '#/lib/db'
import { from } from '#/lib/query'
import { isDatabaseBusy } from '#/lib/databaseAvailability'

describe('database availability', () => {
  it('preserves exhaustion as a failure rather than a successful query result', async () => {
    const error = Object.assign(new Error('connection budget exhausted'), { code: '53300' })
    const execute = vi.fn().mockRejectedValue(error)
    await expect(withDatabasePool({ query: execute } as unknown as Pool, async () => await from('articles').select('id'))).rejects.toBe(error)
    expect(execute).toHaveBeenCalledOnce()
  })
  it('recognizes wrapped exhaustion without misclassifying unrelated errors', () => {
    expect(isDatabaseBusy(new Error('provider failed', { cause: { code: '53300' } }))).toBe(true)
    expect(isDatabaseBusy({ originalError: { code: '53300' } })).toBe(true)
    expect(isDatabaseBusy(new Error('Failed to list email templates: remaining connection slots are reserved for roles with the SUPERUSER attribute'))).toBe(true)
    expect(isDatabaseBusy({ code: '23505', message: 'duplicate key' })).toBe(false)
    const cyclic: { cause?: unknown } = {}
    cyclic.cause = cyclic
    expect(isDatabaseBusy(cyclic)).toBe(false)
  })
})
