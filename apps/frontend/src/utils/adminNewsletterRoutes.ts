import { isValidWeekNumber } from '@/utils/urlUtils'

export interface AdminNewsletterRouteTarget {
  id: string
  weekNumber?: string | null
}

export function hasWeeklyNewsletterRoute(weekNumber?: string | null): boolean {
  return typeof weekNumber === 'string' && isValidWeekNumber(weekNumber)
}

export function getAdminNewsletterPath(target: AdminNewsletterRouteTarget): string {
  return hasWeeklyNewsletterRoute(target.weekNumber)
    ? `/admin/newsletters/${target.weekNumber}`
    : `/admin/newsletters/id/${target.id}`
}

export function getAdminArticleEditorPath(
  target: AdminNewsletterRouteTarget & { articleId: string }
): string {
  return hasWeeklyNewsletterRoute(target.weekNumber)
    ? `/admin/articles/${target.weekNumber}/${target.articleId}`
    : `/admin/articles/id/${target.id}/${target.articleId}`
}
