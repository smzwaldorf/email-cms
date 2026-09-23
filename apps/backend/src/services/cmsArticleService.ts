import { canPerformCmsAction } from '@email-cms/shared'
import { HttpError, type AuthenticatedViewer } from '#/auth'
import { withClient } from '#/lib/db'
import type { ArticleRow } from '#/types/database'

function permitted(viewer: AuthenticatedViewer, article: ArticleRow): boolean {
  return canPerformCmsAction(viewer, 'article:view', article) || canPerformCmsAction(viewer, 'article:edit', article)
}

export const cmsArticleService = {
  async publish(id: string, viewer: AuthenticatedViewer): Promise<ArticleRow> {
    if (!canPerformCmsAction(viewer, 'cms:manage')) throw new HttpError(403, 'CMS management permission required')
    return withClient(async client => {
      const { rows } = await client.query<ArticleRow>(
        `UPDATE articles SET status = 'published', published_at = COALESCE(published_at, now()),
          updated_at = now(), last_edited_by = $2
         WHERE id = $1 AND deleted_at IS NULL RETURNING *`,
        [id, viewer.id],
      )
      if (!rows[0]) throw new HttpError(404, 'Active article not found')
      return rows[0]
    })
  },
  async read(id: string, viewer: AuthenticatedViewer): Promise<ArticleRow> {
    return withClient(async client => {
      const { rows } = await client.query<ArticleRow>('SELECT * FROM articles WHERE id = $1', [id])
      if (!rows[0] || !permitted(viewer, rows[0])) throw new HttpError(404, 'Article not found')
      return rows[0]
    })
  },
  async update(id: string, body: unknown, viewer: AuthenticatedViewer): Promise<ArticleRow> {
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new HttpError(400, 'Invalid article update')
    const fields = Object.entries(body)
    const allowed = ['title', 'summary', 'content', 'author']
    if (!fields.length || fields.some(([key, value]) => !allowed.includes(key) || typeof value !== 'string')) {
      throw new HttpError(400, 'Only title, summary, content and author text may be edited here')
    }
    if ('title' in body && !(body.title as string).trim()) throw new HttpError(400, 'Title is required')
    return withClient(async client => {
      await client.query('BEGIN')
      try {
        const { rows } = await client.query<ArticleRow>('SELECT * FROM articles WHERE id = $1 FOR UPDATE', [id])
        if (!rows[0]) throw new HttpError(404, 'Article not found')
        if (!canPerformCmsAction(viewer, 'article:edit', rows[0])) throw new HttpError(403, 'Article edit permission required')
        const assignments = fields.map(([key], index) => `"${key}" = $${index + 2}`)
        const result = await client.query<ArticleRow>(
          `UPDATE articles SET ${assignments.join(', ')}, updated_at = now(), last_edited_by = $${fields.length + 2} WHERE id = $1 RETURNING *`,
          [id, ...fields.map(([, value]) => value), viewer.id],
        )
        await client.query('COMMIT')
        return result.rows[0]
      } catch (error) {
        await client.query('ROLLBACK')
        throw error
      }
    })
  },
}
