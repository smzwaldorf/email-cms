import { HttpError, type AuthenticatedViewer } from '#/auth'
import ArticleService, { ArticleServiceError } from '#/services/ArticleService'
import {
  canViewArticle,
  canViewNewsletter,
  type ReaderViewer,
} from '#/services/readerVisibility'
import WeekService, { WeekServiceError } from '#/services/WeekService'
import type { ArticleRow, NewsletterRow } from '#/types/database'

export interface ReaderWeekBundle {
  newsletter: NewsletterRow
  articles: ArticleRow[]
}

export type ReaderArticle = ArticleRow & {
  newsletter_id?: string
  week_number?: string
}

export async function resolveReaderViewer(
  viewer: AuthenticatedViewer | null,
): Promise<ReaderViewer | null> {
  if (!viewer) return null
  return {
    id: viewer.id,
    role: viewer.role,
    roles: viewer.roles,
    teacherClassIds: viewer.teacherClassIds,
    parentClassIds: viewer.parentClassIds,
    classIds: [...new Set([...viewer.teacherClassIds, ...viewer.parentClassIds])],
  }
}

export async function getWeekBundle(
  idOrWeek: string,
  viewer: AuthenticatedViewer | null,
): Promise<ReaderWeekBundle> {
  if (!idOrWeek.trim()) {
    throw new HttpError(400, 'Newsletter id or week number is required')
  }

  const reader = await resolveReaderViewer(viewer)

  let newsletter: NewsletterRow
  try {
    newsletter = await WeekService.getWeek(idOrWeek)
  } catch (error) {
    if (error instanceof WeekServiceError && error.code === 'WEEK_NOT_FOUND') {
      throw new HttpError(404, 'Newsletter not found')
    }
    if (error instanceof WeekServiceError) {
      throw new HttpError(404, 'Newsletter not found')
    }
    throw error
  }

  if (!canViewNewsletter(newsletter, reader)) {
    throw new HttpError(404, 'Newsletter not found')
  }

  const articles = (await ArticleService.getArticlesByWeek(idOrWeek, { excludeDeleted: true }))
    .filter((article) => canViewArticle(article, reader))

  return { newsletter, articles }
}

export async function getReaderArticle(
  articleId: string,
  newsletterId: string | undefined,
  viewer: AuthenticatedViewer | null,
): Promise<ReaderArticle> {
  if (!articleId.trim()) {
    throw new HttpError(400, 'Article id is required')
  }

  const reader = await resolveReaderViewer(viewer)

  let article: ReaderArticle
  try {
    article = await ArticleService.getArticleWithNewsletter(articleId, newsletterId)
  } catch (error) {
    if (error instanceof ArticleServiceError) {
      throw new HttpError(404, 'Article not found')
    }
    throw error
  }

  if (!canViewArticle(article, reader)) {
    throw new HttpError(404, 'Article not found')
  }

  return article
}

export const readerService = {
  getWeekBundle,
  getReaderArticle,
}
