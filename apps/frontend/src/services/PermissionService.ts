import { canPerformCmsAction, cmsRoles, type CmsActor } from '@email-cms/shared'
import { requestBackend } from '@/services/backendClient'
import type { ArticleRow } from '@/types/database'

export class PermissionError extends Error {
  constructor(message: string, public code = 'PERMISSION_DENIED') {
    super(message)
    this.name = 'PermissionError'
  }
}
// Retained compatibility entry point; directory permissions are never cached here.
export function clearPermissionCache(): void {}
async function actorFor(userId: string): Promise<CmsActor | null> {
  try {
    const { user } = await requestBackend<{ user: CmsActor & { id: string } }>('/api/auth/session')
    return user.id === userId ? user : null
  } catch { return null }
}
export class PermissionService {
  static async getUserRoles(userId: string) { return cmsRoles((await actorFor(userId))?.roles ?? []) }
  static async getUserRole(userId: string): Promise<string | null> { return (await this.getUserRoles(userId))[0] ?? null }
  static async getTeacherClasses(userId: string): Promise<string[]> { return [...((await actorFor(userId))?.teacherClassIds ?? [])] }
  static async canEditArticle(userId: string, article: ArticleRow): Promise<boolean> {
    return canPerformCmsAction(await actorFor(userId), 'article:edit', article)
  }
  static async canDeleteArticle(userId: string, article: ArticleRow): Promise<boolean> {
    return canPerformCmsAction(await actorFor(userId), 'article:delete', article)
  }
  static async canViewArticle(userId: string, article: ArticleRow): Promise<boolean> {
    return canPerformCmsAction(await actorFor(userId), 'article:view', article)
  }
  static async assertCanEditArticle(userId: string, article: ArticleRow): Promise<void> {
    if (!await this.canEditArticle(userId, article)) throw new PermissionError('Article edit permission required', 'EDIT_NOT_ALLOWED')
  }
  static async assertCanDeleteArticle(userId: string, article: ArticleRow): Promise<void> {
    if (!await this.canDeleteArticle(userId, article)) throw new PermissionError('Article delete permission required', 'DELETE_NOT_ALLOWED')
  }
}
export default PermissionService
