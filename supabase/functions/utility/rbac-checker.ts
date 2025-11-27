/**
 * RBAC Permission Checker Utility
 * Provides checkPermission(userId, action, resource) for server-side authorization
 *
 * Actions:
 * - 'view': Can view resource (article, class data, etc.)
 * - 'edit': Can edit resource (article, user role, etc.)
 * - 'delete': Can delete resource
 * - 'admin': Requires admin access
 *
 * Resources:
 * - 'article:{id}': Specific article
 * - 'articles': All articles
 * - 'admin': Admin panel/functions
 * - 'users': User management
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const supabase = createClient(supabaseUrl, supabaseKey)

export type PermissionAction = 'view' | 'edit' | 'delete' | 'admin'
export type PermissionResource = string // e.g., 'article:123', 'admin', 'users'

interface PermissionCheckResult {
  allowed: boolean
  reason?: string
}

/**
 * Check if a user has permission to perform an action on a resource
 * @param userId User ID from Supabase Auth
 * @param action Action to perform (view, edit, delete, admin)
 * @param resource Resource identifier (e.g., 'article:123', 'admin')
 * @returns Permission check result with allowed flag and reason
 */
export async function checkPermission(
  userId: string,
  action: PermissionAction,
  resource: PermissionResource,
): Promise<PermissionCheckResult> {
  try {
    // Get user role
    const { data: roleData, error: roleError } = await supabase
      .from('user_roles')
      .select('role')
      .eq('id', userId)
      .single()

    if (roleError || !roleData) {
      return {
        allowed: false,
        reason: 'User role not found',
      }
    }

    const userRole = roleData.role

    // Admin can do anything
    if (userRole === 'admin') {
      return { allowed: true }
    }

    // Check resource-specific permissions
    const [resourceType, resourceId] = resource.split(':')

    // Admin-only resources
    if (resourceType === 'admin' || resourceType === 'users') {
      if (action === 'admin' || action === 'edit' || action === 'delete') {
        return {
          allowed: false,
          reason: `Only admins can ${action} ${resourceType}`,
        }
      }
    }

    // Article permissions
    if (resourceType === 'article' && resourceId) {
      // Get article data
      const { data: article, error: articleError } = await supabase
        .from('articles')
        .select('id, visibility_type, restricted_to_classes, is_published')
        .eq('id', resourceId)
        .single()

      if (articleError || !article) {
        return {
          allowed: false,
          reason: 'Article not found',
        }
      }

      // View action
      if (action === 'view') {
        if (!article.is_published) {
          return {
            allowed: false,
            reason: 'Article not published',
          }
        }

        if (article.visibility_type === 'public') {
          return { allowed: true }
        }

        if (article.visibility_type === 'class_restricted') {
          // For now, allow authenticated users to view class-restricted articles
          // (Full check requires class enrollment lookup)
          return { allowed: true }
        }
      }

      // Edit action
      if (action === 'edit') {
        if (userRole === 'teacher') {
          if (article.visibility_type === 'public') {
            return {
              allowed: false,
              reason: 'Teachers cannot edit public articles',
            }
          }

          if (article.visibility_type === 'class_restricted') {
            // Check if teacher teaches one of the restricted classes
            const restrictedClasses = article.restricted_to_classes || []
            const { data: teacherClasses } = await supabase
              .from('teacher_class_assignment')
              .select('class_id')
              .eq('teacher_id', userId)

            const hasAccess = teacherClasses?.some(tc =>
              restrictedClasses.includes(tc.class_id),
            )

            if (hasAccess) {
              return { allowed: true }
            }

            return {
              allowed: false,
              reason: 'Teacher does not teach any of the restricted classes',
            }
          }
        }

        return {
          allowed: false,
          reason: `${userRole} cannot edit articles`,
        }
      }

      // Delete action
      if (action === 'delete') {
        return {
          allowed: false,
          reason: 'Only admins can delete articles',
        }
      }
    }

    // Default deny
    return {
      allowed: false,
      reason: `${userRole} cannot ${action} ${resource}`,
    }
  } catch (err) {
    console.error('Error checking permission:', err)
    return {
      allowed: false,
      reason: 'Permission check failed: ' + (err as Error).message,
    }
  }
}

/**
 * Deno HTTP handler for permission checks (optional)
 * Usage: POST /permission-check
 * Body: { userId, action, resource }
 */
export async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  try {
    const { userId, action, resource } = await req.json()

    if (!userId || !action || !resource) {
      return new Response(
        JSON.stringify({
          error: 'Missing required fields: userId, action, resource',
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      )
    }

    const result = await checkPermission(userId, action, resource)

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(
      JSON.stringify({ error: 'Internal server error: ' + (err as Error).message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    )
  }
}
