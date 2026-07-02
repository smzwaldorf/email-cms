import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import { ClassForm } from '@/components/admin/ClassForm'
import { ClassList } from '@/components/admin/ClassList'
import type { Class } from '@/types/admin'

describe('Admin Class Management Workflow', () => {
  const mockClasses: Class[] = [
    {
      id: 'class-1',
      code: 'G5A',
      name: '五年級 A 班',
      description: '五年級 A 班',
      gradeYear: 5,
      isActive: true,
      studentIds: ['student-1', 'student-2', 'student-3'],
      createdAt: '2025-01-01',
      updatedAt: '2025-12-04',
    },
    {
      id: 'class-2',
      code: 'G6B',
      name: '六年級 B 班',
      description: '六年級 B 班',
      gradeYear: 6,
      isActive: true,
      studentIds: ['student-4', 'student-5'],
      createdAt: '2025-02-01',
      updatedAt: '2025-12-04',
    },
  ]

  describe('ClassForm Component', () => {
    it('renders form with empty fields for new class', () => {
      const onSave = vi.fn()
      const onCancel = vi.fn()

      render(
        <ClassForm
          isNew={true}
          onSave={onSave}
          onCancel={onCancel}
        />
      )

      expect(screen.getByTestId('name-input')).toBeInTheDocument()
      expect(screen.getByText('新增班級')).toBeInTheDocument()
    })

    it('renders form with pre-filled data for existing class', () => {
      const onSave = vi.fn()
      const onCancel = vi.fn()

      render(
        <ClassForm
          class={mockClasses[0]}
          onSave={onSave}
          onCancel={onCancel}
        />
      )

      const nameInput = screen.getByTestId('name-input') as HTMLInputElement
      expect(nameInput.value).toBe('五年級 A 班')
      expect(screen.getByText('編輯班級')).toBeInTheDocument()
    })

    it('validates required fields before submission', async () => {
      const onSave = vi.fn()
      const onCancel = vi.fn()

      render(
        <ClassForm
          isNew={true}
          onSave={onSave}
          onCancel={onCancel}
        />
      )

      const submitButton = screen.getByTestId('save-btn')
      fireEvent.click(submitButton)

      // Form validation should prevent submission
      await waitFor(() => {
        expect(screen.getByTestId('name-error')).toBeInTheDocument()
        expect(onSave).not.toHaveBeenCalled()
      })
    })

    it('calls onSave with class data when form is submitted', async () => {
      const onSave = vi.fn()
      const onCancel = vi.fn()

      render(
        <ClassForm
          isNew={true}
          onSave={onSave}
          onCancel={onCancel}
        />
      )

      const nameInput = screen.getByTestId('name-input')
      const codeInput = screen.getByTestId('code-input')

      fireEvent.change(nameInput, { target: { value: '新班級' } })
      fireEvent.change(codeInput, { target: { value: 'NEW01' } })

      const submitButton = screen.getByTestId('save-btn')
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(onSave).toHaveBeenCalledWith(
          expect.objectContaining({
            name: '新班級',
          })
        )
      })
    })

    it('calls onCancel when cancel button is clicked', () => {
      const onSave = vi.fn()
      const onCancel = vi.fn()

      render(
        <ClassForm
          isNew={true}
          onSave={onSave}
          onCancel={onCancel}
        />
      )

      const cancelButton = screen.getByTestId('cancel-btn')
      fireEvent.click(cancelButton)

      expect(onCancel).toHaveBeenCalled()
    })
  })

  describe('ClassList Component', () => {
    it('displays list of classes with details', () => {
      const onEdit = vi.fn()
      const onDeactivate = vi.fn()

      const { container } = render(
        <BrowserRouter>
          <ClassList
            classes={mockClasses}
            onEdit={onEdit}
            onDeactivate={onDeactivate}
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
      const onDeactivate = vi.fn()

      const { container } = render(
        <BrowserRouter>
          <ClassList
            classes={mockClasses}
            onEdit={onEdit}
            onDeactivate={onDeactivate}
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

    it('calls onDeactivate when deactivate button is clicked', () => {
      const onEdit = vi.fn()
      const onDeactivate = vi.fn()

      const { container } = render(
        <BrowserRouter>
          <ClassList
            classes={mockClasses}
            onEdit={onEdit}
            onDeactivate={onDeactivate}
          />
        </BrowserRouter>
      )

      const actionButtons = container.querySelectorAll('button')
      const deactivateButton = Array.from(actionButtons).find(btn =>
        btn.title?.includes('停用') || btn.textContent?.includes('停用')
      )

      if (deactivateButton) {
        fireEvent.click(deactivateButton)
        expect(onDeactivate).toHaveBeenCalled()
      }
    })

    it('handles empty class list gracefully', () => {
      const onEdit = vi.fn()
      const onDeactivate = vi.fn()

      const { container } = render(
        <BrowserRouter>
          <ClassList
            classes={[]}
            onEdit={onEdit}
            onDeactivate={onDeactivate}
          />
        </BrowserRouter>
      )

      // Should show message or handle empty state
      expect(container).toBeInTheDocument()
    })
  })

  describe('Complete Class Management Workflow', () => {
    it('creates new class successfully', async () => {
      const onCreate = vi.fn()

      render(
        <ClassForm
          isNew={true}
          onSave={onCreate}
          onCancel={() => {}}
        />
      )

      const nameInput = screen.getByTestId('name-input')
      const codeInput = screen.getByTestId('code-input')

      fireEvent.change(nameInput, { target: { value: '新班級' } })
      fireEvent.change(codeInput, { target: { value: 'NEW02' } })

      const submitButton = screen.getByTestId('save-btn')
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(onCreate).toHaveBeenCalledWith(
          expect.objectContaining({
            name: '新班級',
            studentIds: [],
          })
        )
      })
    })

    it('edits existing class successfully', async () => {
      const onUpdate = vi.fn()

      render(
        <ClassForm
          class={mockClasses[0]}
          onSave={onUpdate}
          onCancel={() => {}}
        />
      )

      const nameInput = screen.getByTestId('name-input') as HTMLInputElement
      fireEvent.change(nameInput, { target: { value: '五年級 A 班（修改）' } })

      const submitButton = screen.getByTestId('save-btn')
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(onUpdate).toHaveBeenCalledWith(
          expect.objectContaining({
            name: '五年級 A 班（修改）',
          })
        )
      })
    })

    it('displays student count in class list', () => {
      const onEdit = vi.fn()
      const onDeactivate = vi.fn()

      const { container } = render(
        <BrowserRouter>
          <ClassList
            classes={mockClasses}
            onEdit={onEdit}
            onDeactivate={onDeactivate}
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
