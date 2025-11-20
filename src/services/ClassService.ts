/**
 * Class Service
 * Manages school classes and grade-level organization
 *
 * US3: Class-Based Article Visibility
 * Provides access to class information for filtering articles by class
 */

import { table } from '@/lib/supabase'
import type { ClassRow } from '@/types/database'

/**
 * Service error for better error handling
 */
export class ClassServiceError extends Error {
  constructor(
    message: string,
    public code: string = 'CLASS_ERROR',
    public originalError?: Error,
  ) {
    super(message)
    this.name = 'ClassServiceError'
  }
}

/**
 * Class Service
 * Provides methods for class management and queries
 */
export class ClassService {
  /**
   * Get a single class by ID
   * @param classId Class identifier (e.g., "A1", "B2")
   * @returns Class details
   */
  static async getClass(classId: string): Promise<ClassRow> {
    try {
      const { data, error } = await table('classes')
        .select('*')
        .eq('id', classId)
        .single()

      if (error) {
        throw new ClassServiceError(
          `Failed to fetch class ${classId}: ${error.message}`,
          'FETCH_CLASS_ERROR',
          error as Error,
        )
      }

      if (!data) {
        throw new ClassServiceError(
          `Class ${classId} not found`,
          'CLASS_NOT_FOUND',
        )
      }

      return data
    } catch (err) {
      if (err instanceof ClassServiceError) throw err
      throw new ClassServiceError(
        `Unexpected error fetching class: ${err instanceof Error ? err.message : String(err)}`,
        'FETCH_CLASS_ERROR',
        err instanceof Error ? err : undefined,
      )
    }
  }

  /**
   * Get all classes
   * @returns List of all classes, sorted by grade_year and ID
   */
  static async getAllClasses(): Promise<ClassRow[]> {
    try {
      const { data, error } = await table('classes')
        .select('*')
        .order('class_grade_year', { ascending: true })
        .order('id', { ascending: true })

      if (error) {
        throw new ClassServiceError(
          `Failed to fetch classes: ${error.message}`,
          'FETCH_CLASSES_ERROR',
          error as Error,
        )
      }

      return data || []
    } catch (err) {
      if (err instanceof ClassServiceError) throw err
      throw new ClassServiceError(
        `Unexpected error fetching classes: ${err instanceof Error ? err.message : String(err)}`,
        'FETCH_CLASSES_ERROR',
        err instanceof Error ? err : undefined,
      )
    }
  }

  /**
   * Get classes by grade year
   * @param gradeYear Grade level (1-6 for primary school)
   * @returns Classes for the specified grade year
   */
  static async getClassesByGradeYear(gradeYear: number): Promise<ClassRow[]> {
    try {
      // Validate grade year range
      if (gradeYear < 1 || gradeYear > 12) {
        throw new ClassServiceError(
          `Invalid grade year: ${gradeYear}. Must be between 1 and 12.`,
          'INVALID_GRADE_YEAR',
        )
      }

      const { data, error } = await table('classes')
        .select('*')
        .eq('class_grade_year', gradeYear)
        .order('id', { ascending: true })

      if (error) {
        throw new ClassServiceError(
          `Failed to fetch classes for grade year ${gradeYear}: ${error.message}`,
          'FETCH_CLASSES_ERROR',
          error as Error,
        )
      }

      return data || []
    } catch (err) {
      if (err instanceof ClassServiceError) throw err
      throw new ClassServiceError(
        `Unexpected error fetching classes by grade year: ${err instanceof Error ? err.message : String(err)}`,
        'FETCH_CLASSES_ERROR',
        err instanceof Error ? err : undefined,
      )
    }
  }

  /**
   * Get classes by grade year range
   * @param minGradeYear Minimum grade year (inclusive)
   * @param maxGradeYear Maximum grade year (inclusive)
   * @returns Classes within the grade year range
   */
  static async getClassesByGradeYearRange(
    minGradeYear: number,
    maxGradeYear: number,
  ): Promise<ClassRow[]> {
    try {
      // Validate range
      if (minGradeYear > maxGradeYear) {
        throw new ClassServiceError(
          `Invalid grade year range: ${minGradeYear}-${maxGradeYear}`,
          'INVALID_GRADE_RANGE',
        )
      }

      const { data, error } = await table('classes')
        .select('*')
        .gte('class_grade_year', minGradeYear)
        .lte('class_grade_year', maxGradeYear)
        .order('class_grade_year', { ascending: false })
        .order('id', { ascending: true })

      if (error) {
        throw new ClassServiceError(
          `Failed to fetch classes for grade years ${minGradeYear}-${maxGradeYear}: ${error.message}`,
          'FETCH_CLASSES_ERROR',
          error as Error,
        )
      }

      return data || []
    } catch (err) {
      if (err instanceof ClassServiceError) throw err
      throw new ClassServiceError(
        `Unexpected error fetching classes by grade year range: ${err instanceof Error ? err.message : String(err)}`,
        'FETCH_CLASSES_ERROR',
        err instanceof Error ? err : undefined,
      )
    }
  }

  /**
   * Search classes by name (case-insensitive)
   * @param searchTerm Search term for class name
   * @returns Matching classes
   */
  static async searchClasses(searchTerm: string): Promise<ClassRow[]> {
    try {
      const { data, error } = await table('classes')
        .select('*')
        .ilike('class_name', `%${searchTerm}%`)
        .order('class_grade_year', { ascending: true })

      if (error) {
        throw new ClassServiceError(
          `Failed to search classes: ${error.message}`,
          'SEARCH_CLASSES_ERROR',
          error as Error,
        )
      }

      return data || []
    } catch (err) {
      if (err instanceof ClassServiceError) throw err
      throw new ClassServiceError(
        `Unexpected error searching classes: ${err instanceof Error ? err.message : String(err)}`,
        'SEARCH_CLASSES_ERROR',
        err instanceof Error ? err : undefined,
      )
    }
  }

  /**
   * Get class count
   * @returns Total number of classes
   */
  static async getClassCount(): Promise<number> {
    try {
      const { count, error } = await table('classes')
        .select('*', { count: 'exact', head: true })

      if (error) {
        throw new ClassServiceError(
          `Failed to count classes: ${error.message}`,
          'COUNT_CLASSES_ERROR',
          error as Error,
        )
      }

      return count || 0
    } catch (err) {
      if (err instanceof ClassServiceError) throw err
      throw new ClassServiceError(
        `Unexpected error counting classes: ${err instanceof Error ? err.message : String(err)}`,
        'COUNT_CLASSES_ERROR',
        err instanceof Error ? err : undefined,
      )
    }
  }
}

/**
 * Export service as default
 */
export default ClassService
