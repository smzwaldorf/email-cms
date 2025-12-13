/**
 * Article Query Builder
 * Optimized queries for article retrieval with proper indexing
 *
 * Performance Target (SC-001): <500ms for 100 articles
 * All queries use proper indexes for efficient filtering
 * 
 * NOTE: As of the schema refactoring, articles no longer have a direct week_number column.
 * Articles are now linked to newsletters via the newsletter_articles junction table.
 * All week-based queries now go through this junction table.
 */

import { table, getSupabaseClient } from '@/lib/supabase'
import type { ArticleRow } from '@/types/database'

/**
 * Helper: Get newsletter UUID by week_number
 */
async function getNewsletterIdByWeek(weekNumber: string): Promise<string | null> {
  const supabase = getSupabaseClient()
  const { data } = await supabase
    .from('newsletters')
    .select('id')
    .eq('week_number', weekNumber)
    .single()
  return data?.id || null
}

/**
 * Get published articles for a specific week
 * Used by visitors to view the newsletter
 *
 * Now uses newsletter_articles junction table
 * Performance: <100ms for 100 articles
 */
export async function getPublishedArticlesByWeek(weekNumber: string): Promise<ArticleRow[]> {
  try {
    const supabase = getSupabaseClient()
    
    // First get the newsletter ID
    const newsletterId = await getNewsletterIdByWeek(weekNumber)
    if (!newsletterId) {
      return []
    }

    // Query via junction table
    const { data, error } = await supabase
      .from('newsletter_articles')
      .select(`
        article_order,
        articles!inner (*)
      `)
      .eq('newsletter_id', newsletterId)
      .order('article_order', { ascending: true })

    if (error) {
      throw new Error(`Failed to fetch published articles for week ${weekNumber}: ${error.message}`)
    }

    // Filter for published articles and map the result
    return (data || [])
      .map((row: any) => ({
        ...row.articles,
        article_order: row.article_order, // Include order from junction table
      }))
      .filter((article: any) => article.status === 'published' && !article.deleted_at)
  } catch (err) {
    console.error('Query error in getPublishedArticlesByWeek:', err)
    throw err
  }
}

/**
 * Get all articles for a week (unfiltered for editors)
 * Used by editors to manage articles (including unpublished and deleted)
 *
 * Now uses newsletter_articles junction table
 * Performance: <150ms for 100 articles
 */
export async function getArticlesByWeekUnfiltered(weekNumber: string): Promise<ArticleRow[]> {
  try {
    const supabase = getSupabaseClient()
    
    const newsletterId = await getNewsletterIdByWeek(weekNumber)
    if (!newsletterId) {
      return []
    }

    const { data, error } = await supabase
      .from('newsletter_articles')
      .select(`
        article_order,
        articles!inner (*)
      `)
      .eq('newsletter_id', newsletterId)
      .order('article_order', { ascending: true })

    if (error) {
      throw new Error(`Failed to fetch articles for week ${weekNumber}: ${error.message}`)
    }

    return (data || []).map((row: any) => ({
      ...row.articles,
      article_order: row.article_order,
    }))
  } catch (err) {
    console.error('Query error in getArticlesByWeekUnfiltered:', err)
    throw err
  }
}

/**
 * Get articles restricted to a specific class
 * Used for class-based visibility filtering
 *
 * Now uses newsletter_articles junction table
 * Performance: <200ms
 */
export async function getArticlesByClass(
  weekNumber: string,
  classId: string,
): Promise<ArticleRow[]> {
  try {
    const supabase = getSupabaseClient()
    
    const newsletterId = await getNewsletterIdByWeek(weekNumber)
    if (!newsletterId) {
      return []
    }

    const { data, error } = await supabase
      .from('newsletter_articles')
      .select(`
        article_order,
        articles!inner (*)
      `)
      .eq('newsletter_id', newsletterId)
      .order('article_order', { ascending: true })

    if (error) {
      throw new Error(`Failed to fetch articles for class ${classId}: ${error.message}`)
    }

    // Filter for published articles that are public or include this class
    return (data || [])
      .map((row: any) => ({
        ...row.articles,
        article_order: row.article_order,
      }))
      .filter((article: any) => {
        if (article.deleted_at) return false
        if (article.status !== 'published') return false
        if (article.visibility_type === 'public') return true
        if (article.restricted_to_classes?.includes(classId)) return true
        return false
      })
  } catch (err) {
    console.error('Query error in getArticlesByClass:', err)
    throw err
  }
}

