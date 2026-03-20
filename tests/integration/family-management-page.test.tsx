import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { FamilyManagementPage } from '@/pages/FamilyManagementPage'
import { AdminServiceError } from '@/services/adminService'

type FamilyFormPayload = {
  id: string
  name: string
  guardianEmail: string
  description: string
  relatedTopics: string[]
  createdAt: string
  updatedAt: string
}

const {
  fetchFamiliesMock,
  createFamilyMock,
  updateFamilyMock,
  deactivateFamilyMock,
  activateFamilyMock,
  getFamilyMembersMock,
  getAvailableParentsMock,
  getAvailableStudentsMock,
  addParentToFamilyMock,
  removeParentFromFamilyMock,
  updateParentRelationshipMock,
  addStudentToFamilyMock,
  removeStudentFromFamilyMock,
} = vi.hoisted(() => ({
  fetchFamiliesMock: vi.fn(),
  createFamilyMock: vi.fn(),
  updateFamilyMock: vi.fn(),
  deactivateFamilyMock: vi.fn(),
  activateFamilyMock: vi.fn(),
  getFamilyMembersMock: vi.fn(),
  getAvailableParentsMock: vi.fn(),
  getAvailableStudentsMock: vi.fn(),
  addParentToFamilyMock: vi.fn(),
  removeParentFromFamilyMock: vi.fn(),
  updateParentRelationshipMock: vi.fn(),
  addStudentToFamilyMock: vi.fn(),
  removeStudentFromFamilyMock: vi.fn(),
}))

vi.mock('@/services/adminService', () => {
  class MockAdminServiceError extends Error {
    code: string
    constructor(message: string, code: string = 'ADMIN_ERROR') {
      super(message)
      this.name = 'AdminServiceError'
      this.code = code
    }
  }

  return {
    AdminServiceError: MockAdminServiceError,
    adminService: {
      fetchFamilies: fetchFamiliesMock,
      createFamily: createFamilyMock,
      updateFamily: updateFamilyMock,
      deactivateFamily: deactivateFamilyMock,
      activateFamily: activateFamilyMock,
      getFamilyMembers: getFamilyMembersMock,
      getAvailableParents: getAvailableParentsMock,
      getAvailableStudents: getAvailableStudentsMock,
      addParentToFamily: addParentToFamilyMock,
      removeParentFromFamily: removeParentFromFamilyMock,
      updateParentRelationship: updateParentRelationshipMock,
      addStudentToFamily: addStudentToFamilyMock,
      removeStudentFromFamily: removeStudentFromFamilyMock,
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

vi.mock('@/components/admin/FamilyList', () => ({
  default: ({ families }: { families: Array<{ id: string; name: string }> }) => (
    <div data-testid="family-list">{families.map((f) => f.name).join(',')}</div>
  ),
}))

vi.mock('@/components/admin/FamilyRelationshipEditor', () => ({
  default: () => <div data-testid="family-relationship-editor" />,
}))

vi.mock('@/components/admin/FamilyForm', () => ({
  default: ({ onSave }: { onSave: (payload: FamilyFormPayload) => void }) => (
    <button
      data-testid="mock-family-save"
      onClick={() =>
        onSave({
          id: 'family-1',
          name: 'Family One',
          guardianEmail: 'guardian@example.com',
          description: 'desc',
          relatedTopics: [],
          createdAt: '2026-01-01T00:00:00Z',
          updatedAt: '2026-01-01T00:00:00Z',
        })
      }
    >
      save
    </button>
  ),
}))

vi.mock('@/components/admin/ConfirmDialog', () => ({
  default: () => null,
}))

vi.mock('@/components/admin/NotificationToast', () => ({
  default: ({ message }: { message: string }) => <div data-testid="toast">{message}</div>,
}))

describe('FamilyManagementPage integration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    fetchFamiliesMock.mockResolvedValue([
      {
        id: 'family-1',
        name: 'Family One',
        guardianEmail: 'guardian@example.com',
        description: '',
        relatedTopics: [],
        isActive: true,
        deactivatedAt: null,
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
      },
    ])
    createFamilyMock.mockResolvedValue(undefined)
  })

  it('loads active families by default and supports include-inactive toggle', async () => {
    const user = userEvent.setup()
    await act(async () => {
      render(<FamilyManagementPage />)
    })

    await waitFor(() => {
      expect(fetchFamiliesMock).toHaveBeenCalledWith({ includeInactive: false })
    })

    await user.click(screen.getByRole('checkbox'))

    await waitFor(() => {
      expect(fetchFamiliesMock).toHaveBeenLastCalledWith({ includeInactive: true })
    })
  })

  it('shows validation message when create family fails field validation', async () => {
    const user = userEvent.setup()
    createFamilyMock.mockRejectedValue(
      new AdminServiceError(
        JSON.stringify({ fieldErrors: { guardianEmail: '監護人電子郵件已存在' } }),
        'FAMILY_VALIDATION_ERROR'
      )
    )

    await act(async () => {
      render(<FamilyManagementPage />)
    })

    await waitFor(() => {
      expect(fetchFamiliesMock).toHaveBeenCalled()
    })

    await user.click(screen.getByTestId('create-btn'))
    await user.click(screen.getByTestId('mock-family-save'))

    await waitFor(() => {
      expect(createFamilyMock).toHaveBeenCalled()
      expect(screen.getByTestId('toast')).toHaveTextContent('監護人電子郵件已存在')
    })
  })
})
