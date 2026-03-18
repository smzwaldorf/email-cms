import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import TeacherForm from '@/components/admin/TeacherForm'
import TeacherList from '@/components/admin/TeacherList'
import type { AdminUser } from '@/types/admin'

describe('Admin Teacher Management Workflow', () => {
  const mockTeachers: AdminUser[] = [
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
    {
      id: 'teacher-2',
      email: 'teacher2@example.com',
      name: '林老師',
      role: 'teacher',
      status: 'disabled',
      createdAt: '2025-01-01',
      updatedAt: '2025-01-01',
      lastLoginAt: null,
    },
  ]

  it('creates teacher with required fields', async () => {
    const onSave = vi.fn()
    render(<TeacherForm isNew={true} onSave={onSave} onCancel={() => {}} />)

    fireEvent.change(screen.getByTestId('teacher-name-input'), { target: { value: '陳老師' } })
    fireEvent.change(screen.getByTestId('teacher-email-input'), {
      target: { value: 'teacher3@example.com' },
    })
    fireEvent.click(screen.getByTestId('teacher-save-btn'))

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith({
        name: '陳老師',
        email: 'teacher3@example.com',
      })
    })
  })

  it('shows validation errors when required fields are missing', async () => {
    const onSave = vi.fn()
    render(<TeacherForm isNew={true} onSave={onSave} onCancel={() => {}} />)

    fireEvent.click(screen.getByTestId('teacher-save-btn'))
    await waitFor(() => {
      expect(screen.getByText('教師姓名為必填項')).toBeInTheDocument()
      expect(screen.getByText('教師電子郵件為必填項')).toBeInTheDocument()
      expect(onSave).not.toHaveBeenCalled()
    })
  })

  it('renders active and inactive lifecycle actions in list', () => {
    const onEdit = vi.fn()
    const onActivate = vi.fn()
    const onDeactivate = vi.fn()

    render(
      <TeacherList
        teachers={mockTeachers}
        onEdit={onEdit}
        onActivate={onActivate}
        onDeactivate={onDeactivate}
      />,
    )

    expect(screen.getByText('王老師')).toBeInTheDocument()
    expect(screen.getByText('林老師')).toBeInTheDocument()
    expect(screen.getByTestId('deactivate-teacher-btn-teacher-1')).toBeInTheDocument()
    expect(screen.getByTestId('activate-teacher-btn-teacher-2')).toBeInTheDocument()
  })
})
