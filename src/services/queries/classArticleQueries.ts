/**
 * Class-Aware Article Query Builder
 * Specialized queries for filtering articles by class-based visibility
 *
 * US3: Class-Based Article Visibility
 * - Returns all public articles + class-specific articles for family's children
 * - Filters by class enrollment
 * - Sorts by class grade year (DESC) for family multi-class viewing
 * - Performance: <100ms for family with up to 5 children
 * 
 * NOTE: All functions now accept newsletterId (UUID) directly instead of week_number.
 * Articles are linked to newsletters via the newsletter_articles junction table.
 */

import { table, getSupabaseClient } from '@/lib/supabase'
import type { ArticleRow, ClassRow } from '@/types/database'
import { ArticleServiceError } from '../ArticleService'

/**
 * Query result with metadata
 */
export interface ClassArticleQueryResult {
  articles: ArticleRow[]
  classes: ClassRow[]
  totalCount: number
  executionTimeMs?: number
}

/**
 * Get all articles visible to a family
 *
 * Returns:
 * 1. All public articles
 * 2. Class-restricted articles for children's enrolled classes
 *
 * Sorted by:
 * - Class grade year (DESC) - older kids first
 * - Article order (ASC) - within each class
 *
 * @param familyId Family UUID
 * @param newsletterId Newsletter UUID
 * @returns Articles visible to the family
 *
 * Performance Target (SC-005): <100ms for family with up to 5 children
 */
export async function getArticlesForFamily(
  familyId: string,
  newsletterId: string,
): Promise<ClassArticleQueryResult> {
  const startTime = Date.now()

  try {
    const supabase = getSupabaseClient()

    // Check if newsletter ID is provided
    if (!newsletterId) {
      return {
        articles: [],
        classes: [],
        totalCount: 0,
        executionTimeMs: Date.now() - startTime,
      }
    }

    // Step 1: Get all active classes for family's children
    const { data: childEnrollments, error: enrollError } = await table('child_class_enrollment')
      .select('class_id')
      .eq('family_id', familyId)
      .is('graduated_at', null)

    if (enrollError) {
      throw new ArticleServiceError(
        `Failed to fetch child enrollments: ${enrollError.message}`,
        'FETCH_ENROLLMENTS_ERROR',
        enrollError as Error,
      )
    }

    const enrolledClassIds = (childEnrollments || []).map((e) => e.class_id)

    // Step 2: Get class details (for sorting by grade year)
    let classes: ClassRow[] = []
    if (enrolledClassIds.length > 0) {
      const { data: classData, error: classError } = await table('classes')
        .select('*')
        .in('id', enrolledClassIds)
        .eq('is_active', true)
        .order('class_grade_year', { ascending: false })

      if (classError) {
        throw new ArticleServiceError(
          `Failed to fetch classes: ${classError.message}`,
          'FETCH_CLASSES_ERROR',
          classError as Error,
        )
      }

      classes = classData || []
    }

    // Step 3: Get all articles for this newsletter via junction table
    const { data: newsletterArticles, error: articlesError } = await supabase
      .from('newsletter_articles')
      .select(`
        article_order,
        targeting_mode,
        target_class_ids,
        articles!inner (*)
      `)
      .eq('newsletter_id', newsletterId)
      .order('article_order', { ascending: true })

    if (articlesError) {
      throw new ArticleServiceError(
        `Failed to fetch articles: ${articlesError.message}`,
        'FETCH_ARTICLES_ERROR',
        articlesError as Error,
      )
    }

    // Step 4: Filter articles based on visibility
    const allArticles: ArticleRow[] = []

    for (const row of newsletterArticles || []) {
      const article = {
        ...(row.articles as any),
        article_order: row.article_order,
      } as ArticleRow & { article_order: number }

      // Skip deleted or unpublished articles
      if (article.deleted_at || article.status !== 'published') continue

      const targetingMode = (row as any).targeting_mode ?? 'shared'
      const targetClassIds = ((row as any).target_class_ids ?? []) as string[]

      // Include shared articles for every eligible guardian.
      if (targetingMode === 'shared') {
        allArticles.push(article)
        continue
      }

      // Targeted articles require class match against guardian enrollment.
      const hasClassMatch = targetClassIds.some((classId) => enrolledClassIds.includes(classId))
      if (hasClassMatch) {
        allArticles.push(article)
      }
    }

    const executionTimeMs = Date.now() - startTime

    return {
      articles: allArticles,
      classes,
      totalCount: allArticles.length,
      executionTimeMs,
    }
  } catch (err) {
    if (err instanceof ArticleServiceError) throw err
    throw new ArticleServiceError(
      `Unexpected error in getArticlesForFamily: ${err instanceof Error ? err.message : String(err)}`,
      'QUERY_ERROR',
      err instanceof Error ? err : undefined,
    )
  }
}

