import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import type { ReactNode } from 'react'
import { TeacherManagementPage } from '@/pages/TeacherManagementPage'

const {
  fetchTeachersMock,
  fetchTeacherAssignedClassesMock,
  createTeacherMock,
  updateTeacherMock,
  activateTeacherMock,
  deactivateTeacherMock,
} = vi.hoisted(() => ({
  fetchTeachersMock: vi.fn(),
  fetchTeacherAssignedClassesMock: vi.fn(),
  createTeacherMock: vi.fn(),
  updateTeacherMock: vi.fn(),
  activateTeacherMock: vi.fn(),
  deactivateTeacherMock: vi.fn(),
}))

vi.mock('@/services/adminService', () => {
  class MockAdminServiceError extends Error {
    code: string
    constructor(message: string, code = 'ADMIN_ERROR') {
      super(message)
      this.code = code
    }
  }

  return {
    AdminServiceError: MockAdminServiceError,
    adminService: {
      fetchTeachers: fetchTeachersMock,
      fetchTeacherAssignedClasses: fetchTeacherAssignedClassesMock,
      createTeacher: createTeacherMock,
      updateTeacher: updateTeacherMock,
      activateTeacher: activateTeacherMock,
      deactivateTeacher: deactivateTeacherMock,
    },
  }
})

vi.mock('@/components/admin/AdminLayout', () => ({
  AdminLayout: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}))

describe('TeacherManagementPage assigned classes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    fetchTeachersMock.mockResolvedValue([
      {
        id: 'teacher-1',
        email: 'teacher1@example.com',
        name: '王老師',
        role: 'teacher',
        status: 'active',
        createdAt: '2025-01-01',
        updatedAt: '2025-01-01',
        lastLoginAt: null,
      },
    ])
    fetchTeacherAssignedClassesMock.mockResolvedValue([
      { id: 'A1', name: '一年甲班', isActive: true },
      { id: 'B2', name: '二年乙班', isActive: false },
    ])
  })

  it('shows assigned classes in teacher edit detail', async () => {
    render(
      <MemoryRouter>
        <TeacherManagementPage />
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(screen.getByText('王老師')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByTestId('edit-teacher-btn-teacher-1'))

    await waitFor(() => {
      expect(fetchTeacherAssignedClassesMock).toHaveBeenCalledWith('teacher-1')
      expect(screen.getByText('已分派班級')).toBeInTheDocument()
      expect(screen.getByText('一年甲班')).toBeInTheDocument()
      expect(screen.getByText('二年乙班 (停用)')).toBeInTheDocument()
    })
  })
})
