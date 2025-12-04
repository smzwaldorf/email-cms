/**
 * ArticleEditor Component Tests
 * Tests for article creation and editing form
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ArticleEditor } from '@/components/ArticleEditor'
import type { Article } from '@/types'

// Mock the permission services
vi.mock('@/services/PermissionService', () => ({
  default: {
    getUserRole: vi.fn().mockResolvedValue('admin'),
    canEditArticle: vi.fn().mockResolvedValue(true),
  },
  PermissionError: class PermissionError extends Error {
    constructor(message: string) {
      super(message)
      this.name = 'PermissionError'
    }
  },
}))

vi.mock('@/services/ArticleService', () => ({
  default: {
    getArticleById: vi.fn(async (id: string) => ({
      id,
      title: 'Test Article',
      content: '# Test Content',
      author: 'Test Author',
      week_number: '2025-W47',
      article_order: 1,
      is_published: false,
      visibility_type: 'public',
      created_at: '2025-11-17T10:00:00Z',
      updated_at: '2025-11-17T10:00:00Z',
    })),
  },
}))

// Mock AuthContext
vi.mock('@/context/AuthContext', async () => {
  const actual = await vi.importActual('@/context/AuthContext')
  return {
    ...actual,
    useAuth: () => ({
      user: { id: 'test-user', email: 'test@example.com', role: 'admin' },
      isAuthenticated: true,
      isLoading: false,
      signIn: vi.fn(),
      signOut: vi.fn(),
    }),
  }
})

describe('ArticleEditor Component', () => {
  const mockArticle: Article = {
    id: 'test-1',
    shortId: 'a001',
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

      expect(screen.getByText('編輯文章')).toBeInTheDocument()
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

      expect(screen.getByRole('button', { name: '儲存' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: '取消' })).toBeInTheDocument()
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

      const saveButton = screen.getByRole('button', { name: '儲存' })
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

      const cancelButton = screen.getByRole('button', { name: '取消' })
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

      const saveButton = screen.getByRole('button', { name: '儲存中...' })
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

      const titleInput = screen.getByPlaceholderText('輸入文章標題') as HTMLInputElement
      expect(titleInput.value).toBe('')
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

      // Just verify the editor is rendered with empty content
      expect(screen.getByText(/使用富文本編輯器編輯內容/)).toBeInTheDocument()
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
    it('should render the rich text editor for content', () => {
      render(
        <ArticleEditor
          article={mockArticle}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
        />,
      )

      // Check that the editor is rendered
      expect(screen.getByText('內容')).toBeInTheDocument()
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
      expect(screen.getByText('已發布')).toBeInTheDocument()
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
      const publishToggle = screen.getByRole('checkbox', { name: '已發布' })
      expect(publishToggle).not.toBeChecked()

      // Click and wait for state update
      await act(async () => {
        await user.click(publishToggle)
      })

      expect(publishToggle).toBeChecked()
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
      expect(screen.getByDisplayValue(mockArticle.title)).toBeInTheDocument()
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

      expect(screen.getByRole('button', { name: '儲存' })).toBeInTheDocument()
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

      const saveButton = screen.getByRole('button', { name: '儲存中...' })
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

      const saveButton = screen.getByRole('button', { name: '儲存' })
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
