/**
 * Article Update Service
 * Handles article content updates with change tracking and conflict detection
 *
 * US4: Editor Updates Existing Articles
 * - Updates article content and metadata
 * - Tracks changes via audit log (automatic via trigger)
 * - Preserves created_at, updates updated_at
 * - Detects concurrent edit conflicts
 */

import { table } from '@/lib/supabase'
import type { ArticleRow } from '@/types/database'
import { ArticleServiceError } from './ArticleService'

/**
 * Update article content DTO - for US4 content updates
 */
export interface UpdateArticleContentDTO {
  title: string
  content: string
}

/**
 * Conflict detection result
 */
export interface ConflictDetectionResult {
  hasConflict: boolean
  localVersion: ArticleRow
  remoteVersion: ArticleRow
  lastModifiedBy: string | null
  lastModifiedAt: string
}

/**
 * Article Update Service
 * Provides methods for updating articles with conflict detection
 */
export class ArticleUpdateService {
  /**
   * Update article content (title and content only)
   * This is the primary US4 operation
   *
   * @param id Article ID
   * @param title New title
   * @param content New content
   * @returns Updated article
   *
   * Side effects:
   * - updated_at is auto-updated via trigger
   * - created_at is preserved
   * - audit_article_changes trigger records the update
   */
  static async updateArticleContent(
    id: string,
    title: string,
    content: string,
  ): Promise<ArticleRow> {
    try {
      // Validate article exists and is not deleted
      const { data: existingArticle, error: fetchError } = await table('articles')
        .select('*')
        .eq('id', id)
        .is('deleted_at', null)
        .single()

      if (fetchError || !existingArticle) {
        throw new ArticleServiceError(
          `Article ${id} not found or has been deleted`,
          'ARTICLE_NOT_FOUND',
          fetchError instanceof Error ? fetchError : undefined,
        )
      }

      // Perform update - trigger will auto-update updated_at
      const { data, error } = await table('articles')
        .update({
          title,
          content,
          // Note: created_at is preserved by database design
          // updated_at is handled by trigger
        })
        .eq('id', id)
        .select()
        .single()

      if (error) {
        throw new ArticleServiceError(
          `Failed to update article content for ${id}: ${error.message}`,
          'UPDATE_ARTICLE_ERROR',
          error as Error,
        )
      }

      if (!data) {
        throw new ArticleServiceError(
          `Article ${id} not found after update`,
          'ARTICLE_NOT_FOUND',
        )
      }

      return data
    } catch (err) {
      if (err instanceof ArticleServiceError) throw err
      throw new ArticleServiceError(
        `Unexpected error updating article content: ${err instanceof Error ? err.message : String(err)}`,
        'UPDATE_ARTICLE_ERROR',
        err instanceof Error ? err : undefined,
      )
    }
  }

  /**
   * Update article with full metadata
   * Includes title, content, author, visibility settings
   *
   * @param id Article ID
   * @param updates Fields to update
   * @returns Updated article
   */
  static async updateArticle(
    id: string,
    updates: Partial<UpdateArticleContentDTO> & {
      author?: string
      visibilityType?: 'public' | 'class_restricted'
      restrictedToClasses?: string[] | null
    },
  ): Promise<ArticleRow> {
    try {
      // Validate article exists and is not deleted
      const { data: existingArticle, error: fetchError } = await table('articles')
        .select('*')
        .eq('id', id)
        .is('deleted_at', null)
        .single()

      if (fetchError || !existingArticle) {
        throw new ArticleServiceError(
          `Article ${id} not found or has been deleted`,
          'ARTICLE_NOT_FOUND',
          fetchError instanceof Error ? fetchError : undefined,
        )
      }

      // Build update object
      const updateData: Record<string, unknown> = {}

      if (updates.title !== undefined) updateData.title = updates.title
      if (updates.content !== undefined) updateData.content = updates.content
      if (updates.author !== undefined) updateData.author = updates.author
      if (updates.visibilityType !== undefined) {
        updateData.visibility_type = updates.visibilityType
      }
      if (updates.restrictedToClasses !== undefined) {
        // Validate class-restricted articles have classes
        if (
          updates.visibilityType === 'class_restricted' &&
          (!updates.restrictedToClasses || updates.restrictedToClasses.length === 0)
        ) {
          throw new ArticleServiceError(
            'Class-restricted articles must have at least one class specified',
            'VALIDATION_ERROR',
          )
        }
        updateData.restricted_to_classes =
          updates.visibilityType === 'class_restricted'
            ? (updates.restrictedToClasses || [])
            : null
      }

      if (Object.keys(updateData).length === 0) {
        // No fields to update, just return the article
        return existingArticle
      }

      const { data, error } = await table('articles')
        .update(updateData)
        .eq('id', id)
        .select()
        .single()

      if (error) {
        throw new ArticleServiceError(
          `Failed to update article ${id}: ${error.message}`,
          'UPDATE_ARTICLE_ERROR',
          error as Error,
        )
      }

      if (!data) {
        throw new ArticleServiceError(
          `Article ${id} not found after update`,
          'ARTICLE_NOT_FOUND',
        )
      }

      return data
    } catch (err) {
      if (err instanceof ArticleServiceError) throw err
      throw new ArticleServiceError(
        `Unexpected error updating article: ${err instanceof Error ? err.message : String(err)}`,
        'UPDATE_ARTICLE_ERROR',
        err instanceof Error ? err : undefined,
      )
    }
  }

