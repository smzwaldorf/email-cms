/**
 * Newsletter Service
 * Handles newsletter operations (CRUD, publishing)
 */

import { table } from '@/lib/supabase'
import type { NewsletterRow } from '@/types/database'

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
 * Newsletter Service class
 * Provides methods for newsletter management
 */
export class WeekService {
  /**
   * Helper to check if a string looks like a UUID
   */
  private static isUUID(str: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str)
  }

  /**
   * Get a specific newsletter by week number or newsletter id
   * @param newsletterId ISO week format (e.g., "2025-W47") or newsletter UUID
   */
  static async getWeek(newsletterId: string): Promise<NewsletterRow> {
    try {
      // Determine if the input is a UUID or week_number
      const isId = this.isUUID(newsletterId)
      const queryField = isId ? 'id' : 'week_number'
      
      const { data, error } = await table('newsletters')
        .select('*')
        .eq(queryField, newsletterId)
        .single()

      if (error) {
        throw new WeekServiceError(
          `Failed to fetch newsletter ${newsletterId}: ${error.message}`,
          'FETCH_WEEK_ERROR',
          error as Error,
        )
      }

      if (!data) {
        throw new WeekServiceError(
          `Newsletter ${newsletterId} not found`,
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
   * Create a new newsletter
   */
  static async createWeek(weekNumber: string, releaseDate: Date | string): Promise<NewsletterRow> {
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

      const { data, error } = await table('newsletters')
        .insert([
          {
            week_number: weekNumber,
            release_date: releaseDateTime,
            status: 'draft',
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
   * Publish a newsletter (make it visible to readers)
   */
  static async publishWeek(weekNumber: string): Promise<NewsletterRow> {
    try {
      const { data, error } = await table('newsletters')
        .update({ status: 'published', published_at: new Date().toISOString() })
        .eq('week_number', weekNumber)
        .select()
        .single()

      if (error) {
        throw new WeekServiceError(
          `Failed to publish newsletter ${weekNumber}: ${error.message}`,
          'PUBLISH_WEEK_ERROR',
          error as Error,
        )
      }

      if (!data) {
        throw new WeekServiceError(
          `Newsletter ${weekNumber} not found for publishing`,
          'WEEK_NOT_FOUND',
        )
      }

      return data
    } catch (err) {
      if (err instanceof WeekServiceError) throw err
      throw new WeekServiceError(
        `Unexpected error publishing newsletter: ${err instanceof Error ? err.message : String(err)}`,
        'PUBLISH_WEEK_ERROR',
        err instanceof Error ? err : undefined,
      )
    }
  }

  /**
   * Unpublish a newsletter (set to draft)
   */
  static async unpublishWeek(weekNumber: string): Promise<NewsletterRow> {
    try {
      const { data, error } = await table('newsletters')
        .update({ status: 'draft' })
        .eq('week_number', weekNumber)
        .select()
        .single()

      if (error) {
        throw new WeekServiceError(
          `Failed to unpublish newsletter ${weekNumber}: ${error.message}`,
          'UNPUBLISH_WEEK_ERROR',
          error as Error,
        )
      }

      if (!data) {
        throw new WeekServiceError(
          `Newsletter ${weekNumber} not found for unpublishing`,
          'WEEK_NOT_FOUND',
        )
      }

      return data
    } catch (err) {
      if (err instanceof WeekServiceError) throw err
      throw new WeekServiceError(
        `Unexpected error unpublishing newsletter: ${err instanceof Error ? err.message : String(err)}`,
        'UNPUBLISH_WEEK_ERROR',
        err instanceof Error ? err : undefined,
      )
    }
  }

  /**
   * Get all newsletters with optional pagination and sorting
   */
  static async getAllWeeks(options?: PaginationOptions): Promise<NewsletterRow[]> {
    try {
      let query = table('newsletters').select('*')

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
          `Failed to fetch newsletters: ${error.message}`,
          'FETCH_WEEKS_ERROR',
          error as Error,
        )
      }

      return data || []
    } catch (err) {
      if (err instanceof WeekServiceError) throw err
      throw new WeekServiceError(
        `Unexpected error fetching newsletters: ${err instanceof Error ? err.message : String(err)}`,
        'FETCH_WEEKS_ERROR',
        err instanceof Error ? err : undefined,
      )
    }
  }

  /**
   * Get published newsletters
   */
  static async getPublishedWeeks(options?: PaginationOptions): Promise<NewsletterRow[]> {
    try {
      let query = table('newsletters')
        .select('*')
        .eq('status', 'published')

      const sortOrder = options?.sortOrder === 'asc' ? true : false
      query = query.order('week_number', { ascending: sortOrder })

      if (options?.limit) {
        const offset = options?.offset || 0
        query = query.range(offset, offset + options.limit - 1)
      }

      const { data, error } = await query

      if (error) {
        throw new WeekServiceError(
          `Failed to fetch published newsletters: ${error.message}`,
          'FETCH_WEEKS_ERROR',
          error as Error,
        )
      }

      return data || []
    } catch (err) {
      if (err instanceof WeekServiceError) throw err
      throw new WeekServiceError(
        `Unexpected error fetching published newsletters: ${err instanceof Error ? err.message : String(err)}`,
        'FETCH_WEEKS_ERROR',
        err instanceof Error ? err : undefined,
      )
    }
  }

  /**
   * Get the latest published newsletter
   * Orders by release_date to correctly handle newsletters without week_number
   */
  static async getLatestPublishedWeek(): Promise<NewsletterRow | null> {
    try {
      const { data, error } = await table('newsletters')
        .select('*')
        .eq('status', 'published')
        .order('release_date', { ascending: false })
        .limit(1)
        .single()

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
        throw new WeekServiceError(
          `Failed to fetch latest newsletter: ${error.message}`,
          'FETCH_WEEK_ERROR',
          error as Error,
        )
      }

      return data || null
    } catch (err) {
      if (err instanceof WeekServiceError) throw err
      throw new WeekServiceError(
        `Unexpected error fetching latest newsletter: ${err instanceof Error ? err.message : String(err)}`,
        'FETCH_WEEK_ERROR',
        err instanceof Error ? err : undefined,
      )
    }
  }

  /**
   * Check if a newsletter with week number exists
   */
  static async weekExists(weekNumber: string): Promise<boolean> {
    try {
      const { count, error } = await table('newsletters')
        .select('*', { count: 'exact', head: true })
        .eq('week_number', weekNumber)

      if (error) {
        throw new WeekServiceError(
          `Failed to check newsletter existence: ${error.message}`,
          'CHECK_WEEK_ERROR',
          error as Error,
        )
      }

      return (count || 0) > 0
    } catch (err) {
      if (err instanceof WeekServiceError) throw err
      throw new WeekServiceError(
        `Unexpected error checking newsletter existence: ${err instanceof Error ? err.message : String(err)}`,
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
