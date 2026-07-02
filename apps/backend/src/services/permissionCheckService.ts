import { getSupabaseClient } from '#/lib/supabase'

export type PermissionAction = 'view' | 'edit' | 'delete' | 'admin'
export type PermissionResource = string

export interface PermissionCheckResult {
  allowed: boolean
  reason?: string
}

export const permissionCheckService = {
  async checkPermission(
    userId: string,
    action: PermissionAction,
    resource: PermissionResource,
  ): Promise<PermissionCheckResult> {
    try {
      const supabase = getSupabaseClient()
      const { data: roleData, error: roleError } = await supabase
        .from('user_roles')
        .select('role')
        .eq('id', userId)
        .single()

      if (roleError || !roleData) {
        return { allowed: false, reason: 'User role not found' }
      }

      const userRole = roleData.role
      if (userRole === 'admin') {
        return { allowed: true }
      }

      const [resourceType, resourceId] = resource.split(':')
      if ((resourceType === 'admin' || resourceType === 'users') && ['admin', 'edit', 'delete'].includes(action)) {
        return { allowed: false, reason: `Only admins can ${action} ${resourceType}` }
      }

      if (resourceType === 'article' && resourceId) {
        const { data: article, error: articleError } = await supabase
          .from('articles')
          .select('id, visibility_type, restricted_to_classes, status, is_published')
          .eq('id', resourceId)
          .single()

        if (articleError || !article) {
          return { allowed: false, reason: 'Article not found' }
        }

        if (action === 'view') {
          const published = article.status === 'published' || article.is_published === true
          if (!published) {
            return { allowed: false, reason: 'Article not published' }
          }
          if (article.visibility_type === 'public') {
            return { allowed: true }
          }
          if (article.visibility_type === 'class_restricted') {
            return { allowed: true }
          }
        }

        if (action === 'edit' && userRole === 'teacher') {
          if (article.visibility_type === 'public') {
            return { allowed: false, reason: 'Teachers cannot edit public articles' }
          }

          const restrictedClasses = Array.isArray(article.restricted_to_classes)
            ? article.restricted_to_classes
            : []
          const { data: teacherClasses } = await supabase
            .from('teacher_class_assignment')
            .select('class_id')
            .eq('teacher_id', userId)

          const hasAccess = (teacherClasses ?? []).some((row) => restrictedClasses.includes(row.class_id))
          return hasAccess
            ? { allowed: true }
            : { allowed: false, reason: 'Teacher does not teach any of the restricted classes' }
        }

        if (action === 'delete') {
          return { allowed: false, reason: 'Only admins can delete articles' }
        }
      }

      return { allowed: false, reason: `${userRole} cannot ${action} ${resource}` }
    } catch (error) {
      console.error('Permission check error:', error)
      return {
        allowed: false,
        reason: `Permission check failed: ${error instanceof Error ? error.message : String(error)}`,
      }
    }
  },
}
