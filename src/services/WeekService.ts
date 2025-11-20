/**
 * Week Service
 * Handles newsletter week operations (CRUD, publishing)
 */

import { getSupabaseClient, table } from '@/lib/supabase'
import type { NewsletterWeekRow } from '@/types/database'

/**
 * Pagination options
 */
export interface PaginationOptions {
  limit?: number
  offset?: number
  sortBy?: 'week' | 'release_date' | 'created_at'
  sortOrder?: 'asc' | 'desc'
}

/**
 * Service error for better error handling
 */
export class WeekServiceError extends Error {
  constructor(
    message: string,
    public code: string = 'WEEK_ERROR',
    public originalError?: Error,
  ) {
    super(message)
    this.name = 'WeekServiceError'
  }
}

/**
 * Week Service class
 * Provides methods for newsletter week management
 */
export class WeekService {
  /**
   * Get a specific week by week number
   * @param weekNumber ISO week format (e.g., "2025-W47")
   */
  static async getWeek(weekNumber: string): Promise<NewsletterWeekRow> {
    try {
      const { data, error } = await table('newsletter_weeks')
        .select('*')
        .eq('week_number', weekNumber)
        .single()

      if (error) {
        throw new WeekServiceError(
          `Failed to fetch week ${weekNumber}: ${error.message}`,
          'FETCH_WEEK_ERROR',
          error as Error,
        )
      }

      if (!data) {
        throw new WeekServiceError(
          `Week ${weekNumber} not found`,
          'WEEK_NOT_FOUND',
        )
      }

      return data
    } catch (err) {
      if (err instanceof WeekServiceError) throw err
      throw new WeekServiceError(
        `Unexpected error fetching week: ${err instanceof Error ? err.message : String(err)}`,
        'FETCH_WEEK_ERROR',
        err instanceof Error ? err : undefined,
      )
    }
  }

  /**
   * Create a new week
   */
  static async createWeek(weekNumber: string, releaseDate: Date | string): Promise<NewsletterWeekRow> {
    try {
      // Validate week format
      if (!this.isValidWeekNumber(weekNumber)) {
        throw new WeekServiceError(
          `Invalid week format: "${weekNumber}". Expected format: "YYYY-Www" (e.g., "2025-W47")`,
          'INVALID_WEEK_FORMAT',
        )
      }

      const releaseDateTime = releaseDate instanceof Date
        ? releaseDate.toISOString().split('T')[0]
        : releaseDate

      const { data, error } = await table('newsletter_weeks')
        .insert([
          {
            week_number: weekNumber,
            release_date: releaseDateTime,
            is_published: false,
            created_at: new Date().toISOString(),
          },
        ])
        .select()
        .single()

      if (error) {
        throw new WeekServiceError(
          `Failed to create week ${weekNumber}: ${error.message}`,
          'CREATE_WEEK_ERROR',
          error as Error,
        )
      }

      if (!data) {
        throw new WeekServiceError(
          'Week creation returned no data',
          'CREATE_WEEK_ERROR',
        )
      }

      return data
    } catch (err) {
      if (err instanceof WeekServiceError) throw err
      throw new WeekServiceError(
        `Unexpected error creating week: ${err instanceof Error ? err.message : String(err)}`,
        'CREATE_WEEK_ERROR',
        err instanceof Error ? err : undefined,
      )
    }
  }

  /**
   * Publish a week (make it visible to readers)
   */
  static async publishWeek(weekNumber: string): Promise<NewsletterWeekRow> {
    try {
      const { data, error } = await table('newsletter_weeks')
        .update({ is_published: true })
        .eq('week_number', weekNumber)
        .select()
        .single()

      if (error) {
        throw new WeekServiceError(
          `Failed to publish week ${weekNumber}: ${error.message}`,
          'PUBLISH_WEEK_ERROR',
          error as Error,
        )
      }

      if (!data) {
        throw new WeekServiceError(
          `Week ${weekNumber} not found for publishing`,
          'WEEK_NOT_FOUND',
        )
      }

      return data
    } catch (err) {
      if (err instanceof WeekServiceError) throw err
      throw new WeekServiceError(
        `Unexpected error publishing week: ${err instanceof Error ? err.message : String(err)}`,
        'PUBLISH_WEEK_ERROR',
        err instanceof Error ? err : undefined,
      )
    }
  }

  /**
   * Unpublish a week (make it invisible to readers)
   */
  static async unpublishWeek(weekNumber: string): Promise<NewsletterWeekRow> {
    try {
      const { data, error } = await table('newsletter_weeks')
        .update({ is_published: false })
        .eq('week_number', weekNumber)
        .select()
        .single()

      if (error) {
        throw new WeekServiceError(
          `Failed to unpublish week ${weekNumber}: ${error.message}`,
          'UNPUBLISH_WEEK_ERROR',
          error as Error,
        )
      }

      if (!data) {
        throw new WeekServiceError(
          `Week ${weekNumber} not found for unpublishing`,
          'WEEK_NOT_FOUND',
        )
      }

      return data
    } catch (err) {
      if (err instanceof WeekServiceError) throw err
      throw new WeekServiceError(
        `Unexpected error unpublishing week: ${err instanceof Error ? err.message : String(err)}`,
        'UNPUBLISH_WEEK_ERROR',
        err instanceof Error ? err : undefined,
      )
    }
  }

