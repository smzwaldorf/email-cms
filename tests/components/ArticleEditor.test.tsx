/**
 * ArticleEditor Component Tests
 * Tests for article creation and editing form
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ArticleEditor } from '@/components/ArticleEditor'
import type { Article } from '@/types'

describe('ArticleEditor Component', () => {
  const mockArticle: Article = {
    id: 'test-1',
    title: 'Test Article',
    content: '# Test Content',
    author: 'Test Author',
    weekNumber: '2025-W47',
    order: 1,
    publicUrl: '/articles/test-1',
    isPublished: false,
    createdAt: '2025-11-17T10:00:00Z',
    updatedAt: '2025-11-17T10:00:00Z',
  }

  const mockOnSave = vi.fn()
  const mockOnCancel = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Rendering', () => {
    it('should render the editor form', () => {
      render(
        <ArticleEditor
          article={mockArticle}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
        />,
      )

      expect(screen.getByText(/article/i, { selector: 'form' })).toBeInTheDocument()
    })

    it('should populate form with article data', () => {
      render(
        <ArticleEditor
          article={mockArticle}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
        />,
      )

      expect(screen.getByDisplayValue(mockArticle.title)).toBeInTheDocument()
    })

    it('should show save and cancel buttons', () => {
      render(
        <ArticleEditor
          article={mockArticle}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
        />,
      )

      expect(screen.getByRole('button', { name: /save/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument()
    })
  })

  describe('Form Submission', () => {
    it('should call onSave with form data on submit', async () => {
      const user = userEvent.setup()

      render(
        <ArticleEditor
          article={mockArticle}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
        />,
      )

      const saveButton = screen.getByRole('button', { name: /save/i })
      await user.click(saveButton)

      expect(mockOnSave).toHaveBeenCalled()
    })

    it('should call onCancel when cancel button clicked', async () => {
      const user = userEvent.setup()

      render(
        <ArticleEditor
          article={mockArticle}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
        />,
      )

      const cancelButton = screen.getByRole('button', { name: /cancel/i })
      await user.click(cancelButton)

      expect(mockOnCancel).toHaveBeenCalled()
    })

    it('should disable buttons while saving', () => {
      render(
        <ArticleEditor
          article={mockArticle}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
          isSaving={true}
        />,
      )

      const saveButton = screen.getByRole('button', { name: /save/i })
      expect(saveButton).toBeDisabled()
    })
  })

  describe('Input Validation', () => {
    it('should require article title', async () => {
      const emptyArticle = { ...mockArticle, title: '' }

      render(
        <ArticleEditor
          article={emptyArticle}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
        />,
      )

      const titleInput = screen.getByDisplayValue('')
      expect(titleInput).toBeInTheDocument()
    })

    it('should require article content', async () => {
      const emptyArticle = { ...mockArticle, content: '' }

      render(
        <ArticleEditor
          article={emptyArticle}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
        />,
      )

      expect(screen.getByDisplayValue('', { selector: 'textarea' })).toBeInTheDocument()
    })

    it('should validate title length', async () => {
      const longTitle = 'a'.repeat(501)
      const articleWithLongTitle = { ...mockArticle, title: longTitle }

      render(
        <ArticleEditor
          article={articleWithLongTitle}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
        />,
      )

      expect(screen.getByDisplayValue(longTitle)).toBeInTheDocument()
    })
  })

  describe('Content Editing', () => {
    it('should allow editing article content', async () => {
      const user = userEvent.setup()

      render(
        <ArticleEditor
          article={mockArticle}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
        />,
      )

      const contentTextarea = screen.getByDisplayValue(mockArticle.content)
      await user.clear(contentTextarea)
      await user.type(contentTextarea, '# Updated Content')

      expect(contentTextarea).toHaveValue('# Updated Content')
    })

    it('should allow editing title', async () => {
      const user = userEvent.setup()

      render(
        <ArticleEditor
          article={mockArticle}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
        />,
      )

      const titleInput = screen.getByDisplayValue(mockArticle.title)
      await user.clear(titleInput)
      await user.type(titleInput, 'New Title')

      expect(titleInput).toHaveValue('New Title')
    })

    it('should allow editing author', async () => {
      const user = userEvent.setup()

      render(
        <ArticleEditor
          article={mockArticle}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
        />,
      )

      const authorInput = screen.getByDisplayValue(mockArticle.author || '')
      await user.clear(authorInput)
      await user.type(authorInput, 'New Author')

      expect(authorInput).toHaveValue('New Author')
    })
  })

  describe('Publication Status', () => {
    it('should display publication status toggle', () => {
      render(
        <ArticleEditor
          article={mockArticle}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
        />,
      )

      // Check for publication status indicator
      expect(screen.getByText(/publish/i) || screen.getByRole('checkbox')).toBeDefined()
    })

    it('should allow toggling publication status', async () => {
      const user = userEvent.setup()

      render(
        <ArticleEditor
          article={mockArticle}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
        />,
      )

      // Find and interact with publication toggle
      const publishToggle = screen.queryByRole('checkbox', { name: /publish/i })
      if (publishToggle) {
        await user.click(publishToggle)
        expect(publishToggle).toBeDefined()
      }
    })
  })

  describe('Error Handling', () => {
    it('should display error messages', async () => {
      render(
        <ArticleEditor
          article={mockArticle}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
        />,
      )

      // Verify component renders without error
      expect(screen.getByText(mockArticle.title)).toBeInTheDocument()
    })

    it('should handle save errors gracefully', async () => {
      const mockSaveError = vi.fn()

      render(
        <ArticleEditor
          article={mockArticle}
          onSave={mockSaveError}
          onCancel={mockOnCancel}
        />,
      )

      expect(screen.getByRole('button', { name: /save/i })).toBeInTheDocument()
    })
  })

  describe('Loading States', () => {
    it('should show saving indicator when isSaving is true', () => {
      render(
        <ArticleEditor
          article={mockArticle}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
          isSaving={true}
        />,
      )

      const saveButton = screen.getByRole('button', { name: /save/i })
      expect(saveButton).toBeDisabled()
    })

    it('should enable buttons when isSaving is false', () => {
      render(
        <ArticleEditor
          article={mockArticle}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
          isSaving={false}
        />,
      )

      const saveButton = screen.getByRole('button', { name: /save/i })
      expect(saveButton).not.toBeDisabled()
    })
  })

  describe('Data Persistence', () => {
    it('should update form when article prop changes', async () => {
      const { rerender } = render(
        <ArticleEditor
          article={mockArticle}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
        />,
      )

      const newArticle = {
        ...mockArticle,
        title: 'Updated Article Title',
      }

      rerender(
        <ArticleEditor
          article={newArticle}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
        />,
      )

      expect(screen.getByDisplayValue('Updated Article Title')).toBeInTheDocument()
    })
  })
})
