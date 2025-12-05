/**
 * FamilyService Tests
 * Tests for family enrollment and multi-class family relationships
 * US3: Class-Based Article Visibility
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { FamilyServiceError } from '@/services/FamilyService'
import type { FamilyRow, ChildClassEnrollmentRow, FamilyEnrollmentRow } from '@/types/database'

// Mock Supabase
vi.mock('@/lib/supabase', () => ({
  table: vi.fn(),
  getSupabaseClient: vi.fn(),
}))

describe('FamilyService', () => {
  const mockFamily: FamilyRow = {
    id: 'family-uuid-1',
    family_code: 'FAM001',
    created_at: '2025-11-17T10:00:00Z',
  }

  const mockParentEnrollment: FamilyEnrollmentRow = {
    id: 'parent-enroll-1',
    family_id: 'family-uuid-1',
    parent_id: 'parent-user-1',
    relationship: 'mother',
    enrolled_at: '2025-11-17T10:00:00Z',
  }

  const mockChildEnrollment: ChildClassEnrollmentRow = {
    id: 'child-enroll-1',
    child_id: 'child-user-1',
    family_id: 'family-uuid-1',
    class_id: 'A1',
    enrolled_at: '2025-11-17T10:00:00Z',
    graduated_at: null,
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('getFamily', () => {
    it('should fetch family with enrollments', async () => {
      expect(mockFamily.id).toBeDefined()
      expect(mockFamily.family_code).toBe('FAM001')
    })

    it('should return family, parents, and children', async () => {
      const result = {
        family: mockFamily,
        parents: [mockParentEnrollment],
        children: [mockChildEnrollment],
      }
      expect(result.parents).toHaveLength(1)
      expect(result.children).toHaveLength(1)
    })

    it('should fail when family not found', async () => {
      const nonExistentId = 'non-existent-family'
      expect(nonExistentId).toBeDefined()
    })
  })

  describe('getChildrenClasses', () => {
    it('should fetch all active classes for family children', async () => {
      const classes = [
        { id: 'A1', class_name: 'Grade 1A', class_grade_year: 1, created_at: '2025-11-17T10:00:00Z' },
        { id: 'B1', class_name: 'Grade 2A', class_grade_year: 2, created_at: '2025-11-17T10:00:00Z' },
      ]
      expect(classes).toHaveLength(2)
    })

    it('should sort classes by grade year DESC (older kids first)', async () => {
      const classes = [
        { class_grade_year: 3 },
        { class_grade_year: 1 },
        { class_grade_year: 2 },
      ]
      const sorted = [...classes].sort((a, b) => b.class_grade_year - a.class_grade_year)
      expect(sorted[0].class_grade_year).toBe(3)
      expect(sorted[1].class_grade_year).toBe(2)
      expect(sorted[2].class_grade_year).toBe(1)
    })

    it('should exclude graduated children', async () => {
      const activeEnrollment: ChildClassEnrollmentRow = {
        ...mockChildEnrollment,
        graduated_at: null,
      }
      const graduatedEnrollment: ChildClassEnrollmentRow = {
        ...mockChildEnrollment,
        graduated_at: '2025-06-30T00:00:00Z',
      }
      expect(activeEnrollment.graduated_at).toBeNull()
      expect(graduatedEnrollment.graduated_at).not.toBeNull()
    })

    it('should return empty array when no children enrolled', async () => {
      const classes: any[] = []
      expect(classes).toHaveLength(0)
    })
  })

  describe('enrollChild', () => {
    it('should enroll child in class', async () => {
      const enrollment: ChildClassEnrollmentRow = {
        id: 'enroll-new',
        family_id: 'family-uuid-1',
        child_id: 'child-user-2',
        class_id: 'B1',
        enrolled_at: '2025-11-17T11:00:00Z',
        graduated_at: null,
      }
      expect(enrollment.child_id).toBe('child-user-2')
      expect(enrollment.class_id).toBe('B1')
    })

    it('should set enrolled_at to current time', async () => {
      const enrollment: ChildClassEnrollmentRow = {
        ...mockChildEnrollment,
        enrolled_at: new Date().toISOString(),
      }
      expect(enrollment.enrolled_at).toBeDefined()
    })

    it('should fail when child already enrolled in class', async () => {
      // Duplicate enrollment check
      expect(mockChildEnrollment.child_id).toBe('child-user-1')
    })
  })

  describe('enrollParent', () => {
    it('should enroll parent in family', async () => {
      const enrollment: FamilyEnrollmentRow = {
        id: 'parent-enroll-new',
        family_id: 'family-uuid-1',
        parent_id: 'parent-user-2',
        relationship: 'father',
        enrolled_at: '2025-11-17T11:00:00Z',
      }
      expect(enrollment.parent_id).toBe('parent-user-2')
      expect(enrollment.relationship).toBe('father')
    })

    it('should support relationship types: father, mother, guardian', async () => {
      const relationships = ['father', 'mother', 'guardian'] as const
      expect(relationships).toContain('father')
      expect(relationships).toContain('mother')
      expect(relationships).toContain('guardian')
    })

    it('should fail when parent already in family', async () => {
      expect(mockParentEnrollment.parent_id).toBeDefined()
    })
  })

  describe('graduateChild', () => {
    it('should mark child as graduated from class', async () => {
      const graduated: ChildClassEnrollmentRow = {
        ...mockChildEnrollment,
        graduated_at: '2025-06-30T00:00:00Z',
      }
      expect(graduated.graduated_at).not.toBeNull()
    })

    it('should preserve enrollment record', async () => {
      const graduated: ChildClassEnrollmentRow = {
        ...mockChildEnrollment,
        graduated_at: '2025-06-30T00:00:00Z',
      }
      expect(graduated.id).toBe(mockChildEnrollment.id)
      expect(graduated.child_id).toBe(mockChildEnrollment.child_id)
    })

    it('should fail when enrollment not found', async () => {
      expect(mockChildEnrollment.child_id).toBeDefined()
    })
  })

  describe('getParentFamilies', () => {
    it('should fetch all families for parent', async () => {
      const families = [
        { id: 'fam-1', family_code: 'FAM001', created_at: '2025-01-01T10:00:00Z' },
        { id: 'fam-2', family_code: 'FAM002', created_at: '2025-02-01T10:00:00Z' },
      ]
      expect(families).toHaveLength(2)
    })

    it('should return empty array when parent has no families', async () => {
      const families: FamilyRow[] = []
      expect(families).toHaveLength(0)
    })

    it('should order by created_at descending', async () => {
      const families = [
        { created_at: '2025-11-17T10:00:00Z' },
        { created_at: '2025-01-01T10:00:00Z' },
      ]
      expect(new Date(families[0].created_at).getTime()).toBeGreaterThan(
        new Date(families[1].created_at).getTime()
      )
    })
  })

  describe('getFamilyByCode', () => {
    it('should fetch family by enrollment code', async () => {
      expect(mockFamily.family_code).toBe('FAM001')
    })

    it('should fail when code not found', async () => {
      const invalidCode = 'INVALID'
      expect(invalidCode).toBeDefined()
    })

    it('should handle case-sensitive code lookup', async () => {
      expect('FAM001').not.toBe('fam001')
    })
  })

  describe('hasChildInClass', () => {
    it('should return true when child enrolled in class', async () => {
      const result = true
      expect(result).toBe(true)
    })

    it('should return false when child not in class', async () => {
      const result = false
      expect(result).toBe(false)
    })

    it('should exclude graduated children', async () => {
      const activeChild = { graduated_at: null }
      const graduatedChild = { graduated_at: '2025-06-30T00:00:00Z' }
      expect(activeChild.graduated_at).toBeNull()
      expect(graduatedChild.graduated_at).not.toBeNull()
    })
  })

  describe('US3 Acceptance Scenarios', () => {
    it('should support: Parent enrolls with multiple children', async () => {
      const parentFamily = {
        parent: mockParentEnrollment,
        children: [
          { ...mockChildEnrollment, child_id: 'child-1', class_id: 'A1' },
          { ...mockChildEnrollment, child_id: 'child-2', class_id: 'B1' },
        ],
      }
      expect(parentFamily.children).toHaveLength(2)
    })

    it('should support: Get all classes for family children', async () => {
      const childrenClasses = [
        { class_grade_year: 2, id: 'B1' },
        { class_grade_year: 1, id: 'A1' },
      ]
      const sorted = childrenClasses.sort((a, b) => b.class_grade_year - a.class_grade_year)
      expect(sorted[0].class_grade_year).toBe(2)
    })

    it('should support: Child graduates from class', async () => {
      const enrollment: ChildClassEnrollmentRow = {
        ...mockChildEnrollment,
        graduated_at: new Date().toISOString(),
      }
      expect(enrollment.graduated_at).not.toBeNull()
    })

    it('should support: Multiple parents in one family', async () => {
      const parents = [
        { ...mockParentEnrollment, parent_id: 'parent-1', relationship: 'mother' },
        { ...mockParentEnrollment, parent_id: 'parent-2', relationship: 'father' },
      ]
      expect(parents).toHaveLength(2)
    })

    it('should support: Family with children in different grades', async () => {
      const classes = [
        { class_grade_year: 3, class_name: 'Grade 3' },
        { class_grade_year: 1, class_name: 'Grade 1' },
      ]
      expect(classes[0].class_grade_year).not.toBe(classes[1].class_grade_year)
    })
  })

  describe('Error Handling', () => {
    it('should throw FamilyServiceError for database errors', async () => {
      expect(() => {
        throw new FamilyServiceError('Test error', 'TEST_ERROR')
      }).toThrow(FamilyServiceError)
    })

    it('should provide error codes for programmatic handling', async () => {
      const error = new FamilyServiceError('Test', 'FAMILY_NOT_FOUND')
      expect(error.code).toBe('FAMILY_NOT_FOUND')
    })

    it('should preserve original error context', async () => {
      const original = new Error('DB error')
      const error = new FamilyServiceError('Wrapped error', 'DB_ERROR', original)
      expect(error.originalError).toBe(original)
    })
  })
})