/**
 * Get articles for a specific class
 *
 * @param classId Class ID
 * @param newsletterId Newsletter UUID
 * @returns Articles visible to the class
 */
export async function getArticlesForClass(
  classId: string,
  newsletterId: string,
): Promise<ArticleRow[]> {
  try {
    const supabase = getSupabaseClient()

    // Check if newsletter ID is provided
    if (!newsletterId) {
      return []
    }

    // Get all articles for this newsletter via junction table
    const { data: newsletterArticles, error: articlesError } = await supabase
      .from('newsletter_articles')
      .select(`
        article_order,
        targeting_mode,
        target_class_ids,
        articles!inner (*)
      `)
      .eq('newsletter_id', newsletterId)
      .order('article_order', { ascending: true })

    if (articlesError) {
      throw new ArticleServiceError(
        `Failed to fetch articles: ${articlesError.message}`,
        'FETCH_ARTICLES_ERROR',
        articlesError as Error,
      )
    }

    // Filter articles visible to this class
    const visibleArticles: ArticleRow[] = []

    for (const row of newsletterArticles || []) {
      const article = {
        ...(row.articles as any),
        article_order: row.article_order,
      } as ArticleRow & { article_order: number }

      // Skip deleted or unpublished
      if (article.deleted_at || article.status !== 'published') continue

      const targetingMode = (row as any).targeting_mode ?? 'shared'
      const targetClassIds = ((row as any).target_class_ids ?? []) as string[]
      if (targetingMode === 'shared') {
        visibleArticles.push(article)
        continue
      }

      if (targetClassIds.includes(classId)) {
        visibleArticles.push(article)
      }
    }

    return visibleArticles
  } catch (err) {
    if (err instanceof ArticleServiceError) throw err
    throw new ArticleServiceError(
      `Unexpected error in getArticlesForClass: ${err instanceof Error ? err.message : String(err)}`,
      'QUERY_ERROR',
      err instanceof Error ? err : undefined,
    )
  }
}

/**
 * Get articles with audit log for a specific class
 * Used for class-specific article history
 *
 * @param classId Class ID
 * @param articleId Article ID
 * @returns Article with audit log
 */
export async function getArticleWithAuditLogForClass(
  classId: string,
  articleId: string,
): Promise<{
  article: ArticleRow
  auditLog: any[]
}> {
  try {
    // Get the article
    const { data: article, error: articleError } = await table('articles')
      .select('*')
      .eq('id', articleId)
      .single()

    if (articleError || !article) {
      throw new ArticleServiceError(
        `Article ${articleId} not found`,
        'ARTICLE_NOT_FOUND',
        articleError instanceof Error ? articleError : undefined,
      )
    }

    // Verify class can see this article
    const canSeeArticle =
      article.visibility_type === 'public' ||
      (article.visibility_type === 'class_restricted' &&
        (article.restricted_to_classes as string[])?.includes(classId))

    if (!canSeeArticle) {
      throw new ArticleServiceError(
        `Class ${classId} is not authorized to view article ${articleId}`,
        'UNAUTHORIZED',
      )
    }

    // Get audit log
    const { data: auditLog, error: auditError } = await table('article_audit_log')
      .select('*')
      .eq('article_id', articleId)
      .order('changed_at', { ascending: false })

    if (auditError) {
      throw new ArticleServiceError(
        `Failed to fetch audit log: ${auditError.message}`,
        'FETCH_AUDIT_LOG_ERROR',
        auditError as Error,
      )
    }

    return {
      article,
      auditLog: auditLog || [],
    }
  } catch (err) {
    if (err instanceof ArticleServiceError) throw err
    throw new ArticleServiceError(
      `Unexpected error in getArticleWithAuditLogForClass: ${err instanceof Error ? err.message : String(err)}`,
      'QUERY_ERROR',
      err instanceof Error ? err : undefined,
    )
  }
}

/**
 * Count articles visible to a family
 * @param familyId Family UUID
 * @param newsletterId Newsletter UUID
 * @returns Number of visible articles
 */
export async function countArticlesForFamily(
  familyId: string,
  newsletterId: string,
): Promise<number> {
  try {
    const result = await getArticlesForFamily(familyId, newsletterId)
    return result.totalCount
  } catch (err) {
    if (err instanceof ArticleServiceError) throw err
    throw new ArticleServiceError(
      `Unexpected error counting articles: ${err instanceof Error ? err.message : String(err)}`,
      'COUNT_ERROR',
      err instanceof Error ? err : undefined,
    )
  }
}
