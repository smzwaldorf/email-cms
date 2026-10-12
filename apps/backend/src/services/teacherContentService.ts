import { canPerformCmsAction } from '@email-cms/shared'
import { HttpError, type AuthenticatedViewer } from '#/auth'
import { getSupabaseClient } from '#/lib/supabase'
import type { ArticleRow } from '#/types/database'
import { withArticleEditorialScope } from './articleEditorialScope'

export function teacherCanReadArticle(viewer: AuthenticatedViewer, article: ArticleRow): boolean {
  return canPerformCmsAction(viewer, 'article:view', article) || canPerformCmsAction(viewer, 'article:edit', article)
}

export const teacherContentService = {
  async newsletters() {
    const { data, error } = await getSupabaseClient().from('newsletters').select('*').eq('is_template', false).order('release_date', { ascending: false })
    if (error) throw new HttpError(500, error.message)
    return data ?? []
  },
  async articles(viewer: AuthenticatedViewer) {
    const { data, error } = await getSupabaseClient().from('articles').select('*').is('deleted_at', null).order('updated_at', { ascending: false })
    if (error) throw new HttpError(500, error.message)
    if (!data?.length) return []
    const placements = await getSupabaseClient().from('newsletter_articles').select('article_id, targeting_mode, target_class_ids').in('article_id', data.map(row => row.id))
    if (placements.error) throw new HttpError(503, 'Article class assignments unavailable')
    return data.map(article => withArticleEditorialScope(article, placements.data ?? [])).filter(article => teacherCanReadArticle(viewer, article))
  },
  async newsletter(idOrWeek: string, viewer: AuthenticatedViewer) {
    const newsletters = await this.newsletters()
    const newsletter = newsletters.find(row => row.id === idOrWeek || row.week_number === idOrWeek)
    if (!newsletter) throw new HttpError(404, 'Newsletter not found')
    const { data, error } = await getSupabaseClient().from('newsletter_articles').select('article_id, article_order').eq('newsletter_id', newsletter.id).order('article_order', { ascending: true })
    if (error) throw new HttpError(500, error.message)
    const articles = await this.articles(viewer)
    return { newsletter, articles: (data ?? []).flatMap(link => articles.filter(article => article.id === link.article_id)) }
  },
}
