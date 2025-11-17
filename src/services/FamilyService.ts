/**
 * Family Service
 * Manages family enrollment and multi-class family relationships
 *
 * US3: Class-Based Article Visibility
 * Handles parent-child relationships and class enrollments for family-level filtering
 */

import { table } from '@/lib/supabase'
import type {
  FamilyRow,
  FamilyEnrollmentRow,
  ChildClassEnrollmentRow,
  ClassRow,
} from '@/types/database'

/**
 * Family with enrollment details
 */
export interface FamilyWithEnrollments {
  family: FamilyRow
  parents: FamilyEnrollmentRow[]
  children: ChildClassEnrollmentRow[]
}

/**
 * Service error for better error handling
 */
export class FamilyServiceError extends Error {
  constructor(
    message: string,
    public code: string = 'FAMILY_ERROR',
    public originalError?: Error,
  ) {
    super(message)
    this.name = 'FamilyServiceError'
  }
}

/**
 * Family Service
 * Provides methods for family and enrollment management
 */
export class FamilyService {
  /**
   * Get family by ID
   * @param familyId Family UUID
   * @returns Family with enrollments
   */
  static async getFamily(familyId: string): Promise<FamilyWithEnrollments> {
    try {
      const { data: family, error: familyError } = await table('families')
        .select('*')
        .eq('id', familyId)
        .single()

      if (familyError || !family) {
        throw new FamilyServiceError(
          `Family ${familyId} not found`,
          'FAMILY_NOT_FOUND',
          familyError instanceof Error ? familyError : undefined,
        )
      }

      // Fetch parent enrollments
      const { data: parents, error: parentsError } = await table('family_enrollment')
        .select('*')
        .eq('family_id', familyId)
        .order('enrolled_at', { ascending: true })

      if (parentsError) {
        throw new FamilyServiceError(
          `Failed to fetch parent enrollments: ${parentsError.message}`,
          'FETCH_ENROLLMENTS_ERROR',
          parentsError as Error,
        )
      }

      // Fetch child enrollments
      const { data: children, error: childrenError } = await table('child_class_enrollment')
        .select('*')
        .eq('family_id', familyId)
        .is('graduated_at', null) // Only active enrollments
        .order('enrolled_at', { ascending: true })

      if (childrenError) {
        throw new FamilyServiceError(
          `Failed to fetch child enrollments: ${childrenError.message}`,
          'FETCH_ENROLLMENTS_ERROR',
          childrenError as Error,
        )
      }

      return {
        family,
        parents: parents || [],
        children: children || [],
      }
    } catch (err) {
      if (err instanceof FamilyServiceError) throw err
      throw new FamilyServiceError(
        `Unexpected error fetching family: ${err instanceof Error ? err.message : String(err)}`,
        'FETCH_FAMILY_ERROR',
        err instanceof Error ? err : undefined,
      )
    }
  }

  /**
   * Get children's classes for a family
   * Sorted by grade year (DESC) - older kids first
   *
   * @param familyId Family UUID
   * @returns Array of classes, sorted by grade_year DESC
   */
  static async getChildrenClasses(familyId: string): Promise<ClassRow[]> {
    try {
      // Get active child class enrollments
      const { data: enrollments, error: enrollError } = await table('child_class_enrollment')
        .select('class_id')
        .eq('family_id', familyId)
        .is('graduated_at', null)

      if (enrollError) {
        throw new FamilyServiceError(
          `Failed to fetch child enrollments: ${enrollError.message}`,
          'FETCH_ENROLLMENTS_ERROR',
          enrollError as Error,
        )
      }

      if (!enrollments || enrollments.length === 0) {
        return []
      }

      const classIds = enrollments.map((e) => e.class_id)

      // Get class details sorted by grade year DESC
      const { data: classes, error: classError } = await table('classes')
        .select('*')
        .in('id', classIds)
        .order('class_grade_year', { ascending: false })
        .order('id', { ascending: true })

      if (classError) {
        throw new FamilyServiceError(
          `Failed to fetch classes: ${classError.message}`,
          'FETCH_CLASSES_ERROR',
          classError as Error,
        )
      }

      return classes || []
    } catch (err) {
      if (err instanceof FamilyServiceError) throw err
      throw new FamilyServiceError(
        `Unexpected error getting children's classes: ${err instanceof Error ? err.message : String(err)}`,
        'FETCH_CHILDREN_CLASSES_ERROR',
        err instanceof Error ? err : undefined,
      )
    }
  }

  /**
   * Enroll a child in a class
   * @param familyId Family UUID
   * @param childId Child user ID
   * @param classId Class ID
   * @returns Created enrollment
   */
  static async enrollChild(
    familyId: string,
    childId: string,
    classId: string,
  ): Promise<ChildClassEnrollmentRow> {
    try {
      const { data, error } = await table('child_class_enrollment')
        .insert([
          {
            family_id: familyId,
            child_id: childId,
            class_id: classId,
            enrolled_at: new Date().toISOString(),
            graduated_at: null,
          },
        ])
        .select()
        .single()

      if (error) {
        throw new FamilyServiceError(
          `Failed to enroll child: ${error.message}`,
          'ENROLL_CHILD_ERROR',
          error as Error,
        )
      }

      if (!data) {
        throw new FamilyServiceError(
          'Child enrollment creation returned no data',
          'ENROLL_CHILD_ERROR',
        )
      }

      return data
    } catch (err) {
      if (err instanceof FamilyServiceError) throw err
      throw new FamilyServiceError(
        `Unexpected error enrolling child: ${err instanceof Error ? err.message : String(err)}`,
        'ENROLL_CHILD_ERROR',
        err instanceof Error ? err : undefined,
      )
    }
  }