  /**
   * Get all weeks with optional pagination and sorting
   */
  static async getAllWeeks(options?: PaginationOptions): Promise<NewsletterWeekRow[]> {
    try {
      let query = table('newsletter_weeks').select('*')

      // Determine sort column
      const sortColumn = options?.sortBy === 'release_date'
        ? 'release_date'
        : options?.sortBy === 'created_at'
          ? 'created_at'
          : 'week_number'

      const sortOrder = options?.sortOrder === 'asc' ? true : false

      query = query.order(sortColumn, { ascending: sortOrder })

      // Apply pagination
      if (options?.limit) {
        const offset = options?.offset || 0
        query = query.range(offset, offset + options.limit - 1)
      }

      const { data, error } = await query

      if (error) {
        throw new WeekServiceError(
          `Failed to fetch weeks: ${error.message}`,
          'FETCH_WEEKS_ERROR',
          error as Error,
        )
      }

      return data || []
    } catch (err) {
      if (err instanceof WeekServiceError) throw err
      throw new WeekServiceError(
        `Unexpected error fetching weeks: ${err instanceof Error ? err.message : String(err)}`,
        'FETCH_WEEKS_ERROR',
        err instanceof Error ? err : undefined,
      )
    }
  }

  /**
   * Get published weeks
   */
  static async getPublishedWeeks(options?: PaginationOptions): Promise<NewsletterWeekRow[]> {
    try {
      let query = table('newsletter_weeks')
        .select('*')
        .eq('is_published', true)

      const sortOrder = options?.sortOrder === 'asc' ? true : false
      query = query.order('week_number', { ascending: sortOrder })

      if (options?.limit) {
        const offset = options?.offset || 0
        query = query.range(offset, offset + options.limit - 1)
      }

      const { data, error } = await query

      if (error) {
        throw new WeekServiceError(
          `Failed to fetch published weeks: ${error.message}`,
          'FETCH_WEEKS_ERROR',
          error as Error,
        )
      }

      return data || []
    } catch (err) {
      if (err instanceof WeekServiceError) throw err
      throw new WeekServiceError(
        `Unexpected error fetching published weeks: ${err instanceof Error ? err.message : String(err)}`,
        'FETCH_WEEKS_ERROR',
        err instanceof Error ? err : undefined,
      )
    }
  }

  /**
   * Get the latest published week
   */
  static async getLatestPublishedWeek(): Promise<NewsletterWeekRow | null> {
    try {
      const { data, error } = await table('newsletter_weeks')
        .select('*')
        .eq('is_published', true)
        .order('week_number', { ascending: false })
        .limit(1)
        .single()

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
        throw new WeekServiceError(
          `Failed to fetch latest week: ${error.message}`,
          'FETCH_WEEK_ERROR',
          error as Error,
        )
      }

      return data || null
    } catch (err) {
      if (err instanceof WeekServiceError) throw err
      throw new WeekServiceError(
        `Unexpected error fetching latest week: ${err instanceof Error ? err.message : String(err)}`,
        'FETCH_WEEK_ERROR',
        err instanceof Error ? err : undefined,
      )
    }
  }

  /**
   * Check if a week exists
   */
  static async weekExists(weekNumber: string): Promise<boolean> {
    try {
      const { count, error } = await table('newsletter_weeks')
        .select('*', { count: 'exact', head: true })
        .eq('week_number', weekNumber)

      if (error) {
        throw new WeekServiceError(
          `Failed to check week existence: ${error.message}`,
          'CHECK_WEEK_ERROR',
          error as Error,
        )
      }

      return (count || 0) > 0
    } catch (err) {
      if (err instanceof WeekServiceError) throw err
      throw new WeekServiceError(
        `Unexpected error checking week existence: ${err instanceof Error ? err.message : String(err)}`,
        'CHECK_WEEK_ERROR',
        err instanceof Error ? err : undefined,
      )
    }
  }

  /**
   * Validate week number format
   * Format: "YYYY-Www" (e.g., "2025-W47")
   */
  static isValidWeekNumber(weekNumber: string): boolean {
    return /^\d{4}-W\d{2}$/.test(weekNumber)
  }

  /**
   * Generate next week number from current date
   */
  static getCurrentWeekNumber(date: Date = new Date()): string {
    const year = date.getFullYear()
    const startDate = new Date(year, 0, 1)
    const days = Math.floor((date.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000))
    const weekNumber = Math.ceil((days + startDate.getDay() + 1) / 7)
    return `${year}-W${String(weekNumber).padStart(2, '0')}`
  }
}

/**
 * Export service as default
 */
export default WeekService
