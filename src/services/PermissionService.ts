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
const teacherClassesCache = new Map<string, string[]>()

/**
 * Clear all caches (call when user changes or session ends)
 */
export function clearPermissionCache(): void {
  roleCache.clear()
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
    // Check cache first
    if (roleCache.has(userId)) {
      return roleCache.get(userId) || null
    }

    try {
      const { data, error } = await table<UserRoleRow>('user_roles')
        .select('role')
        .eq('id', userId)
        .single()

      if (error) {
        console.error(`Failed to fetch user role for ${userId}:`, error)
        roleCache.set(userId, null)
        return null
      }

      const role = data?.role || null
      roleCache.set(userId, role)
      return role
    } catch (err) {
      console.error('Error fetching user role:', err)
      roleCache.set(userId, null)
      return null
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
      const { data, error } = await table<TeacherClassAssignmentRow>('teacher_class_assignment')
        .select('class_id')
        .eq('teacher_id', teacherId)

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
      // Get user role
      const role = await this.getUserRole(userId)

      // Admin can edit any article
      if (role === 'admin') {
        return true
      }

      // Teachers can edit articles for their classes
      if (role === 'teacher') {
        // If article is public, teachers cannot edit it
        if (article.visibility_type === 'public') {
          return false
        }

        // If article is class-restricted, check if teacher teaches one of the classes
        if (article.visibility_type === 'class_restricted') {
          const restrictedClasses = article.restricted_to_classes as string[] || []
          const teacherClasses = await this.getTeacherClasses(userId)

          // Teacher can edit if they teach any of the restricted classes
          return restrictedClasses.some(classId => teacherClasses.includes(classId))
        }
      }

      // Parent and Student cannot edit
      return false
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
      // Only admin can delete articles
      const role = await this.getUserRole(userId)
      return role === 'admin'
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
      const role = await this.getUserRole(userId)

      // Admin can view all articles
      if (role === 'admin') {
        return true
      }

      // Only published articles are visible
      if (!article.is_published) {
        return false
      }

      // Public articles are visible to everyone
      if (article.visibility_type === 'public') {
        return true
      }

      // Class-restricted articles need class access
      // For now, allow viewing for any authenticated user (full check needs class enrollment)
      if (article.visibility_type === 'class_restricted') {
        return role !== null // Allow if user has a role
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
