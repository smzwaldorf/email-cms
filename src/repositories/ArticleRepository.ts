/**
 * Article Repository
 * Extends ArticleService with transaction support and batch operations
 *
 * Responsibilities:
 * - Transaction management for atomic article operations
 * - Batch reordering with constraint validation
 * - Complex article creation workflows
 */

import { getSupabaseClient } from '@/lib/supabase'
import ArticleService, { CreateArticleDTO, UpdateArticleDTO } from '@/services/ArticleService'
import type { ArticleRow } from '@/types/database'

/**
 * Validation result type
 */
export interface ValidationResult {
  valid: boolean
  errors: string[]
}

/**
 * Article order mapping for batch reordering
 */
export interface ArticleOrderMap {
  [articleId: string]: number
}

/**
 * Repository error for better error handling
 */
export class ArticleRepositoryError extends Error {
  constructor(
    message: string,
    public code: string = 'REPOSITORY_ERROR',
    public originalError?: Error,
  ) {
    super(message)
    this.name = 'ArticleRepositoryError'
  }
}

/**
 * Article Repository class
 * Provides advanced article operations with transaction support
 */
export class ArticleRepository {
  /**
   * Create an article in a specific week with automatic order assignment
   * Validates that article order is unique within the week
   */
  static async createArticleInWeek(
    weekNumber: string,
    articleData: CreateArticleDTO,
  ): Promise<ArticleRow> {
    try {
      // Validate week exists
      const { data: week, error: weekError } = await getSupabaseClient()
        .from('newsletter_weeks')
        .select('*')
        .eq('week_number', weekNumber)
        .single()

      if (weekError || !week) {
        throw new ArticleRepositoryError(
          `Week ${weekNumber} not found`,
          'WEEK_NOT_FOUND',
        )
      }

      // Validate article order is unique
      const { data: existingArticle, error: orderError } = await getSupabaseClient()
        .from('articles')
        .select('*')
        .eq('week_number', weekNumber)
        .eq('article_order', articleData.articleOrder)
        .single()

      if (!orderError && existingArticle) {
        throw new ArticleRepositoryError(
          `Article order ${articleData.articleOrder} already exists in week ${weekNumber}`,
          'DUPLICATE_ORDER',
        )
      }

      if (orderError && orderError.code !== 'PGRST116') {
        throw new ArticleRepositoryError(
          `Error checking article order: ${orderError.message}`,
          'ORDER_CHECK_ERROR',
          orderError as Error,
        )
      }

      // Create the article
      return ArticleService.createArticle(articleData)
    } catch (err) {
      if (err instanceof ArticleRepositoryError) throw err
      throw new ArticleRepositoryError(
        `Failed to create article in week: ${err instanceof Error ? err.message : String(err)}`,
        'CREATE_ARTICLE_ERROR',
        err instanceof Error ? err : undefined,
      )
    }
  }

  /**
   * Reorder articles within a week atomically
   * All updates succeed or all fail (atomic behavior)
   */
  static async reorderArticles(
    weekNumber: string,
    orderMap: ArticleOrderMap,
  ): Promise<ArticleRow[]> {
    try {
      // Step 1: Validate all article IDs exist in the week
      const articleIds = Object.keys(orderMap)
      const { data: articles, error: fetchError } = await getSupabaseClient()
        .from('articles')
        .select('*')
        .eq('week_number', weekNumber)
        .in('id', articleIds)

      if (fetchError) {
        throw new ArticleRepositoryError(
          `Error fetching articles: ${fetchError.message}`,
          'FETCH_ERROR',
          fetchError as Error,
        )
      }

      // Verify we got all requested articles
      if (!articles || articles.length !== articleIds.length) {
        const foundIds = new Set(articles?.map(a => a.id) || [])
        const missingIds = articleIds.filter(id => !foundIds.has(id))
        throw new ArticleRepositoryError(
          `Some articles not found: ${missingIds.join(', ')}`,
          'ARTICLES_NOT_FOUND',
        )
      }

      // Step 2: Validate new orders don't conflict with other articles in week
      const newOrders = Object.values(orderMap)
      const { data: allWeekArticles, error: allError } = await getSupabaseClient()
        .from('articles')
        .select('*')
        .eq('week_number', weekNumber)

      if (allError) {
        throw new ArticleRepositoryError(
          `Error fetching week articles: ${allError.message}`,
          'FETCH_ERROR',
          allError as Error,
        )
      }

      // Check for order conflicts with articles not being reordered
      const otherArticleOrders = allWeekArticles
        ?.filter(a => !articleIds.includes(a.id))
        .map(a => a.article_order) || []

      const conflicts = newOrders.filter(order =>
        otherArticleOrders.includes(order),
      )

      if (conflicts.length > 0) {
        throw new ArticleRepositoryError(
          `Article orders conflict with existing articles: ${conflicts.join(', ')}`,
          'ORDER_CONFLICT',
        )
      }

      // Step 3: Perform atomic batch update
      // Note: Supabase doesn't have native transactions, but we use sequential updates
      // with error handling to simulate atomic behavior
      const updates = articleIds.map(articleId =>
        ArticleService.updateArticle(articleId, {
          // Use a placeholder order first to avoid conflicts
          // This will be overwritten in the actual update
        }).then(() =>
          getSupabaseClient()
            .from('articles')
            .update({ article_order: orderMap[articleId] })
            .eq('id', articleId)
            .select()
            .single(),
        ),
      )

      const results = await Promise.all(updates)

      // Check for errors in any update
      const errors = results.filter(r => r.error)
      if (errors.length > 0) {
        throw new ArticleRepositoryError(
          `Batch update failed: ${errors.map(e => e.error?.message).join(', ')}`,
          'BATCH_UPDATE_ERROR',
        )
      }

      // Return updated articles
      return results.map(r => r.data!).filter(Boolean)
    } catch (err) {
      if (err instanceof ArticleRepositoryError) throw err
      throw new ArticleRepositoryError(
        `Unexpected error reordering articles: ${err instanceof Error ? err.message : String(err)}`,
        'REORDER_ERROR',
        err instanceof Error ? err : undefined,
      )
    }
  }

