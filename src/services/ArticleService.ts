/**
 * Article Service
 * Handles all article data operations (CRUD, publishing, soft-delete)
 * Enforces permission checks via PermissionService
 *
 * Performance Target (SC-001): <500ms for 100 articles
 */

import { table, getSupabaseClient } from '@/lib/supabase'
import type { ArticleRow } from '@/types/database'
import PermissionService, { PermissionError } from './PermissionService'

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
   * Helper: Get newsletter UUID by week_number
   * @param weekNumber ISO week format (e.g., "2025-W47")
   * @returns Newsletter UUID or null if not found
   */
  private static async getNewsletterIdByWeek(weekNumber: string): Promise<string | null> {
    const supabase = getSupabaseClient()
    const { data, error } = await supabase
      .from('newsletters')
      .select('id')
      .eq('week_number', weekNumber)
      .single()
    
    if (error || !data) return null
    return data.id
  }
  /**
   * Helper to check if a string looks like a UUID
   */
  private static isUUID(str: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str)
  }

  /**
   * Get articles by week number or newsletter id using the newsletter_articles junction table
   * @param newsletterId ISO week format (e.g., "2025-W47") or newsletter UUID
   * @param filters Optional filtering options
   */
  static async getArticlesByWeek(
    newsletterId: string,
    filters?: ArticleFilter,
  ): Promise<ArticleRow[]> {
    try {
      const supabase = getSupabaseClient()
      
      // Determine if the input is a UUID or week_number
      const isId = this.isUUID(newsletterId)
      const queryField = isId ? 'id' : 'week_number'
      
      // Find the newsletter
      const { data: newsletter, error: newsletterError } = await supabase
        .from('newsletters')
        .select('id')
        .eq(queryField, newsletterId)
        .single()
      
      if (newsletterError || !newsletter) {
        // No newsletter found
        return []
      }
      
      // Query articles via junction table
      const { data, error } = await supabase
        .from('newsletter_articles')
        .select(`
          article_order,
          articles!inner (*)
        `)
        .eq('newsletter_id', newsletter.id)
        .order('article_order', { ascending: true })

      if (error) {
        throw new ArticleServiceError(
          `Failed to fetch articles for newsletter ${newsletterId}: ${error.message}`,
          'FETCH_ARTICLES_ERROR',
          error as Error,
        )
      }

      // Flatten the result and apply filters
      let articles = (data || []).map((row: any) => ({
        ...row.articles,
        // Add order from junction for convenience
        _junction_order: row.article_order,
      })) as ArticleRow[]

      // Apply filters
      if (filters?.isPublished !== undefined) {
        const status = filters.isPublished ? 'published' : 'draft'
        articles = articles.filter((a: ArticleRow) => a.status === status)
      }

      if (filters?.visibilityType) {
        articles = articles.filter((a: ArticleRow) => a.visibility_type === filters.visibilityType)
      }

      if (filters?.excludeDeleted !== false) {
        articles = articles.filter((a: ArticleRow) => a.deleted_at === null)
      }

      if (filters?.limit) {
        articles = articles.slice(0, filters.limit)
      }

      return articles
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
   * Get a single article by ID with its associated newsletter ID
   * This is useful for analytics tracking to ensure the correct newsletter ID is used
   * @param id Article ID
   * @param newsletterId Optional week number or newsletter UUID to filter by (for shared articles that appear in multiple newsletters)
   */
  static async getArticleWithNewsletter(id: string, newsletterId?: string): Promise<ArticleRow & { newsletter_id?: string; week_number?: string }> {
    try {
      const supabase = getSupabaseClient()
      
      // First get the article
      const { data: article, error: articleError } = await supabase
        .from('articles')
        .select('*')
        .eq('id', id)
        .single()

      if (articleError || !article) {
        throw new ArticleServiceError(
          `Failed to fetch article ${id}: ${articleError?.message || 'Not found'}`,
          'FETCH_ARTICLE_ERROR',
          articleError as Error,
        )
      }

      // Build junction query - filter by week_number or newsletter id if provided
      // If newsletterId is a UUID, we already have the ID - just verify it exists in junction
      if (newsletterId && this.isUUID(newsletterId)) {
        // Simple query - just check if the article is in this newsletter
        const { data: junctionData, error: junctionError } = await supabase
          .from('newsletter_articles')
          .select('newsletter_id')
          .eq('article_id', id)
          .eq('newsletter_id', newsletterId)
          .limit(1)
          .maybeSingle()

        if (junctionData && !junctionError) {
          // Get week_number from newsletters table separately
          const { data: newsletterData } = await supabase
            .from('newsletters')
            .select('week_number')
            .eq('id', newsletterId)
            .single()

          return {
            ...article,
            newsletter_id: junctionData.newsletter_id,
            week_number: newsletterData?.week_number
          }
        }
      } else {
        // Need to join to filter by week_number or get any association
        let junctionQuery = supabase
          .from('newsletter_articles')
          .select('newsletter_id, newsletters!inner(id, week_number)')
          .eq('article_id', id)

        if (newsletterId) {
          // Filter by week_number
          junctionQuery = junctionQuery.eq('newsletters.week_number', newsletterId)
        }

        const { data: junctionData, error: junctionError } = await junctionQuery.limit(1).maybeSingle()

        if (junctionData && !junctionError) {
          return {
            ...article,
            newsletter_id: junctionData.newsletter_id,
            week_number: (junctionData.newsletters as any)?.week_number
          }
        }
      }

      // If filtered query failed but newsletterId was provided, 
      // try fetching any newsletter association as fallback
      if (newsletterId) {
        console.warn(`[ArticleService] Junction query failed for ${newsletterId}, trying fallback...`)
        const { data: fallbackData } = await supabase
          .from('newsletter_articles')
          .select('newsletter_id')
          .eq('article_id', id)
          .limit(1)
          .maybeSingle()

        if (fallbackData) {
          // Get week_number from newsletters table
          const { data: newsletterData } = await supabase
            .from('newsletters')
            .select('week_number')
            .eq('id', fallbackData.newsletter_id)
            .single()

          return {
            ...article,
            newsletter_id: fallbackData.newsletter_id,
            week_number: newsletterData?.week_number
          }
        }
      }

      return article
    } catch (err) {
      if (err instanceof ArticleServiceError) throw err
      throw new ArticleServiceError(
        `Unexpected error fetching article with newsletter: ${err instanceof Error ? err.message : String(err)}`,
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
   * @param id Article ID
   * @param dto Update data
   * @param userId Optional user ID for permission check (required for enforced permissions)
   * @throws PermissionError if user lacks edit permission
   */
  static async updateArticle(id: string, dto: UpdateArticleDTO, userId?: string): Promise<ArticleRow> {
    try {
      // Get the article first
      const article = await this.getArticleById(id)

      // Check permissions if userId provided
      if (userId) {
        await PermissionService.assertCanEditArticle(userId, article)
      }

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
      if (err instanceof PermissionError) throw err
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
   * @param id Article ID
   * @param userId Optional user ID for permission check (required for enforced permissions)
   * @throws PermissionError if user lacks delete permission
   */
  static async deleteArticle(id: string, userId?: string): Promise<ArticleRow> {
    try {
      // Get the article first for permission check
      const article = await this.getArticleById(id)

      // Check permissions if userId provided
      if (userId) {
        await PermissionService.assertCanDeleteArticle(userId, article)
      }

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
      if (err instanceof PermissionError) throw err
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
   * Get the next available article order for a newsletter (from junction table)
   */
  static async getNextArticleOrder(newsletterId: string): Promise<number> {
    try {
      const supabase = getSupabaseClient()
      const { data, error } = await supabase
        .from('newsletter_articles')
        .select('article_order')
        .eq('newsletter_id', newsletterId)
        .order('article_order', { ascending: false })
        .limit(1)
      
      if (error) throw error
      return (data?.[0]?.article_order ?? 0) + 1
    } catch (err) {
      if (err instanceof ArticleServiceError) throw err
      throw new ArticleServiceError(
        `Unexpected error getting next article order: ${err instanceof Error ? err.message : String(err)}`,
        'GET_ARTICLE_ORDER_ERROR',
        err instanceof Error ? err : undefined,
      )
    }
  }

  /**
   * Get articles for a specific class
   * US3: Returns public + class-restricted articles for the class
   *
   * @param classId Class ID
   * @param weekNumber Week number
   * @returns Articles visible to the class
   */
  static async getArticlesForClass(classId: string, weekNumber: string): Promise<ArticleRow[]> {
    try {
      // Get both public and class-restricted articles
      let query = table('articles')
        .select('*')
        .eq('week_number', weekNumber)
        .eq('is_published', true)
        .is('deleted_at', null)

      const { data, error } = await query.order('article_order', { ascending: true })

      if (error) {
        throw new ArticleServiceError(
          `Failed to fetch articles for class ${classId}: ${error.message}`,
          'FETCH_ARTICLES_ERROR',
          error as Error,
        )
      }

      if (!data) {
        return []
      }

      // Filter to visible articles
      return data.filter((article) => {
        // Public articles are always visible
        if (article.visibility_type === 'public') {
          return true
        }

        // Class-restricted articles: check if this class is in the restriction list
        if (article.visibility_type === 'class_restricted') {
          const restrictedTo = article.restricted_to_classes as string[]
          return restrictedTo?.includes(classId) || false
        }

        return false
      })
    } catch (err) {
      if (err instanceof ArticleServiceError) throw err
      throw new ArticleServiceError(
        `Unexpected error fetching articles for class: ${err instanceof Error ? err.message : String(err)}`,
        'FETCH_ARTICLES_ERROR',
        err instanceof Error ? err : undefined,
      )
    }
  }

  /**
   * Set class restrictions for an article
   * US3: Restrict article to specific classes
   *
   * @param articleId Article ID
   * @param classIds Class IDs to restrict to
   * @returns Updated article
   */
  static async setArticleClassRestriction(
    articleId: string,
    classIds: string[],
  ): Promise<ArticleRow> {
    try {
      // Validate that we have at least one class
      if (!classIds || classIds.length === 0) {
        throw new ArticleServiceError(
          'At least one class must be specified for class-restricted articles',
          'VALIDATION_ERROR',
        )
      }

      const { data, error } = await table('articles')
        .update({
          visibility_type: 'class_restricted',
          restricted_to_classes: classIds,
        })
        .eq('id', articleId)
        .select()
        .single()

      if (error) {
        throw new ArticleServiceError(
          `Failed to set article class restriction: ${error.message}`,
          'UPDATE_ARTICLE_ERROR',
          error as Error,
        )
      }

      if (!data) {
        throw new ArticleServiceError(
          `Article ${articleId} not found`,
          'ARTICLE_NOT_FOUND',
        )
      }

      return data
    } catch (err) {
      if (err instanceof ArticleServiceError) throw err
      throw new ArticleServiceError(
        `Unexpected error setting class restriction: ${err instanceof Error ? err.message : String(err)}`,
        'UPDATE_ARTICLE_ERROR',
        err instanceof Error ? err : undefined,
      )
    }
  }

  /**
   * Remove class restrictions from an article
   * US3: Make article public
   *
   * @param articleId Article ID
   * @returns Updated article
   */
  static async removeArticleClassRestriction(articleId: string): Promise<ArticleRow> {
    try {
      const { data, error } = await table('articles')
        .update({
          visibility_type: 'public',
          restricted_to_classes: null,
        })
        .eq('id', articleId)
        .select()
        .single()

      if (error) {
        throw new ArticleServiceError(
          `Failed to remove article class restriction: ${error.message}`,
          'UPDATE_ARTICLE_ERROR',
          error as Error,
        )
      }

      if (!data) {
        throw new ArticleServiceError(
          `Article ${articleId} not found`,
          'ARTICLE_NOT_FOUND',
        )
      }

      return data
    } catch (err) {
      if (err instanceof ArticleServiceError) throw err
      throw new ArticleServiceError(
        `Unexpected error removing class restriction: ${err instanceof Error ? err.message : String(err)}`,
        'UPDATE_ARTICLE_ERROR',
        err instanceof Error ? err : undefined,
      )
    }
  }

  /**
   * 更新文章內容
   * Update article content with content format tracking
   * @param articleId Article ID to update
   * @param content New content
   * @param contentFormat Content format (markdown or rich_text) - for future use with content_format column
   * @param userId Optional user ID for permission checking
   */
  static async updateArticleContent(
    articleId: string,
    content: string,
    _contentFormat: 'markdown' | 'rich_text' = 'markdown',
    userId?: string,
  ): Promise<ArticleRow> {
    try {
      // 驗證權限如果提供了 userId
      // Verify permissions if userId provided
      if (userId) {
        const article = await this.getArticleById(articleId)
        await PermissionService.assertCanEditArticle(userId, article)
      }

      const { data, error } = await table('articles')
        .update({
          content,
          updated_at: new Date().toISOString(),
        })
        .eq('id', articleId)
        .select()
        .single()

      if (error) {
        throw new ArticleServiceError(
          `Failed to update article content: ${error.message}`,
          'UPDATE_CONTENT_ERROR',
          error as Error,
        )
      }

      if (!data) {
        throw new ArticleServiceError(
          `Article ${articleId} not found`,
          'ARTICLE_NOT_FOUND',
        )
      }

      return data
    } catch (err) {
      if (err instanceof ArticleServiceError) throw err
      throw new ArticleServiceError(
        `Unexpected error updating article content: ${err instanceof Error ? err.message : String(err)}`,
        'UPDATE_CONTENT_ERROR',
        err instanceof Error ? err : undefined,
      )
    }
  }

  /**
   * 取得文章詳細資訊
   * Get article details (wrapper for consistency)
   */
  static async getArticleDetails(articleId: string): Promise<ArticleRow> {
    return this.getArticleById(articleId)
  }

  /**
   * 驗證文章是否可編輯
   * Validate if article is editable
   */
  static async validateArticleEditable(articleId: string, userId: string): Promise<boolean> {
    try {
      const article = await this.getArticleById(articleId)
      await PermissionService.assertCanEditArticle(userId, article)
      return true
    } catch (err) {
      console.warn('文章編輯驗證失敗 / Article edit validation failed:', err)
      return false
    }
  }

  /**
   * 驗證文章是否可刪除
   * Validate if article is deletable
   */
  static async validateArticleDeletable(articleId: string, userId: string): Promise<boolean> {
    try {
      const article = await this.getArticleById(articleId)
      await PermissionService.assertCanDeleteArticle(userId, article)
      return true
    } catch (err) {
      console.warn('文章刪除驗證失敗 / Article delete validation failed:', err)
      return false
    }
  }

  /**
   * 取得文章編輯權限檢查
   * Check if user has edit permission for article
   */
  static async checkEditPermission(articleId: string, userId: string): Promise<boolean> {
    try {
      const article = await this.getArticleById(articleId)
      return await PermissionService.canEditArticle(userId, article)
    } catch (err) {
      console.error('權限檢查失敗 / Permission check failed:', err)
      return false
    }
  }

  /**
   * 軟刪除文章並記錄時間戳
   * Soft delete article with timestamp
   */
  static async softDeleteArticle(articleId: string, userId?: string): Promise<ArticleRow> {
    try {
      if (userId) {
        const article = await this.getArticleById(articleId)
        await PermissionService.assertCanDeleteArticle(userId, article)
      }

      const { data, error } = await table('articles')
        .update({
          deleted_at: new Date().toISOString(),
        })
        .eq('id', articleId)
        .select()
        .single()

      if (error) {
        throw new ArticleServiceError(
          `Failed to soft delete article: ${error.message}`,
          'DELETE_ERROR',
          error as Error,
        )
      }

      if (!data) {
        throw new ArticleServiceError(
          `Article ${articleId} not found`,
          'ARTICLE_NOT_FOUND',
        )
      }

      return data
    } catch (err) {
      if (err instanceof ArticleServiceError) throw err
      throw new ArticleServiceError(
        `Unexpected error deleting article: ${err instanceof Error ? err.message : String(err)}`,
        'DELETE_ERROR',
        err instanceof Error ? err : undefined,
      )
    }
  }

  // ============================================================================
  // Newsletter-Article Relationship Methods (Many-to-Many via Junction Table)
  // ============================================================================

  /**
   * Add an article to a newsletter
   * Creates a record in the newsletter_articles junction table
   * 
   * @param articleId Article ID
   * @param weekNumber Newsletter week number
   * @param articleOrder Position in the newsletter (optional, auto-calculated if not provided)
   * @param userId Optional user ID who is adding the article
   * @returns The created newsletter-article relationship
   */
  static async addArticleToNewsletter(
    articleId: string,
    weekNumber: string,
    articleOrder?: number,
    userId?: string,
  ): Promise<{ id: string; newsletter_id: string; article_id: string; article_order: number }> {
    try {
      // Look up newsletter UUID by week_number
      const newsletterId = await this.getNewsletterIdByWeek(weekNumber)
      if (!newsletterId) {
        throw new ArticleServiceError(
          `Newsletter not found for week ${weekNumber}`,
          'NEWSLETTER_NOT_FOUND',
        )
      }

      // Calculate next order if not provided
      let order = articleOrder
      if (order === undefined) {
        order = await this.getNextArticleOrderInNewsletter(weekNumber)
      }

      const { data, error } = await table('newsletter_articles')
        .insert({
          newsletter_id: newsletterId,
          article_id: articleId,
          article_order: order,
          added_by: userId || null,
        })
        .select()
        .single()

      if (error) {
        // Check for duplicate constraint violation
        if (error.code === '23505') {
          throw new ArticleServiceError(
            `Article is already in newsletter ${weekNumber}`,
            'DUPLICATE_ARTICLE_IN_NEWSLETTER',
            error as Error,
          )
        }
        throw new ArticleServiceError(
          `Failed to add article to newsletter: ${error.message}`,
          'ADD_TO_NEWSLETTER_ERROR',
          error as Error,
        )
      }

      if (!data) {
        throw new ArticleServiceError(
          'Failed to add article to newsletter: No data returned',
          'ADD_TO_NEWSLETTER_ERROR',
        )
      }

      return data
    } catch (err) {
      if (err instanceof ArticleServiceError) throw err
      throw new ArticleServiceError(
        `Unexpected error adding article to newsletter: ${err instanceof Error ? err.message : String(err)}`,
        'ADD_TO_NEWSLETTER_ERROR',
        err instanceof Error ? err : undefined,
      )
    }
  }

  /**
   * Remove an article from a newsletter
   * Deletes the record from the newsletter_articles junction table
   * 
   * @param articleId Article ID
   * @param weekNumber Newsletter week number
   */
  static async removeArticleFromNewsletter(articleId: string, weekNumber: string): Promise<void> {
    try {
      // Look up newsletter UUID by week_number
      const newsletterId = await this.getNewsletterIdByWeek(weekNumber)
      if (!newsletterId) {
        throw new ArticleServiceError(
          `Newsletter not found for week ${weekNumber}`,
          'NEWSLETTER_NOT_FOUND',
        )
      }

      const { error } = await table('newsletter_articles')
        .delete()
        .eq('newsletter_id', newsletterId)
        .eq('article_id', articleId)

      if (error) {
        throw new ArticleServiceError(
          `Failed to remove article from newsletter: ${error.message}`,
          'REMOVE_FROM_NEWSLETTER_ERROR',
          error as Error,
        )
      }
    } catch (err) {
      if (err instanceof ArticleServiceError) throw err
      throw new ArticleServiceError(
        `Unexpected error removing article from newsletter: ${err instanceof Error ? err.message : String(err)}`,
        'REMOVE_FROM_NEWSLETTER_ERROR',
        err instanceof Error ? err : undefined,
      )
    }
  }

  /**
   * Get all newsletters that contain a specific article
   * 
   * @param articleId Article ID
   * @returns Array of newsletter associations with week number and order
   */
  static async getNewslettersForArticle(
    articleId: string,
  ): Promise<Array<{ week_number: string; article_order: number; release_date?: string; status?: string }>> {
    try {
      const { data, error } = await table('newsletter_articles')
        .select(`
          newsletter_id,
          article_order,
          newsletters!inner (
            week_number,
            release_date,
            status
          )
        `)
        .eq('article_id', articleId)
        .order('article_order', { ascending: true })

      if (error) {
        throw new ArticleServiceError(
          `Failed to get newsletters for article: ${error.message}`,
          'GET_NEWSLETTERS_ERROR',
          error as Error,
        )
      }

      // Transform the response to flatten the nested newsletters
      return (data || []).map((row: any) => ({
        week_number: row.newsletters?.week_number || '',
        article_order: row.article_order,
        release_date: row.newsletters?.release_date,
        status: row.newsletters?.status,
      }))
    } catch (err) {
      if (err instanceof ArticleServiceError) throw err
      throw new ArticleServiceError(
        `Unexpected error getting newsletters for article: ${err instanceof Error ? err.message : String(err)}`,
        'GET_NEWSLETTERS_ERROR',
        err instanceof Error ? err : undefined,
      )
    }
  }

  /**
   * Get articles by week number using the junction table
   * This is the new preferred method for querying articles by newsletter
   * 
   * @param weekNumber ISO week format (e.g., "2025-W47")
   * @param filters Optional filtering options
   * @returns Articles with their order in this specific newsletter
   */
  static async getArticlesByWeekViaJunction(
    weekNumber: string,
    filters?: ArticleFilter,
  ): Promise<Array<ArticleRow & { newsletter_article_order: number }>> {
    try {
      // Look up newsletter UUID by week_number
      const newsletterId = await this.getNewsletterIdByWeek(weekNumber)
      if (!newsletterId) {
        return []
      }

      let query = table('newsletter_articles')
        .select(`
          article_order,
          articles!inner (*)
        `)
        .eq('newsletter_id', newsletterId)
        .order('article_order', { ascending: true })

      const { data, error } = await query

      if (error) {
        throw new ArticleServiceError(
          `Failed to fetch articles for week ${weekNumber}: ${error.message}`,
          'FETCH_ARTICLES_ERROR',
          error as Error,
        )
      }

      if (!data) {
        return []
      }

      // Transform and apply filters
      let articles = data.map((row: any) => ({
        ...row.articles,
        newsletter_article_order: row.article_order,
      }))

      // Apply filters
      if (filters?.isPublished !== undefined) {
        const status = filters.isPublished ? 'published' : 'draft'
        articles = articles.filter((a: ArticleRow) => a.status === status)
      }

      if (filters?.visibilityType) {
        articles = articles.filter((a: ArticleRow) => a.visibility_type === filters.visibilityType)
      }

      if (filters?.excludeDeleted !== false) {
        articles = articles.filter((a: ArticleRow) => a.deleted_at === null)
      }

      if (filters?.limit) {
        articles = articles.slice(0, filters.limit)
      }

      return articles
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
   * Get the next available article order for a newsletter via junction table
   * 
   * @param weekNumber Newsletter week number
   * @returns Next available order number
   */
  static async getNextArticleOrderInNewsletter(weekNumber: string): Promise<number> {
    try {
      // Look up newsletter UUID by week_number
      const newsletterId = await this.getNewsletterIdByWeek(weekNumber)
      if (!newsletterId) {
        return 1 // Default to 1 if newsletter not found
      }

      const { data, error } = await table('newsletter_articles')
        .select('article_order')
        .eq('newsletter_id', newsletterId)
        .order('article_order', { ascending: false })
        .limit(1)

      if (error) {
        throw new ArticleServiceError(
          `Failed to get next article order: ${error.message}`,
          'GET_ARTICLE_ORDER_ERROR',
          error as Error,
        )
      }

      if (!data || data.length === 0) {
        return 1
      }

      return (data[0]?.article_order || 0) + 1
    } catch (err) {
      if (err instanceof ArticleServiceError) throw err
      throw new ArticleServiceError(
        `Unexpected error getting next article order: ${err instanceof Error ? err.message : String(err)}`,
        'GET_ARTICLE_ORDER_ERROR',
        err instanceof Error ? err : undefined,
      )
    }
  }

  /**
   * Update article order within a newsletter
   * 
   * @param articleId Article ID
   * @param weekNumber Newsletter week number
   * @param newOrder New order position
   */
  static async updateArticleOrderInNewsletter(
    articleId: string,
    weekNumber: string,
    newOrder: number,
  ): Promise<void> {
    try {
      // Look up newsletter UUID by week_number
      const newsletterId = await this.getNewsletterIdByWeek(weekNumber)
      if (!newsletterId) {
        throw new ArticleServiceError(
          `Newsletter not found for week ${weekNumber}`,
          'NEWSLETTER_NOT_FOUND',
        )
      }

      const { error } = await table('newsletter_articles')
        .update({ article_order: newOrder })
        .eq('newsletter_id', newsletterId)
        .eq('article_id', articleId)

      if (error) {
        throw new ArticleServiceError(
          `Failed to update article order: ${error.message}`,
          'UPDATE_ORDER_ERROR',
          error as Error,
        )
      }
    } catch (err) {
      if (err instanceof ArticleServiceError) throw err
      throw new ArticleServiceError(
        `Unexpected error updating article order: ${err instanceof Error ? err.message : String(err)}`,
        'UPDATE_ORDER_ERROR',
        err instanceof Error ? err : undefined,
      )
    }
  }

  /**
   * Check if an article is in a specific newsletter
   */
  static async isArticleInNewsletter(articleId: string, weekNumber: string): Promise<boolean> {
    try {
      // Look up newsletter UUID by week_number
      const newsletterId = await this.getNewsletterIdByWeek(weekNumber)
      if (!newsletterId) {
        return false
      }

      const { data, error } = await table('newsletter_articles')
        .select('id')
        .eq('newsletter_id', newsletterId)
        .eq('article_id', articleId)
        .maybeSingle()

      if (error) {
        throw new ArticleServiceError(
          `Failed to check article in newsletter: ${error.message}`,
          'CHECK_ARTICLE_ERROR',
          error as Error,
        )
      }

      return data !== null
    } catch (err) {
      if (err instanceof ArticleServiceError) throw err
      throw new ArticleServiceError(
        `Unexpected error checking article in newsletter: ${err instanceof Error ? err.message : String(err)}`,
        'CHECK_ARTICLE_ERROR',
        err instanceof Error ? err : undefined,
      )
    }
  }
}

/**
 * Export service as default
 */
export default ArticleService
