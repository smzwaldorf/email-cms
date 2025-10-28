/**
 * 自定義 Hook - 取得週報及其文章清單
 */

import { useState, useEffect } from 'react'
import { Article, NewsletterWeek } from '@/types'
import { fetchNewsletter, fetchArticlesForWeek } from '@/services/mockApi'

interface UseFetchWeeklyResult {
  newsletter: NewsletterWeek | null
  articles: Article[]
  isLoading: boolean
  error: Error | null
  refetch: () => Promise<void>
}

export function useFetchWeekly(weekNumber: string): UseFetchWeeklyResult {
  const [newsletter, setNewsletter] = useState<NewsletterWeek | null>(null)
  const [articles, setArticles] = useState<Article[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const refetch = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const newsletterData = await fetchNewsletter(weekNumber)
      if (newsletterData) {
        setNewsletter(newsletterData)

        const articlesData = await fetchArticlesForWeek(weekNumber)
        setArticles(articlesData)
      } else {
        setError(new Error('Newsletter not found'))
      }
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'))
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    refetch()
  }, [weekNumber])

  return { newsletter, articles, isLoading, error, refetch }
}
