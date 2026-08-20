import { beforeAll, describe, expect, it } from 'vitest'

import '#/env'
import { from } from '#/lib/query'
import WeekService from '#/services/WeekService'
import ArticleService from '#/services/ArticleService'

const hasDatabase = Boolean(process.env.DATABASE_URL)

describe.skipIf(!hasDatabase)('postgres query layer against local email_cms', () => {
  beforeAll(() => {
    expect(process.env.DATABASE_URL).toMatch(/55432|email_cms/)
  })

  it('reads newsletters through the query builder', async () => {
    const { data, error } = await from('newsletters').select('id, week_number, status').limit(5)
    expect(error).toBeNull()
    expect(Array.isArray(data)).toBe(true)
    expect((data ?? []).length).toBeGreaterThan(0)
  })

  it('joins newsletter_articles to articles', async () => {
    const newsletter = await WeekService.getWeek('2025-W47')
    const articles = await ArticleService.getArticlesByWeek(newsletter.id, { excludeDeleted: true })
    expect(Array.isArray(articles)).toBe(true)
  })
})
