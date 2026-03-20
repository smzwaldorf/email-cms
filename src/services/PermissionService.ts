/**
 * Permission Service
 * Handles authorization checks for article editing and management
 *
 * Permission Rules:
 * - ADMIN: Can edit/delete any article
 * - TEACHER: Can edit articles for their assigned classes
 * - PARENT/STUDENT: Read-only (cannot edit/delete)
 *
 * Performance: Uses session-level caching to avoid repeated database queries
 * for user roles and teacher class assignments during a single page load.
 */

import { table } from '@/lib/supabase'
import type { ArticleRow, UserRoleRow, TeacherClassAssignmentRow } from '@/types/database'
import { type AccessControlRole, resolveAccessControl, resolveWinningRole } from '@/services/accessControlResolver'

/**
 * Permission error for authorization failures
 */
export class PermissionError extends Error {
  constructor(
    message: string,
    public code: string = 'PERMISSION_DENIED',
  ) {
    super(message)
    this.name = 'PermissionError'
  }
}

/**
 * Session-level cache for user roles and teacher assignments
 * Cleared when user changes or component unmounts
 *
 * Why: Permission checks are called multiple times per page load
 * (once per article in a list). Caching reduces database queries
 * from O(n_articles) to O(1) for role lookups.
 *
 * Example: Article list with 10 articles
 * - Without cache: 30 queries (3 per article: canView, canEdit, canDelete)
 * - With cache: 2 queries (1 for role, 1 for teacher classes)
 *
 * Cache is stored on PermissionService class (static) and can be cleared
 * between sessions or when user context changes.
 */
const roleCache = new Map<string, string | null>()
const rolesCache = new Map<string, AccessControlRole[]>()
const teacherClassesCache = new Map<string, string[]>()

/**
 * Clear all caches (call when user changes or session ends)
 */
export function clearPermissionCache(): void {
  roleCache.clear()
  rolesCache.clear()
  teacherClassesCache.clear()
}

/**
 * Permission Service class
 */
export class PermissionService {
  /**
   * Get user role by ID (with caching)
   * @param userId User ID (from Supabase auth)
   * @returns User role or null if not found
   */
  static async getUserRole(userId: string): Promise<string | null> {
    const roles = await this.getUserRoles(userId)
    const winner = resolveWinningRole(roles)
    const role = winner || null
    roleCache.set(userId, role)
    return role
  }

  /**
   * Get full user role set (supports multi-role assignment table with fallback).
   */
  static async getUserRoles(userId: string): Promise<AccessControlRole[]> {
    if (rolesCache.has(userId)) {
      return rolesCache.get(userId) || []
    }

    try {
      const { data: assignments, error: assignmentError } = (await table('user_role_assignments')
        .select('role')
        .eq('user_id', userId)) as { data: Array<{ role: AccessControlRole }> | null; error: any }

      if (!assignmentError && assignments && assignments.length > 0) {
        const roles = Array.from(new Set(assignments.map((row) => row.role)))
        rolesCache.set(userId, roles)
        return roles
      }

      const { data, error } = (await table('user_roles')
        .select('role')
        .eq('id', userId)
        .single()) as { data: UserRoleRow | null; error: any }

      if (error) {
        console.error(`Failed to fetch user role for ${userId}:`, error)
        rolesCache.set(userId, [])
        roleCache.set(userId, null)
        return []
      }

      const role = (data?.role || null) as AccessControlRole | null
      const roles = role ? [role] : []
      rolesCache.set(userId, roles)
      roleCache.set(userId, role)
      return roles
    } catch (err) {
      console.error('Error fetching user roles:', err)
      rolesCache.set(userId, [])
      roleCache.set(userId, null)
      return []
    }
  }

  /**
   * Get all classes taught by a teacher (with caching)
   * @param teacherId Teacher user ID
   * @returns Array of class IDs
   */
  static async getTeacherClasses(teacherId: string): Promise<string[]> {
    // Check cache first
    if (teacherClassesCache.has(teacherId)) {
      return teacherClassesCache.get(teacherId) || []
    }

    try {
      const { data, error } = (await table('teacher_class_assignment')
        .select('class_id')
        .eq('teacher_id', teacherId)) as { data: TeacherClassAssignmentRow[] | null; error: any }

      if (error) {
        console.error(`Failed to fetch teacher classes for ${teacherId}:`, error)
        teacherClassesCache.set(teacherId, [])
        return []
      }

      const classes = data?.map(assignment => assignment.class_id) || []
      teacherClassesCache.set(teacherId, classes)
      return classes
    } catch (err) {
      console.error('Error fetching teacher classes:', err)
      teacherClassesCache.set(teacherId, [])
      return []
    }
  }