  /**
   * Detect concurrent edit conflicts
   * Compares a locally-loaded article version with current database version
   *
   * Implements "last-write-wins" per specification assumption
   * Returns conflict information for UI to display
   *
   * @param id Article ID
   * @param localVersion Article version loaded by editor
   * @returns Conflict detection result
   */
  static async detectConflict(id: string, localVersion: ArticleRow): Promise<ConflictDetectionResult> {
    try {
      const { data: remoteVersion, error } = await table('articles')
        .select('*')
        .eq('id', id)
        .single()

      if (error || !remoteVersion) {
        throw new ArticleServiceError(
          `Failed to fetch article for conflict detection: ${error?.message || 'Not found'}`,
          'FETCH_ARTICLE_ERROR',
          error instanceof Error ? error : undefined,
        )
      }

      // Compare versions
      // Content or metadata changes after local load = conflict
      const hasConflict =
        localVersion.updated_at !== remoteVersion.updated_at ||
        localVersion.title !== remoteVersion.title ||
        localVersion.content !== remoteVersion.content

      return {
        hasConflict,
        localVersion,
        remoteVersion,
        lastModifiedBy: remoteVersion.created_by || null,
        lastModifiedAt: remoteVersion.updated_at,
      }
    } catch (err) {
      if (err instanceof ArticleServiceError) throw err
      throw new ArticleServiceError(
        `Unexpected error detecting conflict: ${err instanceof Error ? err.message : String(err)}`,
        'CONFLICT_DETECTION_ERROR',
        err instanceof Error ? err : undefined,
      )
    }
  }

  /**
   * Get article update history from audit log
   * Shows all changes made to the article
   *
   * @param articleId Article ID
   * @param limit Maximum number of audit entries to return
   * @returns Audit log entries
   */
  static async getArticleHistory(articleId: string, limit: number = 20) {
    try {
      const { data, error } = await table('article_audit_log')
        .select('*')
        .eq('article_id', articleId)
        .order('changed_at', { ascending: false })
        .limit(limit)

      if (error) {
        throw new ArticleServiceError(
          `Failed to fetch article history for ${articleId}: ${error.message}`,
          'FETCH_HISTORY_ERROR',
          error as Error,
        )
      }

      return data || []
    } catch (err) {
      if (err instanceof ArticleServiceError) throw err
      throw new ArticleServiceError(
        `Unexpected error fetching article history: ${err instanceof Error ? err.message : String(err)}`,
        'FETCH_HISTORY_ERROR',
        err instanceof Error ? err : undefined,
      )
    }
  }

  /**
   * Revert article to previous version (from audit log)
   * This is an admin/editor feature for US4
   *
   * @param articleId Article ID
   * @param auditLogId Audit log entry ID to revert to
   * @returns Reverted article
   */
  static async revertToPreviousVersion(
    articleId: string,
    auditLogId: string,
  ): Promise<ArticleRow> {
    try {
      // Fetch the audit log entry to get previous values
      const { data: auditEntry, error: auditError } = await table('article_audit_log')
        .select('*')
        .eq('id', auditLogId)
        .single()

      if (auditError || !auditEntry) {
        throw new ArticleServiceError(
          `Audit log entry ${auditLogId} not found`,
          'AUDIT_LOG_NOT_FOUND',
          auditError instanceof Error ? auditError : undefined,
        )
      }

      if (!auditEntry.old_values) {
        throw new ArticleServiceError(
          'Cannot revert: audit entry has no previous values',
          'REVERT_NOT_POSSIBLE',
        )
      }

      const previousValues = auditEntry.old_values as Record<string, unknown>

      // Restore to previous state
      const { data, error } = await table('articles')
        .update({
          title: previousValues.title,
          content: previousValues.content,
          author: previousValues.author,
          visibility_type: previousValues.visibility_type,
          restricted_to_classes: previousValues.restricted_to_classes,
        })
        .eq('id', articleId)
        .select()
        .single()

      if (error) {
        throw new ArticleServiceError(
          `Failed to revert article ${articleId}: ${error.message}`,
          'REVERT_ERROR',
          error as Error,
        )
      }

      if (!data) {
        throw new ArticleServiceError(
          `Article ${articleId} not found for revert`,
          'ARTICLE_NOT_FOUND',
        )
      }

      return data
    } catch (err) {
      if (err instanceof ArticleServiceError) throw err
      throw new ArticleServiceError(
        `Unexpected error reverting article: ${err instanceof Error ? err.message : String(err)}`,
        'REVERT_ERROR',
        err instanceof Error ? err : undefined,
      )
    }
  }
}

/**
 * Export service as default
 */
export default ArticleUpdateService
