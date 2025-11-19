/**
 * Permission Service
 * Handles authorization checks for article editing and management
 *
 * Permission Rules:
 * - ADMIN: Can edit/delete any article
 * - TEACHER: Can edit articles for their assigned classes
 * - PARENT/STUDENT: Read-only (cannot edit/delete)
 */

import { getSupabaseClient, table } from '@/lib/supabase'
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
 * Permission Service class
 */
export class PermissionService {
  /**
   * Get user role by ID
   * @param userId User ID (from Supabase auth)
   * @returns User role or null if not found
   */
  static async getUserRole(userId: string): Promise<string | null> {
    try {
      const { data, error } = await table<UserRoleRow>('user_roles')
        .select('role')
        .eq('id', userId)
        .single()

      if (error) {
        console.error(`Failed to fetch user role for ${userId}:`, error)
        return null
      }

      return data?.role || null
    } catch (err) {
      console.error('Error fetching user role:', err)
      return null
    }
  }

  /**
   * Get all classes taught by a teacher
   * @param teacherId Teacher user ID
   * @returns Array of class IDs
   */
  static async getTeacherClasses(teacherId: string): Promise<string[]> {
    try {
      const { data, error } = await table<TeacherClassAssignmentRow>('teacher_class_assignments')
        .select('class_id')
        .eq('teacher_id', teacherId)

      if (error) {
        console.error(`Failed to fetch teacher classes for ${teacherId}:`, error)
        return []
      }

      return data?.map(assignment => assignment.class_id) || []
    } catch (err) {
      console.error('Error fetching teacher classes:', err)
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
   * @param article Article to check
   * @returns true if user can delete, false otherwise
   */
  static async canDeleteArticle(userId: string, article: ArticleRow): Promise<boolean> {
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
