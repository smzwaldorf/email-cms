import { describe, expect, it } from 'vitest'

import '#/env'
import { runSerializedQuery } from '#/lib/query'

const hasDatabase = Boolean(process.env.DATABASE_URL)

describe.skipIf(!hasDatabase)('runSerializedQuery', () => {
  it('selects published newsletters', async () => {
    const result = await runSerializedQuery({
      table: 'newsletters',
      select: 'id, week_number, status',
      filters: [{ op: 'eq', column: 'week_number', value: '2025-W47' }],
      single: 'maybe',
    })
    expect(result.error).toBeNull()
    expect(result.data).toMatchObject({ week_number: '2025-W47', status: 'published' })
  })

  it('joins newsletter articles', async () => {
    const result = await runSerializedQuery({
      table: 'newsletter_articles',
      select: 'article_order, articles!inner (*)',
      filters: [{ op: 'eq', column: 'newsletter_id', value: 'f0470000-0000-0000-0000-000000000047' }],
      orders: [{ column: 'article_order', ascending: true }],
    })
    expect(result.error).toBeNull()
    expect(Array.isArray(result.data)).toBe(true)
    expect((result.data as { articles?: { title?: string } }[]).length).toBeGreaterThan(0)
  })
})
