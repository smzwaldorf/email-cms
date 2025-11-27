/**
 * useFetchAllWeeks Hook
 * Fetches all available newsletter weeks for selection/navigation
 */

import { useState, useEffect } from 'react'
import { WeekService } from '@/services/WeekService'
import type { NewsletterWeekRow } from '@/types/database'

export interface UseFetchAllWeeksResult {
  weeks: NewsletterWeekRow[]
  isLoading: boolean
  error: Error | null
  refetch: () => Promise<void>
}

interface UseFetchAllWeeksOptions {
  publishedOnly?: boolean
  limit?: number
  sortOrder?: 'asc' | 'desc'
}

export function useFetchAllWeeks(options: UseFetchAllWeeksOptions = {}): UseFetchAllWeeksResult {
  const { publishedOnly = true, limit = 50, sortOrder = 'desc' } = options
  const [weeks, setWeeks] = useState<NewsletterWeekRow[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const refetch = async () => {
    setIsLoading(true)
    setError(null)
    try {
      console.log(`📥 Fetching ${publishedOnly ? 'published' : 'all'} weeks...`)
      const weeksData = publishedOnly
        ? await WeekService.getPublishedWeeks({
            sortBy: 'week',
            sortOrder,
            limit,
          })
        : await WeekService.getAllWeeks({
            sortBy: 'week',
            sortOrder,
            limit,
          })

      console.log(`✅ Fetched ${weeksData.length} weeks`)
      setWeeks(weeksData)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err)
      const error = new Error(`Failed to fetch weeks: ${errorMessage}`)
      console.error('❌ Error fetching weeks:', error)
      setError(error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    refetch()
  }, [publishedOnly, limit, sortOrder])

  return { weeks, isLoading, error, refetch }
}
