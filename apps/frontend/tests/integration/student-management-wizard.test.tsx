import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { StudentManagementPage } from '@/pages/StudentManagementPage'

const {
  fetchStudentsMock,
  createStudentMock,
  updateStudentMock,
  deleteStudentMock,
  fetchFamiliesMock,
  fetchClassesMock,
  createFamilyMock,
  addStudentToFamilyMock,
  addStudentToClassEnrollmentMock,
} = vi.hoisted(() => ({
  fetchStudentsMock: vi.fn(),
  createStudentMock: vi.fn(),
  updateStudentMock: vi.fn(),
  deleteStudentMock: vi.fn(),
  fetchFamiliesMock: vi.fn(),
  fetchClassesMock: vi.fn(),
  createFamilyMock: vi.fn(),
  addStudentToFamilyMock: vi.fn(),
  addStudentToClassEnrollmentMock: vi.fn(),
}))

vi.mock('@/services/adminService', () => {
  class MockAdminServiceError extends Error {}
  return {
    AdminServiceError: MockAdminServiceError,
    adminService: {
      fetchStudents: fetchStudentsMock,
      createStudent: createStudentMock,
      updateStudent: updateStudentMock,
      deleteStudent: deleteStudentMock,
      fetchFamilies: fetchFamiliesMock,
      fetchClasses: fetchClassesMock,
      createFamily: createFamilyMock,
      addStudentToFamily: addStudentToFamilyMock,
      addStudentToClassEnrollment: addStudentToClassEnrollmentMock,
    },
  }
})

vi.mock('@/components/admin/AdminLayout', () => ({
  AdminLayout: ({ children, headerAction }: { children: React.ReactNode; headerAction?: React.ReactNode }) => (
    <div>
      {headerAction}
      {children}
    </div>
  ),
}))

vi.mock('@/components/admin/ConfirmDialog', () => ({
  default: () => null,
}))

vi.mock('@/components/admin/NotificationToast', () => ({
  default: ({ message }: { message: string }) => <div>{message}</div>,
}))

