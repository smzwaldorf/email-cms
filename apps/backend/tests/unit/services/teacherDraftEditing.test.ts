import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AuthenticatedViewer } from '#/auth'
import type { ArticleRow } from '#/types/database'
import { canPerformCmsAction } from '@email-cms/shared'
import { withArticleEditorialScope, type ArticlePlacement } from '#/services/articleEditorialScope'

const execute = vi.hoisted(() => vi.fn())
vi.mock('#/lib/db', () => ({ withClient: (run: (client: { query: typeof execute }) => unknown) => run({ query: execute }) }))
import { cmsArticleService } from '#/services/cmsArticleService'

const teacher = { id: 'teacher', roles: ['teacher'], teacherClassIds: ['A'], parentClassIds: [] } as unknown as AuthenticatedViewer
let article: ArticleRow
let placements: ArticlePlacement[]
beforeEach(() => {
  article = { id: 'draft', title: 'Draft title', content: '<p>Draft content</p>', status: 'draft', visibility_type: 'public', restricted_to_classes: null } as ArticleRow
  placements = [{ article_id: 'draft', targeting_mode: 'targeted', target_class_ids: ['A'] }]
  execute.mockReset().mockImplementation(async (sql: string, values: unknown[] = []) => {
    if (sql.startsWith('SELECT * FROM articles')) return { rows: [article] }
    if (sql.includes('FROM newsletter_articles')) return { rows: placements }
    if (sql.startsWith('UPDATE articles')) { article = { ...article, title: values[1] as string }; return { rows: [article] } }
    return { rows: [] }
  })
})

describe('teacher draft editing', () => {
  it('opens and saves an assigned class draft without publishing or changing its reader visibility', async () => {
    const draft = await cmsArticleService.read('draft', teacher)
    expect(draft).toMatchObject({ status: 'draft', visibility_type: 'public', teacher_edit_class_ids: ['A'] })
    expect(canPerformCmsAction(teacher, 'article:edit', draft)).toBe(true)
    const updated = await cmsArticleService.update('draft', { title: 'Teacher revision' }, teacher)
    expect(updated).toMatchObject({ title: 'Teacher revision', status: 'draft', visibility_type: 'public' })
    const update = execute.mock.calls.find(([sql]) => sql.startsWith('UPDATE articles'))
    expect(update?.[0]).not.toMatch(/\bstatus\s*=|\bvisibility_type\s*=/)
    expect(execute).toHaveBeenCalledWith(expect.stringContaining('newsletter_articles WHERE article_id = $1 FOR SHARE'), ['draft'])
  })
  it('rejects edits when any other newsletter uses the article for an unassigned class', async () => {
    placements.push({ article_id: 'draft', targeting_mode: 'targeted', target_class_ids: ['B'] })
    await expect(cmsArticleService.read('draft', teacher)).rejects.toMatchObject({ status: 404 })
    await expect(cmsArticleService.update('draft', { title: 'Denied' }, teacher)).rejects.toMatchObject({ status: 403 })
    expect(execute.mock.calls.some(([sql]) => sql.startsWith('UPDATE articles'))).toBe(false)
    expect(execute).toHaveBeenCalledWith('ROLLBACK')
  })
  it('allows a teacher who teaches all targeted classes to edit the shared draft', async () => {
    placements.push({ article_id: 'draft', targeting_mode: 'targeted', target_class_ids: ['B'] })
    const allClasses = { ...teacher, teacherClassIds: ['A', 'B'] }
    expect(await cmsArticleService.update('draft', { title: 'Shared revision' }, allClasses)).toMatchObject({ status: 'draft', teacher_edit_class_ids: ['A', 'B'] })
  })
  it.each(['shared', 'empty', 'null', 'missing', 'unlinked'])('does not grant editing for a %s public draft', async kind => {
    placements = kind === 'unlinked' ? [] : [{ article_id: 'draft', targeting_mode: kind === 'shared' ? 'shared' : 'targeted', target_class_ids: kind === 'null' ? null : kind === 'missing' ? undefined : [] }]
    await expect(cmsArticleService.update('draft', { title: 'Denied' }, teacher)).rejects.toMatchObject({ status: 403 })
  })
  it('does not use parent-only classes, stale browser scope or caller-supplied roles as write authority', async () => {
    const parent = { ...teacher, roles: ['parent'], parentClassIds: ['A'] }
    await expect(cmsArticleService.read('draft', parent)).rejects.toMatchObject({ status: 404 })
    await expect(cmsArticleService.update('draft', { title: 'Denied' }, parent)).rejects.toMatchObject({ status: 403 })
    await expect(cmsArticleService.update('draft', { title: 'Denied', teacher_edit_class_ids: ['A'] }, teacher)).rejects.toMatchObject({ status: 400 })
    await expect(cmsArticleService.update('draft', { title: 'Denied' }, { ...teacher, teacherClassIds: [] })).rejects.toMatchObject({ status: 403 })
  })
  it('preserves the publication boundary and restricted-article editing policy', () => {
    article.status = 'published'
    expect(canPerformCmsAction(teacher, 'article:edit', withArticleEditorialScope(article, placements))).toBe(false)
    article.visibility_type = 'class_restricted'; article.restricted_to_classes = ['A']
    expect(canPerformCmsAction(teacher, 'article:edit', withArticleEditorialScope(article, placements))).toBe(true)
    expect(canPerformCmsAction(teacher, 'newsletter:publish')).toBe(false)
  })
  it('requires both reader restrictions and additional targeted classes for restricted article edits', async () => {
    article.visibility_type = 'class_restricted'; article.restricted_to_classes = ['A']
    placements = [{ article_id: 'draft', targeting_mode: 'targeted', target_class_ids: ['B'] }]
    await expect(cmsArticleService.update('draft', { title: 'Denied' }, teacher)).rejects.toMatchObject({ status: 403 })
    expect(canPerformCmsAction({ ...teacher, teacherClassIds: ['A', 'B'] }, 'article:edit', withArticleEditorialScope(article, placements))).toBe(true)
  })
})
