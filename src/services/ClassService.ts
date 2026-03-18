import { table, getSupabaseClient } from '@/lib/supabase'
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

export class ClassValidationError extends ClassServiceError {
  constructor(
    message: string,
    public fieldErrors: Record<string, string> = {},
  ) {
    super(message, 'CLASS_VALIDATION_ERROR')
    this.name = 'ClassValidationError'
  }
}

export interface ClassListOptions {
  includeInactive?: boolean
}

export interface CreateClassInput {
  code: string
  name: string
  gradeYear: number
  description?: string
}

export interface UpdateClassInput {
  name?: string
  gradeYear?: number
  description?: string
}

export class ClassService {
  private static normalizeClassCode(input: string): string {
    return input.trim().toUpperCase()
  }

  private static async assertClassIdentityIsUnique(
    code: string,
    name: string,
    excludeClassId?: string,
  ): Promise<void> {
    const normalizedCode = this.normalizeClassCode(code)
    const normalizedName = name.trim()

    const [codeCheck, nameCheck] = await Promise.all([
      table('classes').select('id').ilike('class_code', normalizedCode),
      table('classes').select('id').ilike('class_name', normalizedName),
    ])

    if (codeCheck.error) {
      throw new ClassServiceError(
        `Failed to validate class code uniqueness: ${codeCheck.error.message}`,
        'CLASS_VALIDATION_ERROR',
        codeCheck.error as Error,
      )
    }
    if (nameCheck.error) {
      throw new ClassServiceError(
        `Failed to validate class name uniqueness: ${nameCheck.error.message}`,
        'CLASS_VALIDATION_ERROR',
        nameCheck.error as Error,
      )
    }

    const duplicateCode = (codeCheck.data || []).find((row: any) => row.id !== excludeClassId)
    if (duplicateCode) {
      throw new ClassValidationError('Class code already exists', {
        code: '班級代碼已存在',
      })
    }

    const duplicateName = (nameCheck.data || []).find((row: any) => row.id !== excludeClassId)
    if (duplicateName) {
      throw new ClassValidationError('Class name already exists', {
        name: '班級名稱已存在',
      })
    }
  }

  private static validateRequiredFields(input: {
    code?: string
    name?: string
    gradeYear?: number
  }): void {
    const fieldErrors: Record<string, string> = {}

    if (!input.code || input.code.trim() === '') {
      fieldErrors.code = '班級代碼為必填項'
    }

    if (!input.name || input.name.trim() === '') {
      fieldErrors.name = '班級名稱為必填項'
    }

    if (typeof input.gradeYear !== 'number' || Number.isNaN(input.gradeYear)) {
      fieldErrors.gradeYear = '年級為必填項'
    } else if (input.gradeYear < 1 || input.gradeYear > 12) {
      fieldErrors.gradeYear = '年級必須介於 1 到 12'
    }

    if (Object.keys(fieldErrors).length > 0) {
      throw new ClassValidationError('Class validation failed', fieldErrors)
    }
  }

  static async createClass(input: CreateClassInput): Promise<ClassRow> {
    this.validateRequiredFields(input)
    await this.assertClassIdentityIsUnique(input.code, input.name)

    const payload = {
      id: this.normalizeClassCode(input.code),
      class_code: this.normalizeClassCode(input.code),
      class_name: input.name.trim(),
      class_grade_year: input.gradeYear,
      description: input.description?.trim() || null,
      is_active: true,
    }

    const { data, error } = await table('classes')
      .insert(payload)
      .select('*')
      .single()

    if (error) {
      throw new ClassServiceError(
        `Failed to create class: ${error.message}`,
        'CREATE_CLASS_ERROR',
        error as Error,
      )
    }

    return data as ClassRow
  }

  static async updateClass(classId: string, updates: UpdateClassInput): Promise<ClassRow> {
    const existing = await this.getClass(classId)

    const merged = {
      code: existing.class_code || existing.id,
      name: updates.name ?? existing.class_name,
      gradeYear: updates.gradeYear ?? existing.class_grade_year,
    }
    this.validateRequiredFields(merged)
    await this.assertClassIdentityIsUnique(merged.code, merged.name, classId)

    const payload = {
      class_name: merged.name.trim(),
      class_grade_year: merged.gradeYear,
      description:
        updates.description !== undefined
          ? updates.description?.trim() || null
          : existing.description || null,
    }

    const { data, error } = await table('classes')
      .update(payload)
      .eq('id', classId)
      .select('*')
      .single()

    if (error) {
      throw new ClassServiceError(
        `Failed to update class: ${error.message}`,
        'UPDATE_CLASS_ERROR',
        error as Error,
      )
    }

    return data as ClassRow
  }