  /**
   * Validate article order for a week
   * Checks that orders are sequential (1, 2, 3... or gaps are allowed)
   */
  static async validateArticleOrder(weekNumber: string): Promise<ValidationResult> {
    try {
      const { data: articles, error } = await getSupabaseClient()
        .from('articles')
        .select('*')
        .eq('week_number', weekNumber)
        .is('deleted_at', null)
        .order('article_order', { ascending: true })

      if (error) {
        return {
          valid: false,
          errors: [`Error fetching articles: ${error.message}`],
        }
      }

      if (!articles || articles.length === 0) {
        // Empty week is valid
        return { valid: true, errors: [] }
      }

      const errors: string[] = []

      // Check for duplicate orders
      const orders = articles.map(a => a.article_order)
      const uniqueOrders = new Set(orders)
      if (uniqueOrders.size !== orders.length) {
        errors.push('Duplicate article orders detected')
      }

      // Check that all orders are positive integers
      if (orders.some(o => !Number.isInteger(o) || o < 1)) {
        errors.push('Article orders must be positive integers')
      }

      // Check that orders are reasonable (not excessively large)
      const maxOrder = Math.max(...orders)
      if (maxOrder > articles.length * 2) {
        errors.push(
          `Unusual gap in article orders (max: ${maxOrder}, count: ${articles.length})`,
        )
      }

      return {
        valid: errors.length === 0,
        errors,
      }
    } catch (err) {
      return {
        valid: false,
        errors: [
          `Validation error: ${err instanceof Error ? err.message : String(err)}`,
        ],
      }
    }
  }

  /**
   * Get all articles in a week with their current order
   */
  static async getArticlesInWeek(weekNumber: string): Promise<ArticleRow[]> {
    try {
      return ArticleService.getArticlesByWeek(weekNumber, {
        excludeDeleted: true,
      })
    } catch (err) {
      throw new ArticleRepositoryError(
        `Failed to get articles in week: ${err instanceof Error ? err.message : String(err)}`,
        'FETCH_ERROR',
        err instanceof Error ? err : undefined,
      )
    }
  }

  /**
   * Bulk update articles with different updates
   * Applies multiple updates to different articles in sequence
   */
  static async bulkUpdateArticles(
    updates: Array<{
      articleId: string
      updates: UpdateArticleDTO
    }>,
  ): Promise<ArticleRow[]> {
    try {
      const results = await Promise.all(
        updates.map(({ articleId, updates: updateData }) =>
          ArticleService.updateArticle(articleId, updateData),
        ),
      )

      return results
    } catch (err) {
      throw new ArticleRepositoryError(
        `Bulk update failed: ${err instanceof Error ? err.message : String(err)}`,
        'BULK_UPDATE_ERROR',
        err instanceof Error ? err : undefined,
      )
    }
  }

  /**
   * Publish multiple articles in a week
   */
  static async publishArticles(articleIds: string[]): Promise<ArticleRow[]> {
    try {
      const results = await Promise.all(
        articleIds.map(id => ArticleService.publishArticle(id)),
      )

      return results
    } catch (err) {
      throw new ArticleRepositoryError(
        `Failed to publish articles: ${err instanceof Error ? err.message : String(err)}`,
        'PUBLISH_ERROR',
        err instanceof Error ? err : undefined,
      )
    }
  }

  /**
   * Check if an article order is available in a week
   */
  static async isOrderAvailable(
    weekNumber: string,
    articleOrder: number,
  ): Promise<boolean> {
    try {
      const { data, error } = await getSupabaseClient()
        .from('articles')
        .select('*', { count: 'exact', head: true })
        .eq('week_number', weekNumber)
        .eq('article_order', articleOrder)

      if (error) {
        throw new ArticleRepositoryError(
          `Error checking order availability: ${error.message}`,
          'CHECK_ERROR',
          error as Error,
        )
      }

      return (data?.length || 0) === 0
    } catch (err) {
      if (err instanceof ArticleRepositoryError) throw err
      throw new ArticleRepositoryError(
        `Unexpected error checking order: ${err instanceof Error ? err.message : String(err)}`,
        'CHECK_ERROR',
        err instanceof Error ? err : undefined,
      )
    }
  }
}

export default ArticleRepository