  /**
   * Graduate a child from a class
   * @param childId Child user ID
   * @param classId Class ID
   * @returns Updated enrollment
   */
  static async graduateChild(
    childId: string,
    classId: string,
  ): Promise<ChildClassEnrollmentRow> {
    try {
      const { data, error } = await table('child_class_enrollment')
        .update({
          graduated_at: new Date().toISOString(),
        })
        .eq('child_id', childId)
        .eq('class_id', classId)
        .is('graduated_at', null)
        .select()
        .single()

      if (error) {
        throw new FamilyServiceError(
          `Failed to graduate child: ${error.message}`,
          'GRADUATE_CHILD_ERROR',
          error as Error,
        )
      }

      if (!data) {
        throw new FamilyServiceError(
          `Child ${childId} is not enrolled in class ${classId}`,
          'ENROLLMENT_NOT_FOUND',
        )
      }

      return data
    } catch (err) {
      if (err instanceof FamilyServiceError) throw err
      throw new FamilyServiceError(
        `Unexpected error graduating child: ${err instanceof Error ? err.message : String(err)}`,
        'GRADUATE_CHILD_ERROR',
        err instanceof Error ? err : undefined,
      )
    }
  }

  /**
   * Enroll a parent in a family
   * @param familyId Family UUID
   * @param parentId Parent user ID
   * @param relationship Relationship type (father, mother, guardian)
   * @returns Created enrollment
   */
  static async enrollParent(
    familyId: string,
    parentId: string,
    relationship: 'father' | 'mother' | 'guardian',
  ): Promise<FamilyEnrollmentRow> {
    try {
      const { data, error } = await table('family_enrollment')
        .insert([
          {
            family_id: familyId,
            parent_id: parentId,
            relationship,
            enrolled_at: new Date().toISOString(),
          },
        ])
        .select()
        .single()

      if (error) {
        throw new FamilyServiceError(
          `Failed to enroll parent: ${error.message}`,
          'ENROLL_PARENT_ERROR',
          error as Error,
        )
      }

      if (!data) {
        throw new FamilyServiceError(
          'Parent enrollment creation returned no data',
          'ENROLL_PARENT_ERROR',
        )
      }

      return data
    } catch (err) {
      if (err instanceof FamilyServiceError) throw err
      throw new FamilyServiceError(
        `Unexpected error enrolling parent: ${err instanceof Error ? err.message : String(err)}`,
        'ENROLL_PARENT_ERROR',
        err instanceof Error ? err : undefined,
      )
    }
  }

  /**
   * Get all families for a parent
   * @param parentId Parent user ID
   * @returns List of families
   */
  static async getParentFamilies(parentId: string): Promise<FamilyRow[]> {
    try {
      const { data: enrollments, error: enrollError } = await table('family_enrollment')
        .select('family_id')
        .eq('parent_id', parentId)

      if (enrollError) {
        throw new FamilyServiceError(
          `Failed to fetch family enrollments: ${enrollError.message}`,
          'FETCH_ENROLLMENTS_ERROR',
          enrollError as Error,
        )
      }

      if (!enrollments || enrollments.length === 0) {
        return []
      }

      const familyIds = enrollments.map((e) => e.family_id)

      const { data: families, error: familyError } = await table('families')
        .select('*')
        .in('id', familyIds)
        .order('created_at', { ascending: false })

      if (familyError) {
        throw new FamilyServiceError(
          `Failed to fetch families: ${familyError.message}`,
          'FETCH_FAMILIES_ERROR',
          familyError as Error,
        )
      }

      return families || []
    } catch (err) {
      if (err instanceof FamilyServiceError) throw err
      throw new FamilyServiceError(
        `Unexpected error fetching parent families: ${err instanceof Error ? err.message : String(err)}`,
        'FETCH_PARENT_FAMILIES_ERROR',
        err instanceof Error ? err : undefined,
      )
    }
  }

  /**
   * Get family by enrollment code
   * @param familyCode Enrollment code (used for parents to join family)
   * @returns Family details
   */
  static async getFamilyByCode(familyCode: string): Promise<FamilyRow> {
    try {
      const { data, error } = await table('families')
        .select('*')
        .eq('family_code', familyCode)
        .single()

      if (error || !data) {
        throw new FamilyServiceError(
          `Family with code ${familyCode} not found`,
          'FAMILY_NOT_FOUND',
          error instanceof Error ? error : undefined,
        )
      }

      return data
    } catch (err) {
      if (err instanceof FamilyServiceError) throw err
      throw new FamilyServiceError(
        `Unexpected error fetching family by code: ${err instanceof Error ? err.message : String(err)}`,
        'FETCH_FAMILY_ERROR',
        err instanceof Error ? err : undefined,
      )
    }
  }

  /**
   * Verify if a parent has a child in a class
   * @param familyId Family UUID
   * @param classId Class ID
   * @returns True if family has child in class, false otherwise
   */
  static async hasChildInClass(familyId: string, classId: string): Promise<boolean> {
    try {
      const { count, error } = await table('child_class_enrollment')
        .select('*', { count: 'exact', head: true })
        .eq('family_id', familyId)
        .eq('class_id', classId)
        .is('graduated_at', null)

      if (error) {
        throw new FamilyServiceError(
          `Failed to check child enrollment: ${error.message}`,
          'CHECK_ENROLLMENT_ERROR',
          error as Error,
        )
      }

      return (count || 0) > 0
    } catch (err) {
      if (err instanceof FamilyServiceError) throw err
      throw new FamilyServiceError(
        `Unexpected error checking child enrollment: ${err instanceof Error ? err.message : String(err)}`,
        'CHECK_ENROLLMENT_ERROR',
        err instanceof Error ? err : undefined,
      )
    }
  }
}

/**
 * Export service as default
 */
export default FamilyService
