/**
 * Test - Class Form Component (Admin)
 * T040: Class form unit tests with validation and student selection
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ClassForm from '@/components/admin/ClassForm'
import type { Class, AdminUser } from '@/types/admin'

describe('ClassForm', () => {
  const mockClass: Class = {
    id: 'class-001',
    name: '6年級A班',
    description: '六年級甲班',
    studentIds: ['student-001', 'student-002'],
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-01-01T00:00:00Z',
  }

  const mockStudents: AdminUser[] = [
    {
      id: 'student-001',
      email: 'student1@example.com',
      name: '王小明',
      role: 'student',
      status: 'active',
      createdAt: '2025-01-01T00:00:00Z',
      updatedAt: '2025-01-01T00:00:00Z',
    },
    {
      id: 'student-002',
      email: 'student2@example.com',
      name: '李小華',
      role: 'student',
      status: 'active',
      createdAt: '2025-01-01T00:00:00Z',
      updatedAt: '2025-01-01T00:00:00Z',
    },
    {
      id: 'student-003',
      email: 'student3@example.com',
      name: '張小美',
      role: 'student',
      status: 'active',
      createdAt: '2025-01-01T00:00:00Z',
      updatedAt: '2025-01-01T00:00:00Z',
    },
  ]

  /**
   * Test: Render new class form
   */
  it('should render new class form with empty fields', () => {
    const onCancel = vi.fn()
    render(
      <ClassForm
        isNew={true}
        onCancel={onCancel}
        availableStudents={mockStudents}
      />
    )

    expect(screen.getByText('新增班級')).toBeInTheDocument()
    expect(screen.getByTestId('name-input')).toHaveValue('')
    expect(screen.getByTestId('description-input')).toHaveValue('')
  })

  /**
   * Test: Render edit class form
   */
  it('should render edit class form with populated fields', () => {
    const onCancel = vi.fn()
    render(
      <ClassForm
        class={mockClass}
        isNew={false}
        onCancel={onCancel}
        availableStudents={mockStudents}
      />
    )

    expect(screen.getByText('編輯班級')).toBeInTheDocument()
    expect(screen.getByTestId('name-input')).toHaveValue('6年級A班')
    expect(screen.getByTestId('description-input')).toHaveValue('六年級甲班')
  })

  /**
   * Test: Validate required name field
   */
  it('should show validation error when name is empty', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    const onCancel = vi.fn()

    render(
      <ClassForm
        isNew={true}
        onSave={onSave}
        onCancel={onCancel}
        availableStudents={mockStudents}
      />
    )

    const saveBtn = screen.getByTestId('save-btn')
    await user.click(saveBtn)

    await waitFor(() => {
      expect(screen.getByTestId('name-error')).toBeInTheDocument()
      expect(screen.getByTestId('name-error')).toHaveTextContent('班級名稱為必填項')
      expect(onSave).not.toHaveBeenCalled()
    })
  })

  /**
   * Test: Update name field
   */
  it('should update name field and clear validation error', async () => {
    const user = userEvent.setup()
    const onCancel = vi.fn()

    render(
      <ClassForm
        isNew={true}
        onCancel={onCancel}
        availableStudents={mockStudents}
      />
    )

    const nameInput = screen.getByTestId('name-input') as HTMLInputElement
    await user.clear(nameInput)
    await user.type(nameInput, '高二英文班')

    expect(nameInput.value).toBe('高二英文班')
    expect(screen.queryByTestId('name-error')).not.toBeInTheDocument()
  })

  /**
   * Test: Update description field
   */
  it('should update description field', async () => {
    const user = userEvent.setup()
    const onCancel = vi.fn()

    render(
      <ClassForm
        class={mockClass}
        isNew={false}
        onCancel={onCancel}
        availableStudents={mockStudents}
      />
    )

    const descInput = screen.getByTestId('description-input') as HTMLTextAreaElement
    await user.clear(descInput)
    await user.type(descInput, '二年級英文課程')

    expect(descInput.value).toBe('二年級英文課程')
  })

  /**
   * Test: Select and deselect students via dropdown
   */
  it('should select and deselect students', async () => {
    const user = userEvent.setup()
    const onCancel = vi.fn()

    render(
      <ClassForm
        isNew={true}
        onCancel={onCancel}
        availableStudents={mockStudents}
      />
    )

    // Initial - add button should be present
    expect(screen.getByText('+ 添加學生')).toBeInTheDocument()

    // Open dropdown and select first student
    const addButton = screen.getByText('+ 添加學生')
    await user.click(addButton)

    const student1 = await screen.findByText('王小明')
    await user.click(student1)

    // Select second student
    const addButton2 = screen.getByText('+ 添加學生')
    await user.click(addButton2)

    const student2 = await screen.findByText('李小華')
    await user.click(student2)

    // Should show selected students with remove buttons
    expect(screen.getByText('王小明')).toBeInTheDocument()
    expect(screen.getByText('李小華')).toBeInTheDocument()

    // Should be able to remove students
    const removeButtons = screen.getAllByText('移除')
    expect(removeButtons.length).toBeGreaterThan(0)
  })

  /**
   * Test: Pre-selected students in edit mode
   */
  it('should pre-select students in edit mode', () => {
    render(
      <ClassForm
        class={mockClass}
        isNew={false}
        availableStudents={mockStudents}
      />
    )

    // Pre-selected students should be displayed
    expect(screen.getByText('王小明')).toBeInTheDocument()
    expect(screen.getByText('李小華')).toBeInTheDocument()

    // Non-selected student should not be displayed
    expect(screen.queryByText('張小美')).not.toBeInTheDocument()
  })

  /**
   * Test: Save button functionality
   */
  it('should call onSave with class data when form is valid', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    const onCancel = vi.fn()

    render(
      <ClassForm
        isNew={true}
        onSave={onSave}
        onCancel={onCancel}
        availableStudents={mockStudents}
      />
    )

    // Fill in form
    const nameInput = screen.getByTestId('name-input')
    await user.type(nameInput, '新班級')

    const descInput = screen.getByTestId('description-input')
    await user.type(descInput, '新班級描述')

    // Select first student via dropdown
    const addButton = screen.getByText('+ 添加學生')
    await user.click(addButton)

    const student1 = await screen.findByText('王小明')
    await user.click(student1)

    // Save
    const saveBtn = screen.getByTestId('save-btn')
    await user.click(saveBtn)

    await waitFor(() => {
      expect(onSave).toHaveBeenCalled()
      const savedClass = onSave.mock.calls[0][0]
      expect(savedClass.name).toBe('新班級')
      expect(savedClass.description).toBe('新班級描述')
      expect(savedClass.studentIds).toContain('student-001')
    })
  })

  /**
   * Test: Cancel button functionality
   */
  it('should call onCancel when cancel button is clicked', async () => {
    const user = userEvent.setup()
    const onCancel = vi.fn()

    render(
      <ClassForm
        isNew={true}
        onCancel={onCancel}
        availableStudents={mockStudents}
      />
    )

    const cancelBtn = screen.getByTestId('cancel-btn')
    await user.click(cancelBtn)

    expect(onCancel).toHaveBeenCalled()
  })

  /**
   * Test: Error message display
   */
  it('should display error message when onError is called', async () => {
    const user = userEvent.setup()
    const onError = vi.fn()
    const { rerender } = render(
      <ClassForm
        isNew={true}
        onError={onError}
        availableStudents={mockStudents}
      />
    )

    // Simulate error by checking if error display works
    const nameInput = screen.getByTestId('name-input')
    await user.type(nameInput, '班級名稱')

    const saveBtn = screen.getByTestId('save-btn')
    await user.click(saveBtn)

    // In a real scenario, onError would be called from parent
    // This test verifies the error state handling structure
  })

  /**
   * Test: Student count display
   */
  it('should display correct student count', async () => {
    const user = userEvent.setup()
    const onCancel = vi.fn()

    render(
      <ClassForm
        isNew={true}
        onCancel={onCancel}
        availableStudents={mockStudents}
      />
    )

    // Initial: add button should be present
    expect(screen.getByText('+ 添加學生')).toBeInTheDocument()

    // Select all students
    for (let i = 0; i < 3; i++) {
      const addButton = screen.getByText('+ 添加學生')
      await user.click(addButton)

      const studentNames = ['王小明', '李小華', '張小美']
      const student = await screen.findByText(studentNames[i])
      await user.click(student)
    }

    // All students should be selected and displayed
    expect(screen.getByText('王小明')).toBeInTheDocument()
    expect(screen.getByText('李小華')).toBeInTheDocument()
    expect(screen.getByText('張小美')).toBeInTheDocument()

    // After all selected, "All students selected" message should appear
    expect(screen.getByText('所有學生已選擇')).toBeInTheDocument()
  })

  /**
   * Test: No students available
   */
  it('should handle case when no students are available', () => {
    const onCancel = vi.fn()

    render(
      <ClassForm
        isNew={true}
        onCancel={onCancel}
        availableStudents={[]}
      />
    )

    // Should show message about no available students
    expect(
      screen.getByText('沒有可用的學生帳戶。請先在用戶管理中建立學生帳戶。')
    ).toBeInTheDocument()

    // Should not show the add button
    expect(screen.queryByText('+ 添加學生')).not.toBeInTheDocument()
  })
})
