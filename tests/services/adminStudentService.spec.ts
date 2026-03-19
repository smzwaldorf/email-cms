import { beforeEach, describe, expect, it, vi } from 'vitest'
import { adminService } from '@/services/adminService'

const mockBuilder = {
  select: vi.fn().mockReturnThis(),
  insert: vi.fn().mockReturnThis(),
  update: vi.fn().mockReturnThis(),
  delete: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  or: vi.fn().mockReturnThis(),
  in: vi.fn().mockReturnThis(),
  order: vi.fn().mockReturnThis(),
  maybeSingle: vi.fn().mockReturnThis(),
  single: vi.fn().mockReturnThis(),
  then: vi.fn((resolve: any) => resolve({ data: [], error: null })),
}

const mockSupabase = {
  from: vi.fn(() => mockBuilder),
}

vi.mock('@/lib/supabase', () => ({
  getSupabaseClient: () => mockSupabase,
}))

describe('AdminService student lifecycle', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    Object.values(mockBuilder).forEach((mock: any) => {
      if (mock.mockReturnThis) mock.mockReturnThis()
    })
    mockBuilder.then.mockImplementation((resolve: any) => resolve({ data: [], error: null }))
  })

  it('fetchStudents defaults to active students', async () => {
    mockBuilder.then.mockImplementation((resolve: any) =>
      resolve({
        data: [
          {
            id: 'student-1',
            name: 'Student One',
            student_code: 'STUDENT-ONE',
            is_active: true,
            created_at: '2026-01-01T00:00:00Z',
            updated_at: '2026-01-01T00:00:00Z',
          },
        ],
        error: null,
      })
    )

    const result = await adminService.fetchStudents()
    expect(mockBuilder.eq).toHaveBeenCalledWith('is_active', true)
    expect(result[0].status).toBe('active')
  })

  it('fetchStudents includeInactive returns mixed lifecycle statuses', async () => {
    mockBuilder.then.mockImplementation((resolve: any) =>
      resolve({
        data: [
          {
            id: 'student-1',
            name: 'Active Student',
            student_code: 'ACTIVE-STUDENT',
            is_active: true,
            created_at: '2026-01-01T00:00:00Z',
            updated_at: '2026-01-01T00:00:00Z',
          },
          {
            id: 'student-2',
            name: 'Inactive Student',
            student_code: 'INACTIVE-STUDENT',
            is_active: false,
            created_at: '2026-01-01T00:00:00Z',
            updated_at: '2026-01-02T00:00:00Z',
          },
        ],
        error: null,
      })
    )

    const result = await adminService.fetchStudents({ includeInactive: true })
    expect(mockBuilder.eq).not.toHaveBeenCalledWith('is_active', true)
    expect(result.map((row) => row.status)).toEqual(['active', 'disabled'])
  })

  it('deactivateStudent sets inactive and returns disabled status', async () => {
    mockBuilder.then
      .mockImplementationOnce((resolve: any) =>
        resolve({ data: { id: 'student-1', is_active: true }, error: null })
      )
      .mockImplementationOnce((resolve: any) =>
        resolve({
          data: {
            id: 'student-1',
            name: 'Student One',
            student_code: 'STUDENT-ONE',
            is_active: false,
            created_at: '2026-01-01T00:00:00Z',
            updated_at: '2026-01-02T00:00:00Z',
          },
          error: null,
        })
      )
      .mockImplementationOnce((resolve: any) => resolve({ data: null, error: null }))

    const result = await adminService.deactivateStudent('student-1')
    expect(mockBuilder.update).toHaveBeenCalledWith({ is_active: false })
    expect(result.status).toBe('disabled')
  })

  it('activateStudent sets active and returns active status', async () => {
    mockBuilder.then
      .mockImplementationOnce((resolve: any) =>
        resolve({ data: { id: 'student-1', is_active: false }, error: null })
      )
      .mockImplementationOnce((resolve: any) =>
        resolve({
          data: {
            id: 'student-1',
            name: 'Student One',
            student_code: 'STUDENT-ONE',
            is_active: true,
            created_at: '2026-01-01T00:00:00Z',
            updated_at: '2026-01-03T00:00:00Z',
          },
          error: null,
        })
      )
      .mockImplementationOnce((resolve: any) => resolve({ data: null, error: null }))

    const result = await adminService.activateStudent('student-1')
    expect(mockBuilder.update).toHaveBeenCalledWith({ is_active: true })
    expect(result.status).toBe('active')
  })

  it('validates class enrollment requires student-family relationship', async () => {
    mockBuilder.then
      .mockImplementationOnce((resolve: any) => resolve({ data: { id: 'student-1', is_active: true }, error: null }))
      .mockImplementationOnce((resolve: any) => resolve({ data: { id: 'class-1', is_active: true }, error: null }))
      .mockImplementationOnce((resolve: any) => resolve({ data: { id: 'family-1', is_active: true }, error: null }))
      .mockImplementationOnce((resolve: any) => resolve({ data: null, error: null }))

    await expect(
      adminService.addStudentToClassEnrollment('class-1', 'student-1', 'family-1')
    ).rejects.toMatchObject({ code: 'ADD_STUDENT_CLASS_ENROLLMENT_ERROR' })
  })
})
