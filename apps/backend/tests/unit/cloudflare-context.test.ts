import { describe, expect, it, vi } from 'vitest'
import type { Pool } from 'pg'
import { getPool, query, withDatabasePool, withTransaction } from '#/lib/db'
import { runtimeEnvironment, withRuntimeEnvironment } from '#/runtime/environment'
import templates from '#/generated/emailTemplates.json'
import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'

describe('Cloudflare invocation isolation', () => {
  it('isolates concurrent pools, transactions and environment', async () => {
    const results = await Promise.all(['first', 'second'].map(async name => {
      const client = { query: vi.fn(async () => ({ rows: [{ name }] })), release: vi.fn() }
      const pool = { query: client.query, connect: async () => client } as unknown as Pool
      return withRuntimeEnvironment({ APP_URL: name }, () => withDatabasePool(pool, async () => {
        await new Promise(resolve => setTimeout(resolve, name === 'first' ? 5 : 1))
        expect(getPool()).toBe(pool)
        const result = await withTransaction(async () => query('SELECT 1'))
        expect(client.release).toHaveBeenCalledOnce()
        expect(client.query.mock.calls.map(call => call[0])).toEqual(['BEGIN', 'SELECT 1', 'COMMIT'])
        return { value: runtimeEnvironment().APP_URL, row: result.rows[0].name }
      }))
    }))
    expect(results).toEqual([{ value: 'first', row: 'first' }, { value: 'second', row: 'second' }])
    expect(runtimeEnvironment()).toBe(process.env)
  })

  it('bundles exactly the original template files without content changes', () => {
    const root = path.resolve(__dirname, '../../templates/email')
    const original: Record<string, string> = {}
    function walk(dir: string) {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const file = path.join(dir, entry.name)
        if (entry.isDirectory()) walk(file)
        else if (/\.(json|hbs|html)$/i.test(entry.name)) original[`/templates/email/${path.relative(root, file).split(path.sep).join('/')}`] = readFileSync(file, 'utf8')
      }
    }
    walk(root)
    expect(templates).toEqual(original)
  })
})
