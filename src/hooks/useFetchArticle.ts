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
  article: Article | null
  isLoading: boolean
  error: Error | null
  refetch: () => Promise<void>
}

/**
 * Convert ArticleRow from database to Article type for UI
 */
function convertArticleRow(row: ArticleRow, order?: number): Article {
  return {
    id: row.id,
    title: row.title,
    content: row.content,
    author: row.author || undefined,
    summary: row.title, // Use title as summary since DB doesn't have summary
    weekNumber: row.week_number,
    order: order || row.article_order || 0,
    slug: row.id, // Use ID as slug
    publicUrl: `/article/${row.id}`,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    isPublished: row.is_published,
    viewCount: 0, // Database doesn't track view count yet
  }
}

export function useFetchArticle(articleId: string): UseFetchArticleResult {
  const [article, setArticle] = useState<Article | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const refetch = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const articleRow = await ArticleService.getArticleById(articleId)
      if (articleRow) {
        setArticle(convertArticleRow(articleRow))
      } else {
        setError(new Error('Article not found'))
      }
    } catch (err) {
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
