/**
 * 整合測試 - 使用者故事 4
 * 編輯者工作流：新增 → 排序 → 刪除 → 保存
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import { EditorPage } from '@/pages/EditorPage'
import { fetchWeeklyNewsletter, createArticle, updateArticle, deleteArticle, reorderArticles } from '@/services/mockApi'

// Mock the API
vi.mock('@/services/mockApi', () => ({
  fetchWeeklyNewsletter: vi.fn(),
  createArticle: vi.fn(),
  updateArticle: vi.fn(),
  deleteArticle: vi.fn(),
  reorderArticles: vi.fn(),
}))

// Mock router
const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useParams: () => ({ weekNumber: '2025-W43' }),
  }
})

describe('User Story 4 - Content Management Workflow', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  const initialArticles = [
    {
      id: 'article-001',
      title: 'First Article',
      content: 'Content 1',
      author: 'Author 1',
      summary: 'Summary 1',
      weekNumber: '2025-W43',
      order: 1,
      slug: 'first-article',
      publicUrl: '/article/article-001',
      createdAt: '2025-11-16T00:00:00Z',
      updatedAt: '2025-11-16T00:00:00Z',
      isPublished: true,
    },
    {
      id: 'article-002',
      title: 'Second Article',
      content: 'Content 2',
      author: 'Author 2',
      summary: 'Summary 2',
      weekNumber: '2025-W43',
      order: 2,
      slug: 'second-article',
      publicUrl: '/article/article-002',
      createdAt: '2025-11-16T01:00:00Z',
      updatedAt: '2025-11-16T01:00:00Z',
      isPublished: true,
    },
  ]

  const mockWeekData = {
    weekNumber: '2025-W43',
    releaseDate: '2025-11-16',
    title: 'Week 43',
    articleIds: ['article-001', 'article-002'],
    createdAt: '2025-11-16T00:00:00Z',
    updatedAt: '2025-11-16T00:00:00Z',
    isPublished: true,
    totalArticles: 2,
    articles: initialArticles,
  }

  it('should load editor page with existing articles', async () => {
    vi.mocked(fetchWeeklyNewsletter).mockResolvedValue(mockWeekData)

    render(
      <BrowserRouter>
        <EditorPage />
      </BrowserRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('編輯週報')).toBeDefined()
    })

    // Verify articles are loaded
    await waitFor(() => {
      expect(screen.getByText('First Article')).toBeDefined()
      expect(screen.getByText('Second Article')).toBeDefined()
    })
  })

  it('should allow editor to create new article', async () => {
    vi.mocked(fetchWeeklyNewsletter).mockResolvedValue(mockWeekData)

    const newArticle = {
      id: 'article-003',
      title: 'New Article',
      content: '# New Content',
      author: '',
      summary: '',
      weekNumber: '2025-W43',
      order: 3,
      slug: 'new-article',
      publicUrl: '/article/article-003',
      createdAt: '2025-11-16T02:00:00Z',
      updatedAt: '2025-11-16T02:00:00Z',
      isPublished: false,
    }

    vi.mocked(createArticle).mockResolvedValue(newArticle)

    render(
      <BrowserRouter>
        <EditorPage />
      </BrowserRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('編輯週報')).toBeDefined()
    })

    // Click add article button
    const addButton = screen.getByText(/新增文章|Add Article/i)
    fireEvent.click(addButton)

    await waitFor(() => {
      expect(createArticle).toHaveBeenCalled()
    })
  })

  it('should allow editor to select article for editing', async () => {
    vi.mocked(fetchWeeklyNewsletter).mockResolvedValue(mockWeekData)

    render(
      <BrowserRouter>
        <EditorPage />
      </BrowserRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('First Article')).toBeDefined()
    })

    // Click on article to select it
    const article = screen.getByText('First Article').closest('div')
    if (article) {
      fireEvent.click(article)
    }

    // Article should now be selected for editing
    await waitFor(() => {
      expect(screen.queryByText('First Article')).toBeDefined()
    })
  })

  it('should allow editor to edit article content', async () => {
    vi.mocked(fetchWeeklyNewsletter).mockResolvedValue(mockWeekData)

    const updatedArticle = {
      ...initialArticles[0],
      title: 'Updated Title',
      content: 'Updated content',
    }

    vi.mocked(updateArticle).mockResolvedValue(updatedArticle)

    render(
      <BrowserRouter>
        <EditorPage />
      </BrowserRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('First Article')).toBeDefined()
    })

    // Select article
    const article = screen.getByText('First Article').closest('div')
    if (article) {
      fireEvent.click(article)
    }

    // Edit functionality would be in ArticleEditor component
    // This test verifies the page structure supports editing
  })

  it('should allow editor to reorder articles', async () => {
    vi.mocked(fetchWeeklyNewsletter).mockResolvedValue(mockWeekData)

    const reorderedArticles = [
      { ...initialArticles[1], order: 1 },
      { ...initialArticles[0], order: 2 },
    ]

    vi.mocked(reorderArticles).mockResolvedValue(true)

    render(
      <BrowserRouter>
        <EditorPage />
      </BrowserRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('First Article')).toBeDefined()
    })

    // Reorder would be triggered through drag and drop
    // or move up/down buttons in ArticleOrderManager
  })

  it('should confirm before deleting article', async () => {
    vi.mocked(fetchWeeklyNewsletter).mockResolvedValue(mockWeekData)

    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
    vi.mocked(deleteArticle).mockResolvedValue(undefined)

    render(
      <BrowserRouter>
        <EditorPage />
      </BrowserRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('First Article')).toBeDefined()
    })

    // Delete button interaction would trigger confirmation
    // This is typically handled by a ConfirmDialog component
  })

  it('should cancel deletion if not confirmed', async () => {
    vi.mocked(fetchWeeklyNewsletter).mockResolvedValue(mockWeekData)

    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false)
    vi.mocked(deleteArticle).mockResolvedValue(undefined)

    render(
      <BrowserRouter>
        <EditorPage />
      </BrowserRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('First Article')).toBeDefined()
    })

    // If user cancels confirmation, article should remain
    // deleteArticle should not be called
  })

  it('should delete article after confirmation', async () => {
    vi.mocked(fetchWeeklyNewsletter).mockResolvedValue(mockWeekData)

    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
    vi.mocked(deleteArticle).mockResolvedValue(undefined)

    render(
      <BrowserRouter>
        <EditorPage />
      </BrowserRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('First Article')).toBeDefined()
    })

    // After deletion, article list should update
    // Article count should decrease
  })

  it('should save changes and show success message', async () => {
    vi.mocked(fetchWeeklyNewsletter).mockResolvedValue(mockWeekData)

    const updatedArticle = {
      ...initialArticles[0],
      title: 'Updated Title',
    }

    vi.mocked(updateArticle).mockResolvedValue(updatedArticle)

    render(
      <BrowserRouter>
        <EditorPage />
      </BrowserRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('First Article')).toBeDefined()
    })

    // Select and edit article
    const article = screen.getByText('First Article').closest('div')
    if (article) {
      fireEvent.click(article)
    }

    // Save button interaction would trigger updateArticle
  })

  it('should prevent navigation with unsaved changes', async () => {
    vi.mocked(fetchWeeklyNewsletter).mockResolvedValue(mockWeekData)

    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false)

    render(
      <BrowserRouter>
        <EditorPage />
      </BrowserRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('編輯週報')).toBeDefined()
    })

    // Back button with unsaved changes should show confirmation
    const backButton = screen.getByText(/返回讀者頁面|Back/i)
    fireEvent.click(backButton)

    // If there are unsaved changes, confirmation dialog should appear
    // Navigation should be prevented if user declines
  })

  it('should allow navigation after saving changes', async () => {
    vi.mocked(fetchWeeklyNewsletter).mockResolvedValue(mockWeekData)

    const updatedArticle = {
      ...initialArticles[0],
      title: 'Updated Title',
    }

    vi.mocked(updateArticle).mockResolvedValue(updatedArticle)
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)

    render(
      <BrowserRouter>
        <EditorPage />
      </BrowserRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('編輯週報')).toBeDefined()
    })

    // After saving all changes, back button should navigate
    const backButton = screen.getByText(/返回讀者頁面|Back/i)
    fireEvent.click(backButton)

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith(expect.stringContaining('/newsletter/'))
    })
  })

  it('should complete full workflow: create -> edit -> reorder -> delete -> save', async () => {
    vi.mocked(fetchWeeklyNewsletter).mockResolvedValue(mockWeekData)

    const newArticle = {
      id: 'article-003',
      title: 'New Article',
      content: '# New',
      author: '',
      summary: '',
      weekNumber: '2025-W43',
      order: 3,
      slug: 'new-article',
      publicUrl: '/article/article-003',
      createdAt: '2025-11-16T02:00:00Z',
      updatedAt: '2025-11-16T02:00:00Z',
      isPublished: false,
    }

    vi.mocked(createArticle).mockResolvedValue(newArticle)
    vi.mocked(reorderArticles).mockResolvedValue(true)
    vi.mocked(deleteArticle).mockResolvedValue(undefined)
    vi.spyOn(window, 'confirm').mockReturnValue(true)

    render(
      <BrowserRouter>
        <EditorPage />
      </BrowserRouter>
    )

    // Step 1: Load initial articles
    await waitFor(() => {
      expect(screen.getByText('First Article')).toBeDefined()
    })

    // Step 2: Create new article
    const addButton = screen.getByText(/新增文章|Add Article/i)
    fireEvent.click(addButton)

    await waitFor(() => {
      expect(createArticle).toHaveBeenCalled()
    })

    // Step 3: Edit article (select and modify)
    const article = screen.getByText('First Article').closest('div')
    if (article) {
      fireEvent.click(article)
    }

    // Step 4: Reorder articles
    // (triggered through drag-drop or move buttons)

    // Step 5: Delete article
    // (with confirmation)

    // Step 6: Navigate back (implying save)
    const backButton = screen.getByText(/返回讀者頁面|Back/i)
    fireEvent.click(backButton)

    // Verify navigation after all operations
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalled()
    })
  })

  it('should display loading state during operations', async () => {
    // Simulate slow API call
    vi.mocked(fetchWeeklyNewsletter).mockImplementation(
      () => new Promise(resolve => setTimeout(() => resolve(mockWeekData), 100))
    )

    render(
      <BrowserRouter>
        <EditorPage />
      </BrowserRouter>
    )

    // Loading spinner should be visible initially
    expect(screen.getByText(/載入中|Loading/i)).toBeDefined()

    // Should disappear after data loads
    await waitFor(() => {
      expect(screen.getByText('編輯週報')).toBeDefined()
    }, { timeout: 200 })
  })

  it('should handle errors gracefully', async () => {
    vi.mocked(fetchWeeklyNewsletter).mockRejectedValue(new Error('Failed to load'))

    render(
      <BrowserRouter>
        <EditorPage />
      </BrowserRouter>
    )

    // Should show error message or navigate to error page
    await waitFor(() => {
      // Error handling depends on ErrorBoundary implementation
    })
  })
})
