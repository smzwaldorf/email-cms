import { canPerformCmsAction, type CmsActor } from '@email-cms/shared'
import type { ViewerRole } from '#/auth'
import type { ArticleRow, NewsletterRow } from '#/types/database'

export interface ReaderViewer extends CmsActor {
  id: string
  role: ViewerRole | null
  classIds: string[]
}
export function canViewNewsletter(newsletter: Pick<NewsletterRow, 'status'>, viewer: ReaderViewer | null): boolean {
  return newsletter.status === 'published' || !!viewer?.roles.some(role => role === 'admin' || role === 'teacher')
}
export function canViewArticle(
  article: Pick<ArticleRow, 'status' | 'deleted_at' | 'visibility_type' | 'restricted_to_classes'>,
  viewer: ReaderViewer | null,
): boolean {
  return canPerformCmsAction(viewer, 'article:view', article)
}
