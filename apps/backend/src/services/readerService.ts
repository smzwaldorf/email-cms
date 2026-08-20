import { HttpError, type AuthenticatedViewer } from '#/auth'
import { getSupabaseClient } from '#/lib/supabase'
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

async function loadClassIds(viewer: AuthenticatedViewer): Promise<string[]> {
  const supabase = getSupabaseClient()

  if (viewer.role === 'teacher') {
    const { data, error } = await supabase
      .from('teacher_class_assignment')
      .select('class_id')
      .eq('teacher_id', viewer.id)
    if (error) {
      throw new HttpError(500, `Failed to load teacher class assignments: ${error.message}`)
    }
    return Array.from(new Set((data ?? []).map((row) => String(row.class_id))))
  }

  if (viewer.role === 'parent') {
    const { data: families, error: familyError } = await supabase
      .from('family_enrollment')
      .select('family_id')
      .eq('parent_id', viewer.id)
    if (familyError) {
      throw new HttpError(500, `Failed to load parent families: ${familyError.message}`)
    }

    const familyIds = (families ?? []).map((row) => String(row.family_id))
    if (familyIds.length === 0) return []

    const { data: enrollments, error: enrollmentError } = await supabase
      .from('student_class_enrollment')
      .select('class_id')
      .in('family_id', familyIds)
      .is('graduated_at', null)
    if (enrollmentError) {
      throw new HttpError(500, `Failed to load child class enrollments: ${enrollmentError.message}`)
    }

    return Array.from(new Set((enrollments ?? []).map((row) => String(row.class_id))))
  }

  return []
}

export async function resolveReaderViewer(
  viewer: AuthenticatedViewer | null,
): Promise<ReaderViewer | null> {
  if (!viewer) return null
  return {
    id: viewer.id,
    role: viewer.role,
    classIds: await loadClassIds(viewer),
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
