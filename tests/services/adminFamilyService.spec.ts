import { beforeEach, describe, expect, it, vi } from 'vitest'
import { adminService, AdminServiceError } from '@/services/adminService'

type QueryResolver<T> = (value: { data: T; error: null | { message?: string } }) => unknown

const mockBuilder: Record<string, ReturnType<typeof vi.fn>> = {
  select: vi.fn().mockReturnThis(),
  insert: vi.fn().mockReturnThis(),
  update: vi.fn().mockReturnThis(),
  delete: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  order: vi.fn().mockReturnThis(),
  ilike: vi.fn().mockReturnThis(),
  single: vi.fn().mockReturnThis(),
  maybeSingle: vi.fn().mockReturnThis(),
  then: vi.fn((resolve: QueryResolver<unknown>) => resolve({ data: [], error: null })),
}

const mockSupabase = {
  from: vi.fn(() => mockBuilder),
}

vi.mock('@/lib/supabase', () => ({
  getSupabaseClient: () => mockSupabase,
}))

describe('AdminService family management', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    Object.values(mockBuilder).forEach((mock) => {
      if (mock.mockReturnThis) mock.mockReturnThis()
    })
    mockBuilder.then.mockImplementation((resolve: QueryResolver<unknown>) =>
      resolve({ data: [], error: null })
    )
  })

  it('fetchFamilies defaults to active-only filter', async () => {
    mockBuilder.then.mockImplementation((resolve: QueryResolver<Array<Record<string, unknown>>>) =>
      resolve({
        data: [
          {
            id: 'family-1',
            family_code: 'SMITH',
            family_name: 'Smith Family',
            guardian_email: 'smith@example.com',
            related_topics: [],
            is_active: true,
            created_at: '2026-01-01T00:00:00Z',
            updated_at: '2026-01-01T00:00:00Z',
          },
        ],
        error: null,
      })
    )

    const result = await adminService.fetchFamilies()

    expect(mockBuilder.eq).toHaveBeenCalledWith('is_active', true)
    expect(result).toHaveLength(1)
    expect(result[0].guardianEmail).toBe('smith@example.com')
  })

  it('fetchFamilies includeInactive skips active-only filter', async () => {
    mockBuilder.then.mockImplementation((resolve: QueryResolver<Array<Record<string, unknown>>>) =>
      resolve({
        data: [
          {
            id: 'family-1',
            family_code: 'SMITH',
            family_name: 'Smith Family',
            guardian_email: 'smith@example.com',
            related_topics: [],
            is_active: false,
            created_at: '2026-01-01T00:00:00Z',
            updated_at: '2026-01-01T00:00:00Z',
          },
        ],
        error: null,
      })
    )

    const result = await adminService.fetchFamilies({ includeInactive: true })

    expect(mockBuilder.eq).not.toHaveBeenCalledWith('is_active', true)
    expect(result[0].isActive).toBe(false)
  })

  it('createFamily rejects missing guardian email', async () => {
    await expect(
      adminService.createFamily('Smith Family', 'desc', [], '')
    ).rejects.toMatchObject({ code: 'FAMILY_VALIDATION_ERROR' })
  })

  it('createFamily rejects duplicate guardian email', async () => {
    mockBuilder.then
      .mockImplementationOnce((resolve: QueryResolver<unknown>) => resolve({ data: [], error: null })) // code check
      .mockImplementationOnce((resolve: QueryResolver<Array<{ id: string }>>) =>
        resolve({ data: [{ id: 'existing-family' }], error: null }) // email check
      )

    await expect(
      adminService.createFamily('Smith Family', 'desc', [], 'smith@example.com')
    ).rejects.toMatchObject({ code: 'FAMILY_VALIDATION_ERROR' })
  })

  it('updateFamily updates metadata successfully', async () => {
    mockBuilder.then
      .mockImplementationOnce((resolve: QueryResolver<Record<string, unknown>>) =>
        resolve({
          data: {
            id: 'family-1',
            family_code: 'SMITH',
            family_name: 'Smith Family',
            guardian_email: 'smith@example.com',
            description: 'before',
            related_topics: [],
            is_active: true,
            created_at: '2026-01-01T00:00:00Z',
            updated_at: '2026-01-01T00:00:00Z',
          },
          error: null,
        })
      )
      .mockImplementationOnce((resolve: QueryResolver<unknown>) => resolve({ data: [], error: null })) // code check
      .mockImplementationOnce((resolve: QueryResolver<unknown>) => resolve({ data: [], error: null })) // email check
      .mockImplementationOnce((resolve: QueryResolver<Record<string, unknown>>) =>
        resolve({
          data: {
            id: 'family-1',
            family_code: 'SMITH-UPDATED',
            family_name: 'Smith Updated',
            guardian_email: 'updated@example.com',
            description: 'after',
            related_topics: ['topic-a'],
            is_active: true,
            created_at: '2026-01-01T00:00:00Z',
            updated_at: '2026-01-02T00:00:00Z',
          },
          error: null,
        })
      )
      .mockImplementationOnce((resolve: QueryResolver<null>) => resolve({ data: null, error: null })) // audit insert

    const result = await adminService.updateFamily('family-1', {
      name: 'Smith Updated',
      guardianEmail: 'updated@example.com',
      description: 'after',
      relatedTopics: ['topic-a'],
    })

    expect(mockBuilder.update).toHaveBeenCalledWith(expect.objectContaining({
      family_name: 'Smith Updated',
      family_code: 'SMITH-UPDATED',
      guardian_email: 'updated@example.com',
      description: 'after',
      related_topics: ['topic-a'],
    }))
    expect(result.name).toBe('Smith Updated')
    expect(result.guardianEmail).toBe('updated@example.com')
  })

  it('deactivateFamily performs soft lifecycle update', async () => {
    mockBuilder.then
      .mockImplementationOnce((resolve: QueryResolver<Record<string, unknown>>) =>
        resolve({
          data: {
            id: 'family-1',
            family_code: 'SMITH',
            family_name: 'Smith Family',
            guardian_email: 'smith@example.com',
            is_active: true,
            deactivated_at: null,
            created_at: '2026-01-01T00:00:00Z',
            updated_at: '2026-01-01T00:00:00Z',
          },
          error: null,
        })
      )
      .mockImplementationOnce((resolve: QueryResolver<Record<string, unknown>>) =>
        resolve({
          data: {
            id: 'family-1',
            family_code: 'SMITH',
            family_name: 'Smith Family',
            guardian_email: 'smith@example.com',
            is_active: false,
            deactivated_at: '2026-01-05T00:00:00Z',
            created_at: '2026-01-01T00:00:00Z',
            updated_at: '2026-01-05T00:00:00Z',
          },
          error: null,
        })
      )
      .mockImplementationOnce((resolve: QueryResolver<null>) => resolve({ data: null, error: null }))

    const result = await adminService.deactivateFamily('family-1')

    expect(mockBuilder.update).toHaveBeenCalledWith({ is_active: false })
    expect(result.isActive).toBe(false)
  })

  it('addStudentToFamily rejects unknown students', async () => {
    mockBuilder.then
      .mockImplementationOnce((resolve: QueryResolver<{ id: string; is_active: boolean }>) =>
        resolve({
          data: { id: 'family-1', is_active: true },
          error: null,
        })
      )
      .mockImplementationOnce((resolve: QueryResolver<null>) =>
        resolve({
          data: null,
          error: { message: 'not found' },
        })
      )

    await expect(adminService.addStudentToFamily('family-1', 'student-missing')).rejects.toMatchObject({
      code: 'FAMILY_ASSOCIATION_ERROR',
    } as Partial<AdminServiceError>)
  })

  it('adds and removes student associations successfully', async () => {
    mockBuilder.then
      .mockImplementationOnce((resolve: QueryResolver<{ id: string; is_active: boolean }>) =>
        resolve({ data: { id: 'family-1', is_active: true }, error: null })
      ) // load family
      .mockImplementationOnce((resolve: QueryResolver<{ id: string }>) =>
        resolve({ data: { id: 'student-1' }, error: null })
      ) // load student
      .mockImplementationOnce((resolve: QueryResolver<null>) =>
        resolve({ data: null, error: null })
      ) // existing link maybeSingle
      .mockImplementationOnce((resolve: QueryResolver<null>) =>
        resolve({ data: null, error: null })
      ) // add insert
      .mockImplementationOnce((resolve: QueryResolver<null>) =>
        resolve({ data: null, error: null })
      ) // add audit
      .mockImplementationOnce((resolve: QueryResolver<null>) =>
        resolve({ data: null, error: null })
      ) // add student audit
      .mockImplementationOnce((resolve: QueryResolver<{ id: string }>) =>
        resolve({ data: { id: 'link-1' }, error: null })
      ) // remove existing link
      .mockImplementationOnce((resolve: QueryResolver<null>) =>
        resolve({ data: null, error: null })
      ) // remove delete
      .mockImplementationOnce((resolve: QueryResolver<null>) =>
        resolve({ data: null, error: null })
      ) // remove audit
      .mockImplementationOnce((resolve: QueryResolver<null>) =>
        resolve({ data: null, error: null })
      ) // remove student audit

    await adminService.addStudentToFamily('family-1', 'student-1')
    expect(mockBuilder.insert).toHaveBeenCalledWith(expect.objectContaining({
      family_id: 'family-1',
      student_id: 'student-1',
      relationship: 'student',
    }))

    await adminService.removeStudentFromFamily('family-1', 'student-1')
    expect(mockBuilder.delete).toHaveBeenCalled()
  })

  it('adds student class enrollment with family linkage', async () => {
    mockBuilder.then
      .mockImplementationOnce((resolve: QueryResolver<{ id: string; is_active: boolean }>) =>
        resolve({ data: { id: 'student-1', is_active: true }, error: null })
      ) // student exists
      .mockImplementationOnce((resolve: QueryResolver<{ id: string; is_active: boolean }>) =>
        resolve({ data: { id: 'class-1', is_active: true }, error: null })
      ) // class exists
      .mockImplementationOnce((resolve: QueryResolver<{ id: string; is_active: boolean }>) =>
        resolve({ data: { id: 'family-1', is_active: true }, error: null })
      ) // family exists
      .mockImplementationOnce((resolve: QueryResolver<{ id: string }>) =>
        resolve({ data: { id: 'link-1' }, error: null })
      ) // family link exists
      .mockImplementationOnce((resolve: QueryResolver<null>) =>
        resolve({ data: null, error: null })
      ) // existing enrollment check
      .mockImplementationOnce((resolve: QueryResolver<null>) =>
        resolve({ data: null, error: null })
      ) // insert
      .mockImplementationOnce((resolve: QueryResolver<null>) =>
        resolve({ data: null, error: null })
      ) // student audit

    await adminService.addStudentToClassEnrollment('class-1', 'student-1', 'family-1')

    expect(mockBuilder.insert).toHaveBeenCalledWith(expect.objectContaining({
      class_id: 'class-1',
      student_id: 'student-1',
      family_id: 'family-1',
    }))
  })
})
