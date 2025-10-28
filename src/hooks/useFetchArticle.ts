/**
 * 自定義 Hook - 取得文章內容
 */

import { useState, useEffect } from 'react'
import { Article } from '@/types'
import { fetchArticle } from '@/services/mockApi'

interface UseFetchArticleResult {
  article: Article | null
  isLoading: boolean
  error: Error | null
  refetch: () => Promise<void>
}

export function useFetchArticle(articleId: string): UseFetchArticleResult {
  const [article, setArticle] = useState<Article | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const refetch = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const data = await fetchArticle(articleId)
      if (data) {
        setArticle(data)
      } else {
        setError(new Error('Article not found'))
      }
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'))
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    refetch()
  }, [articleId])

  return { article, isLoading, error, refetch }
}
