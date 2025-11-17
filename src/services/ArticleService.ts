/**
 * Article Service
 * Handles all article data operations (CRUD, publishing, soft-delete)
 *
 * Performance Target (SC-001): <500ms for 100 articles
 */

import { getSupabaseClient, table } from '@/lib/supabase'
import type { ArticleRow, NewsletterWeekRow, AuditLogMetadata } from '@/types/database'

/**
 * Article data transfer object for creation
 */
export interface CreateArticleDTO {
  weekNumber: string
  title: string
  content: string
  author?: string
  articleOrder: number
  visibilityType: 'public' | 'class_restricted'
  restrictedToClasses?: string[] | null
}

/**
 * Article data transfer object for updates
 */
export interface UpdateArticleDTO {
  title?: string
  content?: string
  author?: string
  visibilityType?: 'public' | 'class_restricted'
  restrictedToClasses?: string[] | null
  isPublished?: boolean
}

/**
 * Filters for querying articles
 */
export interface ArticleFilter {
  isPublished?: boolean
  visibilityType?: 'public' | 'class_restricted'
  excludeDeleted?: boolean
  classId?: string
  limit?: number
  offset?: number
}

/**
 * Service error for better error handling
 */
export class ArticleServiceError extends Error {
  constructor(
    message: string,
    public code: string = 'ARTICLE_ERROR',
    public originalError?: Error,
  ) {
    super(message)
    this.name = 'ArticleServiceError'
  }
}

/**
 * Article Service class
 * Provides methods for article management
 */
export class ArticleService {
  /**
   * Get articles by week number
   * @param weekNumber ISO week format (e.g., "2025-W47")
   * @param filters Optional filtering options
   */
  static async getArticlesByWeek(
    weekNumber: string,
    filters?: ArticleFilter,
  ): Promise<ArticleRow[]> {
    try {
      let query = table('articles')
        .select('*')
        .eq('week_number', weekNumber)
        .order('article_order', { ascending: true })

      // Apply filters
      if (filters?.isPublished !== undefined) {
        query = query.eq('is_published', filters.isPublished)
      }

      if (filters?.visibilityType) {
        query = query.eq('visibility_type', filters.visibilityType)
      }

      if (filters?.excludeDeleted !== false) {
        query = query.is('deleted_at', null)
      }

      if (filters?.limit) {
        query = query.limit(filters.limit)
      }

      if (filters?.offset) {
        query = query.range(filters.offset, filters.offset + (filters.limit || 10) - 1)
      }

      const { data, error } = await query

      if (error) {
        throw new ArticleServiceError(
          `Failed to fetch articles for week ${weekNumber}: ${error.message}`,
          'FETCH_ARTICLES_ERROR',
          error as Error,
        )
      }

      return data || []
    } catch (err) {
      if (err instanceof ArticleServiceError) throw err
      throw new ArticleServiceError(
        `Unexpected error fetching articles: ${err instanceof Error ? err.message : String(err)}`,
        'FETCH_ARTICLES_ERROR',
        err instanceof Error ? err : undefined,
      )
    }
  }

  /**
   * Get a single article by ID
   */
  static async getArticleById(id: string): Promise<ArticleRow> {
    try {
      const { data, error } = await table('articles')
        .select('*')
        .eq('id', id)
        .single()

      if (error) {
        throw new ArticleServiceError(
          `Failed to fetch article ${id}: ${error.message}`,
          'FETCH_ARTICLE_ERROR',
          error as Error,
        )
      }

      if (!data) {
        throw new ArticleServiceError(
          `Article ${id} not found`,
          'ARTICLE_NOT_FOUND',
        )
      }

      return data
    } catch (err) {
      if (err instanceof ArticleServiceError) throw err
      throw new ArticleServiceError(
        `Unexpected error fetching article: ${err instanceof Error ? err.message : String(err)}`,
        'FETCH_ARTICLE_ERROR',
        err instanceof Error ? err : undefined,
      )
    }
  }

  /**
   * Create a new article
   */
  static async createArticle(dto: CreateArticleDTO): Promise<ArticleRow> {
    try {
      const articleData = {
        week_number: dto.weekNumber,
        title: dto.title,
        content: dto.content,
        author: dto.author || null,
        article_order: dto.articleOrder,
        visibility_type: dto.visibilityType,
        restricted_to_classes: dto.visibilityType === 'class_restricted'
          ? (dto.restrictedToClasses || [])
          : null,
        is_published: false,
        created_at: new Date().toISOString(),
      }

      const { data, error } = await table('articles')
        .insert([articleData])
        .select()
        .single()

      if (error) {
        throw new ArticleServiceError(
          `Failed to create article: ${error.message}`,
          'CREATE_ARTICLE_ERROR',
          error as Error,
        )
      }

      if (!data) {
        throw new ArticleServiceError(
          'Article creation returned no data',
          'CREATE_ARTICLE_ERROR',
        )
      }

      return data
    } catch (err) {
      if (err instanceof ArticleServiceError) throw err
      throw new ArticleServiceError(
        `Unexpected error creating article: ${err instanceof Error ? err.message : String(err)}`,
        'CREATE_ARTICLE_ERROR',
        err instanceof Error ? err : undefined,
      )
    }
  }

