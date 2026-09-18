import { beforeAll, describe, expect, it } from 'vitest'
import { randomUUID } from 'node:crypto'

import '#/env'
import { withTransaction } from '#/lib/db'
import { from } from '#/lib/query'
import WeekService from '#/services/WeekService'
import ArticleService from '#/services/ArticleService'

function isLocalEmailCmsDatabase(value: string | undefined): boolean {
  if (!value) return false
  try {
    const url = new URL(value)
    return ['localhost', '127.0.0.1'].includes(url.hostname) && url.port === '55440' && url.pathname === '/email_cms'
  } catch {
    return false
  }
}

describe.skipIf(!isLocalEmailCmsDatabase(process.env.DATABASE_URL))('postgres query layer against local email_cms', () => {
  beforeAll(() => expect(isLocalEmailCmsDatabase(process.env.DATABASE_URL)).toBe(true))

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

  it('round-trips JSONB blocks without coercing native SQL arrays', async () => {
    const revisionId = randomUUID()
    let articleId: string | undefined
    let originalClassIds: string[] | null | undefined
    const rollbackSentinel = new Error('rollback query-layer regression transaction')

    try {
      await withTransaction(async () => {
        const templateResult = await from('email_templates').select('id').limit(1)
        const templateId = (templateResult.data?.[0] as { id?: string } | undefined)?.id
        expect(templateId).toBeTruthy()
        if (!templateId) throw new Error('local email_cms has no template fixture')

        const latestRevisionResult = await from('email_template_revisions')
          .select('revision_number')
          .eq('template_id', templateId)
          .order('revision_number', { ascending: false })
          .limit(1)
          .maybeSingle()
        const latestRevisionNumber = Number((latestRevisionResult.data as { revision_number?: number } | null)?.revision_number ?? 0)
        const blocks = [{ type: 'custom-html', order: 0, visible: true, bodyHtml: '<p>Round trip</p>', config: {} }]
        const revisionResult = await from('email_template_revisions')
          .insert({
            id: revisionId,
            template_id: templateId,
            revision_number: latestRevisionNumber + 1,
            subject_template: 'Round trip',
            body_template: '<p>Round trip</p>',
            blocks,
          })
          .select('id, blocks')
          .single()
        expect(revisionResult.error).toBeNull()
        expect((revisionResult.data as { blocks: unknown }).blocks).toEqual(blocks)

        const articleResult = await from('articles').select('id, class_ids').limit(1)
        articleId = (articleResult.data?.[0] as { id?: string } | undefined)?.id
        expect(articleId).toBeTruthy()
        if (!articleId) throw new Error('local email_cms has no article fixture')
        const originalArticleResult = await from('articles')
          .select('class_ids')
          .eq('id', articleId)
          .single()
        expect(originalArticleResult.error).toBeNull()
        originalClassIds = (originalArticleResult.data as { class_ids: string[] | null }).class_ids

        const updateResult = await from('articles')
          .update({ class_ids: ['native-array-roundtrip'] })
          .eq('id', articleId)
          .select('class_ids')
          .single()
        expect(updateResult.error).toBeNull()
        expect((updateResult.data as { class_ids: string[] }).class_ids).toEqual(['native-array-roundtrip'])

        throw rollbackSentinel
      })
      throw new Error('query-layer regression transaction unexpectedly committed')
    } catch (error) {
      if (error !== rollbackSentinel) throw error
    }

    const persistedRevisionResult = await from('email_template_revisions')
      .select('id')
      .eq('id', revisionId)
      .maybeSingle()
    expect(persistedRevisionResult.error).toBeNull()
    expect(persistedRevisionResult.data).toBeNull()

    expect(articleId).toBeTruthy()
    if (!articleId) throw new Error('article fixture id was not captured')
    const persistedArticleResult = await from('articles')
      .select('class_ids')
      .eq('id', articleId)
      .single()
    expect(persistedArticleResult.error).toBeNull()
    expect((persistedArticleResult.data as { class_ids: string[] | null }).class_ids).toEqual(originalClassIds)
  })
})
