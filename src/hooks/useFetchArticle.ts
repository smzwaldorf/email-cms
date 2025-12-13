/**
 * 自定義 Hook - 取得文章內容
 * Uses Supabase ArticleService for consistency with article list data
 * 優化：使用 useCallback 避免不必要的函數重新建立
 */

import { useState, useEffect, useCallback } from 'react'
import { Article } from '@/types'
import ArticleService from '@/services/ArticleService'
import type { ArticleRow } from '@/types/database'

interface UseFetchArticleResult {
  article: (Article & { newsletterId?: string }) | null
  isLoading: boolean
  error: Error | null
  refetch: () => Promise<void>
}

/**
 * Convert ArticleRow from database to Article type for UI
 * Now includes newsletter_id from the junction table lookup
 */
function convertArticleRow(
  row: ArticleRow & { newsletter_id?: string; week_number?: string },
  order?: number
): Article & { newsletterId?: string } {
  return {
    id: row.id,
    shortId: row.short_id,
    title: row.title,
    content: row.content,
    author: undefined, // Author name needs to be fetched from user_roles via author_id
    authorId: row.author_id || undefined,
    summary: row.title, // Use title as summary since DB doesn't have summary
    weekNumber: row.week_number || '',
    order: order || 0,
    slug: row.id, // Use ID as slug
    publicUrl: `/article/${row.id}`,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    isPublished: row.status === 'published',
    viewCount: 0, // Database doesn't track view count yet
    newsletterId: row.newsletter_id, // From junction table lookup
  }
}

export function useFetchArticle(articleId: string): UseFetchArticleResult {
  const [article, setArticle] = useState<(Article & { newsletterId?: string }) | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const refetch = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    // Skip fetch if articleId is empty or invalid placeholder
    if (!articleId || articleId === 'article-001') {
      setArticle(null)
      setIsLoading(false)
      return
    }

    try {
      // Use getArticleWithNewsletter to also fetch the associated newsletter ID
      const articleRow = await ArticleService.getArticleWithNewsletter(articleId)
      
      if (articleRow) {
        setArticle(convertArticleRow(articleRow))
      } else {
        setError(new Error('Article not found'))
      }
    } catch (err) {
      console.error('❌ useFetchArticle error:', err)
      setError(err instanceof Error ? err : new Error('Unknown error'))
    } finally {
      setIsLoading(false)
    }
  }, [articleId])

  useEffect(() => {
    refetch()
  }, [refetch])

  return { article, isLoading, error, refetch }
}