describe('StudentManagementPage wizard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    fetchStudentsMock.mockResolvedValue([])
    fetchFamiliesMock.mockResolvedValue([{ id: 'family-1', name: 'Family One', isActive: true }])
    fetchClassesMock.mockResolvedValue([{ id: 'class-1', name: 'Class A', isActive: true }])
    createStudentMock.mockResolvedValue({
      id: 'student-1',
      name: 'Student One',
      email: 'Student One',
      role: 'student',
      status: 'active',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
      lastLoginAt: null,
    })
    addStudentToFamilyMock.mockResolvedValue(undefined)
    addStudentToClassEnrollmentMock.mockResolvedValue(undefined)
    createFamilyMock.mockResolvedValue({
      id: 'family-new',
      name: 'New Family',
      guardianEmail: 'guardian@new.family',
      description: '',
      relatedTopics: [],
      isActive: true,
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    })
  })

  it('blocks moving forward when required student name is empty', async () => {
    const user = userEvent.setup()
    render(<StudentManagementPage />)

    await user.click(screen.getByText('新增學生'))
    await user.click(screen.getByText('下一步'))

    expect(await screen.findByText('學生姓名為必填項')).toBeInTheDocument()
  })

  it('supports skip path and creates student without associations', async () => {
    const user = userEvent.setup()
    render(<StudentManagementPage />)

    await user.click(screen.getByText('新增學生'))
    await user.type(screen.getByPlaceholderText('學生姓名'), 'Student One')
    await user.click(screen.getByText('下一步')) // to family
    await user.click(screen.getByText('下一步')) // to class
    await user.click(screen.getByText('下一步')) // to review
    await user.click(screen.getByText('確認建立'))

    await waitFor(() => {
      expect(createStudentMock).toHaveBeenCalledWith('Student One')
    })
    expect(addStudentToFamilyMock).not.toHaveBeenCalled()
    expect(addStudentToClassEnrollmentMock).not.toHaveBeenCalled()
    expect(await screen.findByText(/學生已建立/)).toBeInTheDocument()
  })

  it('defers class assignment when family is not yet created', async () => {
    const user = userEvent.setup()
    render(<StudentManagementPage />)

    await user.click(screen.getByText('新增學生'))
    await user.type(screen.getByPlaceholderText('學生姓名'), 'Student Deferred')
    await user.click(screen.getByText('下一步')) // family
    await user.click(screen.getByText('下一步')) // class

    const classSelect = screen.getByRole('combobox')
    expect(classSelect).toBeDisabled()
    expect(screen.getByText(/尚未建立家庭時/)).toBeInTheDocument()

    await user.click(screen.getByText('下一步')) // review
    await user.click(screen.getByText('確認建立'))

    await waitFor(() => {
      expect(createStudentMock).toHaveBeenCalledWith('Student Deferred')
    })
    expect(addStudentToClassEnrollmentMock).not.toHaveBeenCalled()
    expect(await screen.findByText(/已略過班級分配/)).toBeInTheDocument()
  })

  it('shows partial failure and allows retry guidance path', async () => {
    const user = userEvent.setup()
    addStudentToFamilyMock.mockRejectedValueOnce(new Error('family-link-failed'))

    render(<StudentManagementPage />)

    await user.click(screen.getByText('新增學生'))
    await user.type(screen.getByPlaceholderText('學生姓名'), 'Student Two')
    await user.click(screen.getByText('下一步'))
    await user.click(screen.getByText('使用既有家庭'))
    await user.selectOptions(screen.getByRole('combobox'), 'family-1')
    await user.click(screen.getByText('下一步'))
    await user.selectOptions(screen.getByRole('combobox'), 'class-1')
    await user.click(screen.getByText('下一步'))
    await user.click(screen.getByText('確認建立'))

    expect(await screen.findByText(/家庭連結失敗/)).toBeInTheDocument()
    expect(screen.getByText('重試家庭連結')).toBeInTheDocument()
  })

  it('creates a new family within wizard and links student to class', async () => {
    const user = userEvent.setup()
    render(<StudentManagementPage />)

    await user.click(screen.getByText('新增學生'))
    await user.type(screen.getByPlaceholderText('學生姓名'), 'Student Three')
    await user.click(screen.getByText('下一步')) // family

    await user.click(screen.getByText('建立新家庭'))
    await user.type(screen.getByPlaceholderText('新家庭名稱'), 'New Family')
    await user.type(screen.getByPlaceholderText('監護人電子郵件'), 'guardian@new.family')
    await user.click(screen.getByText('下一步')) // class

    await user.selectOptions(screen.getByRole('combobox'), 'class-1')
    await user.click(screen.getByText('下一步')) // review
    await user.click(screen.getByText('確認建立'))

    await waitFor(() => {
      expect(createFamilyMock).toHaveBeenCalledWith('New Family', '', [], 'guardian@new.family')
      expect(addStudentToFamilyMock).toHaveBeenCalledWith('family-new', 'student-1')
      expect(addStudentToClassEnrollmentMock).toHaveBeenCalledWith('class-1', 'student-1', 'family-new')
    })
  })

  it('uses existing family and assigns class successfully', async () => {
    const user = userEvent.setup()
    render(<StudentManagementPage />)

    await user.click(screen.getByText('新增學生'))
    await user.type(screen.getByPlaceholderText('學生姓名'), 'Student Four')
    await user.click(screen.getByText('下一步')) // family
    await user.click(screen.getByText('使用既有家庭'))
    await user.selectOptions(screen.getByRole('combobox'), 'family-1')
    await user.click(screen.getByText('下一步')) // class
    await user.selectOptions(screen.getByRole('combobox'), 'class-1')
    await user.click(screen.getByText('下一步')) // review
    await user.click(screen.getByText('確認建立'))

    await waitFor(() => {
      expect(addStudentToFamilyMock).toHaveBeenCalledWith('family-1', 'student-1')
      expect(addStudentToClassEnrollmentMock).toHaveBeenCalledWith('class-1', 'student-1', 'family-1')
    })
  })
})