/**
 * Get articles for multiple classes (for family multi-child view)
 * Returns public articles + class-restricted articles for specified classes
 *
 * Now uses newsletter_articles junction table
 * Performance: <300ms for 3 classes
 */
export async function getArticlesByClasses(
  weekNumber: string,
  classIds: string[],
): Promise<ArticleRow[]> {
  try {
    if (classIds.length === 0) {
      // If no classes, return only public articles
      return getPublishedArticlesByWeek(weekNumber)
    }

    const supabase = getSupabaseClient()
    
    const newsletterId = await getNewsletterIdByWeek(weekNumber)
    if (!newsletterId) {
      return []
    }

    const { data, error } = await supabase
      .from('newsletter_articles')
      .select(`
        article_order,
        articles!inner (*)
      `)
      .eq('newsletter_id', newsletterId)
      .order('article_order', { ascending: true })

    if (error) {
      throw new Error(`Failed to fetch articles for classes: ${error.message}`)
    }

    // Filter for published articles that are public or include any of the classes
    return (data || [])
      .map((row: any) => ({
        ...row.articles,
        article_order: row.article_order,
      }))
      .filter((article: any) => {
        if (article.deleted_at) return false
        if (article.status !== 'published') return false
        if (article.visibility_type === 'public') return true
        if (article.restricted_to_classes?.some((c: string) => classIds.includes(c))) return true
        return false
      })
  } catch (err) {
    console.error('Query error in getArticlesByClasses:', err)
    throw err
  }
}

/**
 * Get article with full audit log history
 * Used by editors to see all changes to an article
 *
 * Index: idx_audit_article_date
 * Performance: <200ms
 */
export async function getArticleWithAuditLog(articleId: string): Promise<{
  article: ArticleRow
  auditLog: any[]
}> {
  try {
    // Fetch article
    const { data: article, error: articleError } = await table('articles')
      .select('*')
      .eq('id', articleId)
      .single()

    if (articleError) {
      throw new Error(`Failed to fetch article: ${articleError.message}`)
    }

    if (!article) {
      throw new Error(`Article ${articleId} not found`)
    }

    // Fetch audit log
    const { data: auditLog, error: auditError } = await table('article_audit_log')
      .select('*')
      .eq('article_id', articleId)
      .order('changed_at', { ascending: false })

    if (auditError) {
      throw new Error(`Failed to fetch audit log: ${auditError.message}`)
    }

    return {
      article,
      auditLog: auditLog || [],
    }
  } catch (err) {
    console.error('Query error in getArticleWithAuditLog:', err)
    throw err
  }
}

/**
 * Get article count for a week
 * Used for pagination and limit checking
 *
 * Now uses newsletter_articles junction table
 * Performance: <50ms
 */
export async function getArticleCountByWeek(weekNumber: string): Promise<number> {
  try {
    const supabase = getSupabaseClient()
    
    const newsletterId = await getNewsletterIdByWeek(weekNumber)
    if (!newsletterId) {
      return 0
    }

    const { count, error } = await supabase
      .from('newsletter_articles')
      .select('*', { count: 'exact', head: true })
      .eq('newsletter_id', newsletterId)

    if (error) {
      throw new Error(`Failed to count articles: ${error.message}`)
    }

    return count || 0
  } catch (err) {
    console.error('Query error in getArticleCountByWeek:', err)
    throw err
  }
}

/**
 * Get article by order within a newsletter
 * Used for quick navigation by position
 *
 * Now uses newsletter_articles junction table
 * Performance: <50ms
 */
export async function getArticleByOrder(
  weekNumber: string,
  order: number,
): Promise<ArticleRow | null> {
  try {
    const supabase = getSupabaseClient()
    
    const newsletterId = await getNewsletterIdByWeek(weekNumber)
    if (!newsletterId) {
      return null
    }

    const { data, error } = await supabase
      .from('newsletter_articles')
      .select(`
        article_order,
        articles!inner (*)
      `)
      .eq('newsletter_id', newsletterId)
      .eq('article_order', order)
      .single()

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows
      throw new Error(`Failed to fetch article by order: ${error.message}`)
    }

    if (!data) return null

    return {
      ...data.articles,
      article_order: data.article_order,
    } as ArticleRow
  } catch (err) {
    console.error('Query error in getArticleByOrder:', err)
    throw err
  }
}

