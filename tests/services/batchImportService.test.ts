import { beforeEach, describe, expect, it, vi } from 'vitest'
import { batchImportService } from '@/services/batchImportService'

const mockBuilder = {
  select: vi.fn().mockReturnThis(),
  in: vi.fn().mockReturnThis(),
  then: vi.fn((resolve) => resolve({ data: [], error: null })),
}

const mockFunctionsInvoke = vi.fn()

const mockSupabase = {
  from: vi.fn(() => mockBuilder),
  functions: {
    invoke: mockFunctionsInvoke,
  },
}

vi.mock('@/lib/supabase', () => ({
  getSupabaseClient: () => mockSupabase,
}))

describe('batchImportService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockBuilder.select.mockReturnThis()
    mockBuilder.in.mockReturnThis()
    mockBuilder.then.mockImplementation((resolve) => resolve({ data: [], error: null }))
    mockFunctionsInvoke.mockResolvedValue({
      data: {
        importedCount: 2,
        importedUserEmails: ['teacher1@school.edu', 'parent1@school.edu'],
      },
      error: null,
    })
  })

  it('validates against user_roles instead of the removed users table', async () => {
    const validation = batchImportService.validateCSVFormat([
      { email: 'teacher1@school.edu', name: 'Teacher One', role: 'teacher' },
    ])

    await batchImportService.validateAgainstDatabase(validation)

    expect(mockSupabase.from).toHaveBeenCalledWith('user_roles')
  })

  it('executes imports through the batch-import-users edge function', async () => {
    const validation = batchImportService.validateCSVFormat([
      { email: 'teacher1@school.edu', name: 'Teacher One', role: 'teacher' },
      { email: 'parent1@school.edu', name: 'Parent One', role: 'parent' },
    ])

    const result = await batchImportService.executeBatchImport(validation)

    expect(mockFunctionsInvoke).toHaveBeenCalledWith('batch-import-users', {
      body: {
        rows: [
          {
            email: 'teacher1@school.edu',
            name: 'Teacher One',
            role: 'teacher',
            status: 'pending_approval',
          },
          {
            email: 'parent1@school.edu',
            name: 'Parent One',
            role: 'parent',
            status: 'pending_approval',
          },
        ],
      },
    })

    expect(result).toEqual({
      success: true,
      importedCount: 2,
      totalCount: 2,
      details: {
        createdAt: expect.any(String),
        importedUserEmails: ['teacher1@school.edu', 'parent1@school.edu'],
      },
    })
  })
})