  /**
   * Update an article
   */
  static async updateArticle(id: string, dto: UpdateArticleDTO): Promise<ArticleRow> {
    try {
      const updateData: Record<string, unknown> = {}

      if (dto.title !== undefined) updateData.title = dto.title
      if (dto.content !== undefined) updateData.content = dto.content
      if (dto.author !== undefined) updateData.author = dto.author
      if (dto.visibilityType !== undefined) updateData.visibility_type = dto.visibilityType
      if (dto.restrictedToClasses !== undefined) {
        updateData.restricted_to_classes =
          dto.visibilityType === 'class_restricted'
            ? (dto.restrictedToClasses || [])
            : null
      }
      if (dto.isPublished !== undefined) updateData.is_published = dto.isPublished

      if (Object.keys(updateData).length === 0) {
        // No fields to update, just return the article
        return this.getArticleById(id)
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
          `Article ${id} not found for update`,
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
   * Soft-delete an article (marks as deleted but preserves data)
   */
  static async deleteArticle(id: string): Promise<ArticleRow> {
    try {
      const { data, error } = await table('articles')
        .update({
          deleted_at: new Date().toISOString(),
          is_published: false, // Unpublish on delete
        })
        .eq('id', id)
        .select()
        .single()

      if (error) {
        throw new ArticleServiceError(
          `Failed to delete article ${id}: ${error.message}`,
          'DELETE_ARTICLE_ERROR',
          error as Error,
        )
      }

      if (!data) {
        throw new ArticleServiceError(
          `Article ${id} not found for deletion`,
          'ARTICLE_NOT_FOUND',
        )
      }

      return data
    } catch (err) {
      if (err instanceof ArticleServiceError) throw err
      throw new ArticleServiceError(
        `Unexpected error deleting article: ${err instanceof Error ? err.message : String(err)}`,
        'DELETE_ARTICLE_ERROR',
        err instanceof Error ? err : undefined,
      )
    }
  }

  /**
   * Publish an article
   */
  static async publishArticle(id: string): Promise<ArticleRow> {
    return this.updateArticle(id, { isPublished: true })
  }

  /**
   * Unpublish an article
   */
  static async unpublishArticle(id: string): Promise<ArticleRow> {
    return this.updateArticle(id, { isPublished: false })
  }

  /**
   * Restore a soft-deleted article
   */
  static async restoreArticle(id: string): Promise<ArticleRow> {
    try {
      const { data, error } = await table('articles')
        .update({ deleted_at: null })
        .eq('id', id)
        .select()
        .single()

      if (error) {
        throw new ArticleServiceError(
          `Failed to restore article ${id}: ${error.message}`,
          'RESTORE_ARTICLE_ERROR',
          error as Error,
        )
      }

      if (!data) {
        throw new ArticleServiceError(
          `Article ${id} not found for restoration`,
          'ARTICLE_NOT_FOUND',
        )
      }

      return data
    } catch (err) {
      if (err instanceof ArticleServiceError) throw err
      throw new ArticleServiceError(
        `Unexpected error restoring article: ${err instanceof Error ? err.message : String(err)}`,
        'RESTORE_ARTICLE_ERROR',
        err instanceof Error ? err : undefined,
      )
    }
  }

  /**
   * Get article count for a week
   */
  static async getArticleCountByWeek(weekNumber: string): Promise<number> {
    try {
      const { count, error } = await table('articles')
        .select('*', { count: 'exact', head: true })
        .eq('week_number', weekNumber)
        .is('deleted_at', null)

      if (error) {
        throw new ArticleServiceError(
          `Failed to count articles for week ${weekNumber}: ${error.message}`,
          'COUNT_ARTICLES_ERROR',
          error as Error,
        )
      }

      return count || 0
    } catch (err) {
      if (err instanceof ArticleServiceError) throw err
      throw new ArticleServiceError(
        `Unexpected error counting articles: ${err instanceof Error ? err.message : String(err)}`,
        'COUNT_ARTICLES_ERROR',
        err instanceof Error ? err : undefined,
      )
    }
  }

  /**
   * Get the next available article order for a week
   */
  static async getNextArticleOrder(weekNumber: string): Promise<number> {
    try {
      const articles = await this.getArticlesByWeek(weekNumber, { excludeDeleted: true })
      return Math.max(...articles.map(a => a.article_order), 0) + 1
    } catch (err) {
      if (err instanceof ArticleServiceError) throw err
      throw new ArticleServiceError(
        `Unexpected error getting next article order: ${err instanceof Error ? err.message : String(err)}`,
        'GET_ARTICLE_ORDER_ERROR',
        err instanceof Error ? err : undefined,
      )
    }
  }
}

/**
 * Export service as default
 */
export default ArticleService
