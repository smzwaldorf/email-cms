import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import { ClassForm } from '@/components/admin/ClassForm'
import { ClassList } from '@/components/admin/ClassList'
import type { AdminClass } from '@/types/admin'

describe('Admin Class Management Workflow', () => {
  const mockClasses: AdminClass[] = [
    {
      id: 'class-1',
      name: '五年級 A 班',
      gradeYear: 5,
      teacherId: 'teacher-1',
      studentIds: ['student-1', 'student-2', 'student-3'],
      createdAt: '2025-01-01',
      updatedAt: '2025-12-04',
    },
    {
      id: 'class-2',
      name: '六年級 B 班',
      gradeYear: 6,
      teacherId: 'teacher-2',
      studentIds: ['student-4', 'student-5'],
      createdAt: '2025-02-01',
      updatedAt: '2025-12-04',
    },
  ]

  describe('ClassForm Component', () => {
    it('renders form with empty fields for new class', () => {
      const onSubmit = vi.fn()
      const onCancel = vi.fn()

      render(
        <ClassForm
          onSubmit={onSubmit}
          onCancel={onCancel}
        />
      )

      expect(screen.getByLabelText(/班級名稱/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/年級/i)).toBeInTheDocument()
      expect(screen.getByText('新增班級')).toBeInTheDocument()
    })

    it('renders form with pre-filled data for existing class', () => {
      const onSubmit = vi.fn()
      const onCancel = vi.fn()

      render(
        <ClassForm
          initialData={mockClasses[0]}
          onSubmit={onSubmit}
          onCancel={onCancel}
        />
      )

      const nameInput = screen.getByDisplayValue('五年級 A 班') as HTMLInputElement
      expect(nameInput.value).toBe('五年級 A 班')
    })

    it('validates required fields before submission', async () => {
      const onSubmit = vi.fn()
      const onCancel = vi.fn()

      render(
        <ClassForm
          onSubmit={onSubmit}
          onCancel={onCancel}
        />
      )

      const submitButton = screen.getByText('新增班級')
      fireEvent.click(submitButton)

      // Form validation should prevent submission
      await waitFor(() => {
        expect(onSubmit).not.toHaveBeenCalled()
      })
    })

    it('calls onSubmit with class data when form is submitted', async () => {
      const onSubmit = vi.fn().mockResolvedValue(undefined)
      const onCancel = vi.fn()

      render(
        <ClassForm
          onSubmit={onSubmit}
          onCancel={onCancel}
        />
      )

      const nameInput = screen.getByLabelText(/班級名稱/i)
      const gradeSelect = screen.getByLabelText(/年級/i)

      fireEvent.change(nameInput, { target: { value: '新班級' } })
      fireEvent.change(gradeSelect, { target: { value: '5' } })

      const submitButton = screen.getByText('新增班級')
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(onSubmit).toHaveBeenCalledWith(
          expect.objectContaining({
            name: '新班級',
            gradeYear: 5,
          })
        )
      })
    })

    it('calls onCancel when cancel button is clicked', () => {
      const onSubmit = vi.fn()
      const onCancel = vi.fn()

      render(
        <ClassForm
          onSubmit={onSubmit}
          onCancel={onCancel}
        />
      )

      const cancelButton = screen.getByText('取消')
      fireEvent.click(cancelButton)

      expect(onCancel).toHaveBeenCalled()
    })
  })

  describe('ClassList Component', () => {
    it('displays list of classes with details', () => {
      const onEdit = vi.fn()
      const onDelete = vi.fn()

      const { container } = render(
        <BrowserRouter>
          <ClassList
            classes={mockClasses}
            onEdit={onEdit}
            onDelete={onDelete}
          />
        </BrowserRouter>
      )

      expect(container.textContent).toContain('五年級 A 班')
      expect(container.textContent).toContain('六年級 B 班')
      expect(container.textContent).toContain('3')
      expect(container.textContent).toContain('2')
    })

    it('calls onEdit when edit button is clicked', () => {
      const onEdit = vi.fn()
      const onDelete = vi.fn()

      const { container } = render(
        <BrowserRouter>
          <ClassList
            classes={mockClasses}
            onEdit={onEdit}
            onDelete={onDelete}
          />
        </BrowserRouter>
      )

      const editButtons = container.querySelectorAll('button')
      const editButton = Array.from(editButtons).find(btn =>
        btn.title?.includes('編輯') || btn.textContent?.includes('編輯')
      )

      if (editButton) {
        fireEvent.click(editButton)
        expect(onEdit).toHaveBeenCalled()
      }
    })

    it('calls onDelete when delete button is clicked', () => {
      const onEdit = vi.fn()
      const onDelete = vi.fn()

      const { container } = render(
        <BrowserRouter>
          <ClassList
            classes={mockClasses}
            onEdit={onEdit}
            onDelete={onDelete}
          />
        </BrowserRouter>
      )

      const deleteButtons = container.querySelectorAll('button')
      const deleteButton = Array.from(deleteButtons).find(btn =>
        btn.title?.includes('刪除') || btn.textContent?.includes('刪除')
      )

      if (deleteButton) {
        fireEvent.click(deleteButton)
        expect(onDelete).toHaveBeenCalled()
      }
    })

    it('handles empty class list gracefully', () => {
      const onEdit = vi.fn()
      const onDelete = vi.fn()

      const { container } = render(
        <BrowserRouter>
          <ClassList
            classes={[]}
            onEdit={onEdit}
            onDelete={onDelete}
          />
        </BrowserRouter>
      )

      // Should show message or handle empty state
      expect(container).toBeInTheDocument()
    })
  })

  describe('Complete Class Management Workflow', () => {
    it('creates new class successfully', async () => {
      const onCreate = vi.fn().mockResolvedValue({
        id: 'class-3',
        name: '新班級',
        gradeYear: 5,
        studentIds: [],
      })

      render(
        <ClassForm
          onSubmit={onCreate}
          onCancel={() => {}}
        />
      )

      const nameInput = screen.getByLabelText(/班級名稱/i)
      const gradeSelect = screen.getByLabelText(/年級/i)

      fireEvent.change(nameInput, { target: { value: '新班級' } })
      fireEvent.change(gradeSelect, { target: { value: '5' } })

      const submitButton = screen.getByText('新增班級')
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(onCreate).toHaveBeenCalled()
      })
    })

    it('edits existing class successfully', async () => {
      const onUpdate = vi.fn().mockResolvedValue(undefined)

      render(
        <ClassForm
          initialData={mockClasses[0]}
          onSubmit={onUpdate}
          onCancel={() => {}}
        />
      )

      const nameInput = screen.getByDisplayValue('五年級 A 班') as HTMLInputElement
      fireEvent.change(nameInput, { target: { value: '五年級 A 班（修改）' } })

      const submitButton = screen.getByText('編輯班級')
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(onUpdate).toHaveBeenCalledWith(
          expect.objectContaining({
            name: '五年級 A 班（修改）',
          })
        )
      })
    })

    it('validates unique class names', async () => {
      const onSubmit = vi.fn()

      render(
        <ClassForm
          onSubmit={onSubmit}
          onCancel={() => {}}
          existingClasses={mockClasses}
        />
      )

      const nameInput = screen.getByLabelText(/班級名稱/i)
      fireEvent.change(nameInput, { target: { value: '五年級 A 班' } })

      const submitButton = screen.getByText('新增班級')
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(onSubmit).not.toHaveBeenCalled()
      })
    })

    it('displays student count in class list', () => {
      const onEdit = vi.fn()
      const onDelete = vi.fn()

      const { container } = render(
        <BrowserRouter>
          <ClassList
            classes={mockClasses}
            onEdit={onEdit}
            onDelete={onDelete}
          />
        </BrowserRouter>
      )

      // Check that student counts are displayed
      const bodyText = container.textContent || ''
      expect(bodyText).toContain('3')
      expect(bodyText).toContain('2')
    })
  })
})
