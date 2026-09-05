/** CMS action policy; directory roles and class facts are supplied by SMZ Auth. */
export type CmsRole = 'admin' | 'teacher' | 'parent' | 'student'
export interface CmsActor {
  roles: readonly string[]
  teacherClassIds: readonly string[]
  parentClassIds: readonly string[]
}
export interface CmsArticle {
  status: string
  deleted_at?: string | null
  visibility_type?: string | null
  restricted_to_classes?: string[] | null
}
export const CMS_ACTIONS = ['cms:manage', 'newsletter:publish', 'email:deliver', 'article:view', 'article:edit', 'article:delete'] as const
export type CmsAction = typeof CMS_ACTIONS[number]
const roleOrder: CmsRole[] = ['admin', 'teacher', 'parent', 'student']
export function cmsRoles(roles: readonly string[]): CmsRole[] {
  return roleOrder.filter(role => roles.includes(role))
}
export function canPerformCmsAction(actor: CmsActor | null, action: string, article?: CmsArticle): boolean {
  if (!(CMS_ACTIONS as readonly string[]).includes(action)) return false
  const roles = cmsRoles(actor?.roles ?? [])
  if (article?.deleted_at) return false
  if (roles.includes('admin')) return true
  if (action === 'article:view') {
    if (!article || article.status !== 'published') return false
    if (article.visibility_type === 'public') return true
    if (article.visibility_type !== 'class_restricted') return false
    const scope = [
      ...(roles.includes('teacher') ? actor?.teacherClassIds ?? [] : []),
      ...(roles.includes('parent') ? actor?.parentClassIds ?? [] : []),
    ]
    return (article.restricted_to_classes ?? []).some(id => scope.includes(id))
  }
  if (action === 'article:edit') {
    if (!article || !roles.includes('teacher') || article.visibility_type !== 'class_restricted') return false
    const classes = article.restricted_to_classes ?? []
    // Editing shared content affects every target class: all must be taught by this actor.
    return classes.length > 0 && classes.every(id => actor?.teacherClassIds.includes(id))
  }
  return false
}
