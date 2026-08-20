import type { ViewerRole } from '#/auth'
import type { ArticleRow, NewsletterRow } from '#/types/database'

export interface ReaderViewer {
  id: string
  role: ViewerRole
  classIds: string[]
}

export function canViewNewsletter(
  newsletter: Pick<NewsletterRow, 'status'>,
  viewer: ReaderViewer | null,
): boolean {
  if (newsletter.status === 'published') return true
  return viewer?.role === 'admin' || viewer?.role === 'teacher'
}

export function canViewArticle(
  article: Pick<ArticleRow, 'status' | 'deleted_at' | 'visibility_type' | 'restricted_to_classes'>,
  viewer: ReaderViewer | null,
): boolean {
  if (article.deleted_at) return false

  if (viewer?.role === 'admin') return true

  if (article.status !== 'published') return false
  if (article.visibility_type === 'public') return true
  if (article.visibility_type !== 'class_restricted') return false

  const restrictedTo = article.restricted_to_classes ?? []
  if (restrictedTo.length === 0) return false
  if (!viewer) return false
  if (viewer.role !== 'teacher' && viewer.role !== 'parent') return false

  return restrictedTo.some((classId) => viewer.classIds.includes(classId))
}
