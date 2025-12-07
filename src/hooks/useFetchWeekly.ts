/**
 * 自定義 Hook - 取得週報及其文章清單
 * Uses real Supabase services instead of mock data
 */

import { useState, useEffect } from 'react'
import { Article, NewsletterWeek } from '@/types'
import WeekService from '@/services/WeekService'
import ArticleService from '@/services/ArticleService'
import type { ArticleRow, NewsletterWeekRow } from '@/types/database'

interface UseFetchWeeklyResult {
  newsletter: NewsletterWeek | null
  articles: Article[]
  isLoading: boolean
  error: Error | null
  refetch: () => Promise<void>
}

/**
 * Convert ArticleRow from database to Article type for UI
 */
function convertArticleRow(row: ArticleRow, order: number): Article {
  return {
    id: row.id,
    shortId: row.short_id,
    title: row.title,
    content: row.content,
    author: row.author || undefined,
    summary: row.title, // Use title as summary since DB doesn't have summary
    weekNumber: row.week_number,
    order,
    slug: row.id, // Use ID as slug
    publicUrl: `/article/${row.id}`,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    isPublished: row.is_published,
    viewCount: 0, // Database doesn't track view count yet
  }
}

/**
 * Convert NewsletterWeekRow from database to NewsletterWeek type for UI
 */
function convertWeekRow(row: NewsletterWeekRow, articleCount: number): NewsletterWeek {
  return {
    weekNumber: row.week_number,
    releaseDate: row.release_date,
    totalArticles: articleCount,
    articleIds: [], // Will be populated with article IDs
    isPublished: row.is_published,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

import { useAuth } from '@/context/AuthContext'

export function useFetchWeekly(weekNumber: string): UseFetchWeeklyResult {
  const { user } = useAuth()
  const [newsletter, setNewsletter] = useState<NewsletterWeek | null>(null)
  const [articles, setArticles] = useState<Article[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const refetch = async () => {
    setIsLoading(true)
    setError(null)
    try {
      // Fetch the week from Supabase
      const weekData = await WeekService.getWeek(weekNumber)

      // Fetch articles for the week
      const articlesData = await ArticleService.getArticlesByWeek(weekNumber, {
        excludeDeleted: true,
      })
      
      // Convert to UI types
      const convertedArticles = articlesData.map((row, index) =>
        convertArticleRow(row, index + 1)
      )

      const convertedWeek = convertWeekRow(weekData, articlesData.length)
      convertedWeek.articleIds = convertedArticles.map(a => a.id)

      setNewsletter(convertedWeek)
      setArticles(convertedArticles)
    } catch (err) {
      console.error('❌ useFetchWeekly error:', err)
      const errorMessage = err instanceof Error ? err.message : String(err)
      setError(new Error(errorMessage))
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    // Reset state when user changes to avoid showing stale data
    setArticles([])
    setNewsletter(null)
    refetch()
  }, [weekNumber, user?.id])

  return { newsletter, articles, isLoading, error, refetch }
}