  /**
   * Check if user can edit an article
   * @param userId User ID
   * @param article Article to check
   * @returns true if user can edit, false otherwise
   */
  static async canEditArticle(userId: string, article: ArticleRow): Promise<boolean> {
    try {
      const roles = await this.getUserRoles(userId)
      const teacherClasses = roles.includes('teacher') ? await this.getTeacherClasses(userId) : []

      // Public content remains non-editable for non-admins.
      if (article.visibility_type === 'public') {
        const resolution = resolveAccessControl({
          roles,
          action: 'article:edit',
          teacherClassIds: teacherClasses,
          targetClassId: null,
        })
        return resolution.granted
      }

      const restrictedClasses = article.restricted_to_classes as string[] || []
      return restrictedClasses.some((classId) => {
        const resolution = resolveAccessControl({
          roles,
          action: 'article:edit',
          teacherClassIds: teacherClasses,
          targetClassId: classId,
        })
        return resolution.granted
      })
    } catch (err) {
      console.error('Error checking edit permission:', err)
      return false
    }
  }

  /**
   * Check if user can delete an article
   * @param userId User ID
   * @param _article Article to check (unused - only admin can delete)
   * @returns true if user can delete, false otherwise
   */
  static async canDeleteArticle(userId: string, _article: ArticleRow): Promise<boolean> {
    try {
      const roles = await this.getUserRoles(userId)
      const resolution = resolveAccessControl({
        roles,
        action: 'article:delete',
      })
      return resolution.granted
    } catch (err) {
      console.error('Error checking delete permission:', err)
      return false
    }
  }

  /**
   * Check if user can view an article
   * @param userId User ID
   * @param article Article to check
   * @returns true if user can view, false otherwise
   */
  static async canViewArticle(userId: string, article: ArticleRow): Promise<boolean> {
    try {
      const roles = await this.getUserRoles(userId)
      const teacherClasses = roles.includes('teacher') ? await this.getTeacherClasses(userId) : []
      const winner = resolveWinningRole(roles)

      if (winner === 'admin') return true

      // Only published articles are visible
      if (article.status !== 'published') {
        return false
      }

      // Public articles are visible to everyone
      if (article.visibility_type === 'public') {
        return roles.length > 0
      }

      // Class-restricted articles need class access
      if (article.visibility_type === 'class_restricted') {
        const restrictedClasses = article.restricted_to_classes as string[] || []
        if (restrictedClasses.length === 0) return roles.length > 0

        return restrictedClasses.some((classId) => {
          const resolution = resolveAccessControl({
            roles,
            action: 'article:view',
            teacherClassIds: teacherClasses,
            targetClassId: classId,
          })
          return resolution.granted
        })
      }

      return false
    } catch (err) {
      console.error('Error checking view permission:', err)
      return false
    }
  }

  /**
   * Verify user can edit article, throw error if not
   * @param userId User ID
   * @param article Article to check
   * @throws PermissionError if user cannot edit
   */
  static async assertCanEditArticle(userId: string, article: ArticleRow): Promise<void> {
    const canEdit = await this.canEditArticle(userId, article)

    if (!canEdit) {
      const role = await this.getUserRole(userId)
      throw new PermissionError(
        `User with role '${role}' cannot edit this article. Only admins and teachers of the restricted class can edit.`,
        'EDIT_NOT_ALLOWED',
      )
    }
  }

  /**
   * Verify user can delete article, throw error if not
   * @param userId User ID
   * @param article Article to check
   * @throws PermissionError if user cannot delete
   */
  static async assertCanDeleteArticle(userId: string, article: ArticleRow): Promise<void> {
    const canDelete = await this.canDeleteArticle(userId, article)

    if (!canDelete) {
      const role = await this.getUserRole(userId)
      throw new PermissionError(
        `User with role '${role}' cannot delete articles. Only admins can delete articles.`,
        'DELETE_NOT_ALLOWED',
      )
    }
  }
}

export default PermissionService
