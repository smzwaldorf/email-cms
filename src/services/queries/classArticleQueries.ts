/**
 * Class-Aware Article Query Builder
 * Specialized queries for filtering articles by class-based visibility
 *
 * US3: Class-Based Article Visibility
 * - Returns all public articles + class-specific articles for family's children
 * - Filters by class enrollment
 * - Sorts by class grade year (DESC) for family multi-class viewing
 * - Performance: <100ms for family with up to 5 children
 */

import { table } from '@/lib/supabase'
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
 * @param weekNumber Week number (e.g., "2025-W47")
 * @returns Articles visible to the family
 *
 * Performance Target (SC-005): <100ms for family with up to 5 children
 */
export async function getArticlesForFamily(
  familyId: string,
  weekNumber: string,
): Promise<ClassArticleQueryResult> {
  const startTime = Date.now()

  try {
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

    // Step 3: Get public articles
    const { data: publicArticles, error: publicError } = await table('articles')
      .select('*')
      .eq('week_number', weekNumber)
      .eq('visibility_type', 'public')
      .eq('is_published', true)
      .is('deleted_at', null)
      .order('article_order', { ascending: true })

    if (publicError) {
      throw new ArticleServiceError(
        `Failed to fetch public articles: ${publicError.message}`,
        'FETCH_PUBLIC_ARTICLES_ERROR',
        publicError as Error,
      )
    }

    // Step 4: Get class-restricted articles for enrolled classes
    let classArticles: ArticleRow[] = []
    if (enrolledClassIds.length > 0) {
      const { data: restricted, error: restrictError } = await table('articles')
        .select('*')
        .eq('week_number', weekNumber)
        .eq('visibility_type', 'class_restricted')
        .eq('is_published', true)
        .is('deleted_at', null)

      if (restrictError) {
        throw new ArticleServiceError(
          `Failed to fetch restricted articles: ${restrictError.message}`,
          'FETCH_RESTRICTED_ARTICLES_ERROR',
          restrictError as Error,
        )
      }

      // Filter to only articles restricted to family's enrolled classes
      classArticles = (restricted || []).filter((article) => {
        if (!article.restricted_to_classes || article.restricted_to_classes.length === 0) {
          return false
        }
        return (article.restricted_to_classes as string[]).some((classId) =>
          enrolledClassIds.includes(classId)
        )
      })

      // Sort by class grade year (DESC) then by article order
      classArticles = classArticles.sort((a, b) => {
        // Find grade year for article's first restricted class
        const aClassId = (a.restricted_to_classes as string[])?.[0]
        const bClassId = (b.restricted_to_classes as string[])?.[0]

        const aClass = classes.find((c) => c.id === aClassId)
        const bClass = classes.find((c) => c.id === bClassId)

        const aGrade = aClass?.class_grade_year ?? 0
        const bGrade = bClass?.class_grade_year ?? 0

        // Sort by grade year DESC (older kids first)
        if (bGrade !== aGrade) {
          return bGrade - aGrade
        }

        // Then by article order
        return a.article_order - b.article_order
      })
    }

    // Step 5: Combine and deduplicate articles
    const articleMap = new Map<string, ArticleRow>()

    // Add public articles
    publicArticles?.forEach((article) => {
      articleMap.set(article.id, article)
    })

    // Add class articles (won't duplicate due to Map)
    classArticles.forEach((article) => {
      articleMap.set(article.id, article)
    })

    const allArticles = Array.from(articleMap.values())

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
 * @param weekNumber Week number
 * @returns Articles visible to the class
 */
export async function getArticlesForClass(
  classId: string,
  weekNumber: string,
): Promise<ArticleRow[]> {
  try {
    // Get both public and class-restricted articles
    const { data: publicArticles, error: publicError } = await table('articles')
      .select('*')
      .eq('week_number', weekNumber)
      .eq('visibility_type', 'public')
      .eq('is_published', true)
      .is('deleted_at', null)

    if (publicError) {
      throw new ArticleServiceError(
        `Failed to fetch public articles: ${publicError.message}`,
        'FETCH_PUBLIC_ARTICLES_ERROR',
        publicError as Error,
      )
    }

    const { data: restrictedArticles, error: restrictError } = await table('articles')
      .select('*')
      .eq('week_number', weekNumber)
      .eq('visibility_type', 'class_restricted')
      .eq('is_published', true)
      .is('deleted_at', null)

    if (restrictError) {
      throw new ArticleServiceError(
        `Failed to fetch restricted articles: ${restrictError.message}`,
        'FETCH_RESTRICTED_ARTICLES_ERROR',
        restrictError as Error,
      )
    }

    // Filter restricted articles to those that include this class
    const filteredRestricted = (restrictedArticles || []).filter((article) => {
      if (!article.restricted_to_classes || article.restricted_to_classes.length === 0) {
        return false
      }
      return (article.restricted_to_classes as string[]).includes(classId)
    })

    // Combine public and restricted articles
    const allArticles = [...(publicArticles || []), ...filteredRestricted]

    // Sort by article order
    allArticles.sort((a, b) => a.article_order - b.article_order)

    return allArticles
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
 * @param weekNumber Week number
 * @returns Number of visible articles
 */
export async function countArticlesForFamily(
  familyId: string,
  weekNumber: string,
): Promise<number> {
  try {
    const result = await getArticlesForFamily(familyId, weekNumber)
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