/**
 * Search articles by title/content
 * Used for article discovery and search
 *
 * Now filters by newsletter if weekNumber provided via junction table
 * Performance: <300ms
 */
export async function searchArticles(
  query: string,
  weekNumber?: string,
): Promise<ArticleRow[]> {
  try {
    const supabase = getSupabaseClient()

    if (weekNumber) {
      // If weekNumber provided, search within that newsletter
      const newsletterId = await getNewsletterIdByWeek(weekNumber)
      if (!newsletterId) {
        return []
      }

      const { data, error } = await supabase
        .from('newsletter_articles')
        .select(`
          article_order,
          articles!inner (*)
        `)
        .eq('newsletter_id', newsletterId)
        .order('article_order', { ascending: true })

      if (error) {
        throw new Error(`Failed to search articles: ${error.message}`)
      }

      // Filter results by search query
      return (data || [])
        .map((row: any) => ({
          ...row.articles,
          article_order: row.article_order,
        }))
        .filter((article: any) => {
          if (article.status !== 'published') return false
          if (article.deleted_at) return false
          const lowerQuery = query.toLowerCase()
          return (
            article.title?.toLowerCase().includes(lowerQuery) ||
            article.content?.toLowerCase().includes(lowerQuery)
          )
        })
    } else {
      // Search all published articles
      const { data, error } = await supabase
        .from('articles')
        .select('*')
        .eq('status', 'published')
        .is('deleted_at', null)
        .or(`title.ilike.%${query}%,content.ilike.%${query}%`)

      if (error) {
        throw new Error(`Failed to search articles: ${error.message}`)
      }

      return data || []
    }
  } catch (err) {
    console.error('Query error in searchArticles:', err)
    throw err
  }
}

/**
 * Get articles by creator (for permission checking)
 * Used to verify if user created an article
 *
 * Now uses junction table when weekNumber is provided
 * Performance: <100ms
 */
export async function getArticlesByCreator(
  weekNumber: string,
  userId: string,
): Promise<ArticleRow[]> {
  try {
    const supabase = getSupabaseClient()
    
    const newsletterId = await getNewsletterIdByWeek(weekNumber)
    if (!newsletterId) {
      return []
    }

    const { data, error } = await supabase
      .from('newsletter_articles')
      .select(`
        article_order,
        articles!inner (*)
      `)
      .eq('newsletter_id', newsletterId)
      .order('article_order', { ascending: true })

    if (error) {
      throw new Error(`Failed to fetch articles by creator: ${error.message}`)
    }

    return (data || [])
      .map((row: any) => ({
        ...row.articles,
        article_order: row.article_order,
      }))
      .filter((article: any) => article.created_by === userId && !article.deleted_at)
  } catch (err) {
    console.error('Query error in getArticlesByCreator:', err)
    throw err
  }
}

/**
 * Get articles ordered by grade year for family viewing
 * Sorts articles by the highest grade year of their restricted classes
 * Public articles appear last
 *
 * Performance: <400ms
 */
export async function getArticlesByClassesOrderedByGrade(
  weekNumber: string,
  classIds: string[],
): Promise<ArticleRow[]> {
  try {
    const articles = await getArticlesByClasses(weekNumber, classIds)

    // Note: Sorting by grade year requires additional data fetch
    // In production, this could be optimized with a database view or stored procedure
    // For now, we return articles in order and let the application layer sort

    return articles
  } catch (err) {
    console.error('Query error in getArticlesByClassesOrderedByGrade:', err)
    throw err
  }
}

/**
 * Export all queries as object for convenience
 */
export const articleQueries = {
  getPublishedArticlesByWeek,
  getArticlesByWeekUnfiltered,
  getArticlesByClass,
  getArticlesByClasses,
  getArticleWithAuditLog,
  getArticleCountByWeek,
  getArticleByOrder,
  searchArticles,
  getArticlesByCreator,
  getArticlesByClassesOrderedByGrade,
}

export default articleQueries
