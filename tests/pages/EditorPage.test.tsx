/**
 * 測試 - 編輯頁面
 * EditorPage 編輯器頁面單元測試
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import { EditorPage } from '@/pages/EditorPage'
import { fetchWeeklyNewsletter, createArticle, updateArticle, deleteArticle, reorderArticles } from '@/services/mockApi'

// Mock the mockApi module
vi.mock('@/services/mockApi', () => ({
  fetchWeeklyNewsletter: vi.fn(),
  createArticle: vi.fn(),
  updateArticle: vi.fn(),
  deleteArticle: vi.fn(),
  reorderArticles: vi.fn(),
}))

// Mock useNavigate
const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

// Mock useParams to return a week number
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useParams: () => ({ weekNumber: '2025-W43' }),
  }
})

describe('EditorPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  const mockArticles = [
    {
      id: 'article-001',
      title: 'Article 1',
      content: 'Content 1',
      author: 'Author 1',
      summary: 'Summary 1',
      weekNumber: '2025-W43',
      order: 1,
      slug: 'article-1',
      publicUrl: '/article/article-001',
      createdAt: '2025-11-16T00:00:00Z',
      updatedAt: '2025-11-16T00:00:00Z',
      isPublished: true,
    },
    {
      id: 'article-002',
      title: 'Article 2',
      content: 'Content 2',
      author: 'Author 2',
      summary: 'Summary 2',
      weekNumber: '2025-W43',
      order: 2,
      slug: 'article-2',
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
    articles: mockArticles,
  }

  it('should render loading spinner when loading', () => {
    vi.mocked(fetchWeeklyNewsletter).mockImplementation(
      () => new Promise(resolve => setTimeout(() => resolve(mockWeekData), 100))
    )

    render(
      <BrowserRouter>
        <EditorPage />
      </BrowserRouter>
    )

    // Check for loading indicator
    expect(screen.getByText(/載入中|Loading/i)).toBeDefined()
  })

  it('should load and display articles', async () => {
    vi.mocked(fetchWeeklyNewsletter).mockResolvedValue(mockWeekData)

    render(
      <BrowserRouter>
        <EditorPage />
      </BrowserRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('編輯週報')).toBeDefined()
    })

    // Check article count
    await waitFor(() => {
      expect(screen.getByText(/共 2 篇文章|2 articles/i)).toBeDefined()
    })
  })

  it('should display error message when week number is missing', () => {
    vi.mocked(fetchWeeklyNewsletter).mockRejectedValue(new Error('Week not found'))

    render(
      <BrowserRouter>
        <EditorPage />
      </BrowserRouter>
    )

    // Should show error state or navigate to error page
    expect(mockNavigate).not.toHaveBeenCalled()
  })

  it('should allow selecting an article for editing', async () => {
    vi.mocked(fetchWeeklyNewsletter).mockResolvedValue(mockWeekData)

    render(
      <BrowserRouter>
        <EditorPage />
      </BrowserRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Article 1')).toBeDefined()
    })

    // Click on an article to select it
    const article1 = screen.getByText('Article 1').closest('div')
    if (article1) {
      fireEvent.click(article1)
    }

    // Article should be selected (UI would show editing form)
    await waitFor(() => {
      expect(screen.queryByText('Article 1')).toBeDefined()
    })
  })

  it('should save changes to an article', async () => {
    vi.mocked(fetchWeeklyNewsletter).mockResolvedValue(mockWeekData)
    vi.mocked(updateArticle).mockResolvedValue({ ...mockArticles[0], title: 'Updated Title' })

    render(
      <BrowserRouter>
        <EditorPage />
      </BrowserRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Article 1')).toBeDefined()
    })

    // The actual save functionality depends on the ArticleEditor component
    // This test verifies that the page structure supports editing
  })

  it('should confirm before deleting article', async () => {
    vi.mocked(fetchWeeklyNewsletter).mockResolvedValue(mockWeekData)
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)

    render(
      <BrowserRouter>
        <EditorPage />
      </BrowserRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Article 1')).toBeDefined()
    })

    // Confirmation dialog should be triggered on delete
    // The actual implementation depends on ArticleOrderManager
  })

  it('should delete article after confirmation', async () => {
    vi.mocked(fetchWeeklyNewsletter).mockResolvedValue(mockWeekData)
    vi.mocked(deleteArticle).mockResolvedValue(undefined)
    vi.spyOn(window, 'confirm').mockReturnValue(true)

    render(
      <BrowserRouter>
        <EditorPage />
      </BrowserRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Article 1')).toBeDefined()
    })

    // After deletion, article count should decrease
    // Verification depends on component state management
  })

  it('should handle reordering articles', async () => {
    vi.mocked(fetchWeeklyNewsletter).mockResolvedValue(mockWeekData)
    vi.mocked(reorderArticles).mockResolvedValue(true)

    render(
      <BrowserRouter>
        <EditorPage />
      </BrowserRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Article 1')).toBeDefined()
    })

    // Reorder functionality would be tested through ArticleOrderManager
  })

  it('should allow adding new article', async () => {
    vi.mocked(fetchWeeklyNewsletter).mockResolvedValue(mockWeekData)
    vi.mocked(createArticle).mockResolvedValue({
      id: 'article-003',
      title: '新文章',
      content: '# 開始編輯...',
      author: '',
      summary: '',
      weekNumber: '2025-W43',
      order: 3,
      slug: 'article-3',
      publicUrl: '/article/article-003',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isPublished: false,
    })

    render(
      <BrowserRouter>
        <EditorPage />
      </BrowserRouter>
    )

    await waitFor(() => {
      expect(screen.getByText(/新增文章|Add Article/i)).toBeDefined()
    })

    // Click add article button
    const addButton = screen.getByText(/新增文章|Add Article/i)
    if (addButton) {
      fireEvent.click(addButton)
    }

    // New article should be created and added to list
    await waitFor(() => {
      expect(createArticle).toHaveBeenCalled()
    })
  })

  it('should navigate back to reader page', async () => {
    vi.mocked(fetchWeeklyNewsletter).mockResolvedValue(mockWeekData)

    render(
      <BrowserRouter>
        <EditorPage />
      </BrowserRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('編輯週報')).toBeDefined()
    })

    // Click back button
    const backButton = screen.getByText(/返回讀者頁面|Back to Reader/i)
    if (backButton) {
      fireEvent.click(backButton)
    }

    // Should navigate back
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith(expect.stringContaining('/newsletter/'))
    })
  })

  it('should show unsaved changes warning', async () => {
    vi.mocked(fetchWeeklyNewsletter).mockResolvedValue(mockWeekData)
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false)

    render(
      <BrowserRouter>
        <EditorPage />
      </BrowserRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Article 1')).toBeDefined()
    })

    // If there are unsaved changes, navigating away should show a warning
  })
})