  static async activateClass(classId: string): Promise<ClassRow> {
    const { data, error } = await table('classes')
      .update({ is_active: true })
      .eq('id', classId)
      .select('*')
      .single()

    if (error) {
      throw new ClassServiceError(
        `Failed to activate class: ${error.message}`,
        'ACTIVATE_CLASS_ERROR',
        error as Error,
      )
    }

    return data as ClassRow
  }

  static async deactivateClass(classId: string): Promise<ClassRow> {
    const { data, error } = await table('classes')
      .update({ is_active: false })
      .eq('id', classId)
      .select('*')
      .single()

    if (error) {
      throw new ClassServiceError(
        `Failed to deactivate class: ${error.message}`,
        'DEACTIVATE_CLASS_ERROR',
        error as Error,
      )
    }

    return data as ClassRow
  }

  static async logClassAuditEvent(
    classId: string,
    action: 'create' | 'update' | 'activate' | 'deactivate',
    priorState: Record<string, unknown> | null,
    newState: Record<string, unknown> | null,
    actorId?: string | null,
  ): Promise<void> {
    try {
      const supabase = getSupabaseClient()
      let resolvedActorId = actorId ?? null
      if (!resolvedActorId && (supabase as any).auth?.getUser) {
        const authResult = await (supabase as any).auth.getUser()
        resolvedActorId = authResult?.data?.user?.id ?? null
      }

      await table('class_audit_log').insert({
        class_id: classId,
        action,
        actor_id: resolvedActorId,
        prior_state: priorState,
        new_state: newState,
      })
    } catch (error) {
      // Class updates must succeed even if audit logging is unavailable.
      console.error('Failed to write class audit log', error)
    }
  }

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
  static async getAllClasses(options: ClassListOptions = {}): Promise<ClassRow[]> {
    try {
      let query = table('classes')
        .select('*')
        .order('class_grade_year', { ascending: true })
        .order('id', { ascending: true })
      if (!options.includeInactive) {
        query = query.eq('is_active', true)
      }
      const { data, error } = await query

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
  static async getClassesByGradeYear(
    gradeYear: number,
    options: ClassListOptions = {},
  ): Promise<ClassRow[]> {
    try {
      // Validate grade year range
      if (gradeYear < 1 || gradeYear > 12) {
        throw new ClassServiceError(
          `Invalid grade year: ${gradeYear}. Must be between 1 and 12.`,
          'INVALID_GRADE_YEAR',
        )
      }

      let query = table('classes')
        .select('*')
        .eq('class_grade_year', gradeYear)
        .order('id', { ascending: true })
      if (!options.includeInactive) {
        query = query.eq('is_active', true)
      }
      const { data, error } = await query

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
    options: ClassListOptions = {},
  ): Promise<ClassRow[]> {
    try {
      // Validate range
      if (minGradeYear > maxGradeYear) {
        throw new ClassServiceError(
          `Invalid grade year range: ${minGradeYear}-${maxGradeYear}`,
          'INVALID_GRADE_RANGE',
        )
      }

      let query = table('classes')
        .select('*')
        .gte('class_grade_year', minGradeYear)
        .lte('class_grade_year', maxGradeYear)
        .order('class_grade_year', { ascending: false })
        .order('id', { ascending: true })
      if (!options.includeInactive) {
        query = query.eq('is_active', true)
      }
      const { data, error } = await query

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
  static async searchClasses(
    searchTerm: string,
    options: ClassListOptions = {},
  ): Promise<ClassRow[]> {
    try {
      let query = table('classes')
        .select('*')
        .ilike('class_name', `%${searchTerm}%`)
        .order('class_grade_year', { ascending: true })
      if (!options.includeInactive) {
        query = query.eq('is_active', true)
      }
      const { data, error } = await query

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
  static async getClassCount(options: ClassListOptions = {}): Promise<number> {
    try {
      let query = table('classes').select('*', { count: 'exact', head: true })
      if (!options.includeInactive) {
        query = query.eq('is_active', true)
      }
      const { count, error } = await query

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
