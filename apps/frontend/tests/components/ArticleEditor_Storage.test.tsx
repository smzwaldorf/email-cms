
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { ArticleEditor } from '@/components/ArticleEditor'
import { Article } from '@/types/article'
import { BrowserRouter } from 'react-router-dom'

// Mock dependencies
vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'user1', role: 'admin' },
  }),
}))

vi.mock('@/services/PermissionService', () => {
  class PermissionError extends Error {
    constructor(message: string) {
      super(message)
      this.name = 'PermissionError'
    }
  }
  return {
    default: {
      checkPermission: vi.fn().mockResolvedValue(true),
      canEditArticle: vi.fn().mockResolvedValue(true),
    },
    PermissionError,
  }
})

vi.mock('@/services/ArticleService', () => ({
  default: {
    updateArticle: vi.fn().mockResolvedValue({}),
    getArticleById: vi.fn().mockResolvedValue({ id: '1', authorId: 'user1' }),
  },
}))

// Mock Supabase
const mockCreateSignedUrl = vi.fn().mockResolvedValue({
  data: { signedUrl: 'http://signed-url.com/image.jpg?token=123' },
  error: null,
})

vi.mock('@/lib/supabase', () => ({
  getSupabaseClient: () => ({
    storage: {
      from: () => ({
        createSignedUrl: mockCreateSignedUrl,
      }),
    },
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user1' } } }),
    },
  }),
}))

describe('ArticleEditor Storage URL Preservation', () => {
  const mockArticle: Article = {
    id: '1',
    title: 'Test Article',
    content: '<p>Content with <img src="storage://media/test.jpg"></p>',
    authorId: 'user1',
    status: 'draft',
    createdAt: '2023-01-01',
    updatedAt: '2023-01-01',
    slug: 'test-article',
  }

  const mockOnSave = vi.fn()
  const mockOnCancel = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should preserve storage:// URLs when saving', async () => {
    render(
      <BrowserRouter>
        <ArticleEditor
          article={mockArticle}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
        />
      </BrowserRouter>
    )

    // Wait for editor to load
    await waitFor(() => {
      expect(screen.getByText('編輯文章')).toBeInTheDocument()
    })

    // Click save button
    const saveButton = screen.getByText('儲存')
    fireEvent.click(saveButton)

    // Check what was passed to onSave
    await waitFor(() => {
      expect(mockOnSave).toHaveBeenCalled()
    })

    const savedData = mockOnSave.mock.calls[0][0]
    // The content should still contain storage:// URL, NOT the signed URL
    expect(savedData.content).toContain('storage://media/test.jpg')
    expect(savedData.content).not.toContain('http://signed-url.com')
  })
})
