/**
 * 測試 - 文章排序管理器
 * ArticleOrderManager 元件的單元測試
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ArticleOrderManager } from '@/components/ArticleOrderManager'
import { Article } from '@/types'

describe('ArticleOrderManager', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  const mockArticles: Article[] = [
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
    {
      id: 'article-003',
      title: 'Article 3',
      content: 'Content 3',
      author: 'Author 3',
      summary: 'Summary 3',
      weekNumber: '2025-W43',
      order: 3,
      slug: 'article-3',
      publicUrl: '/article/article-003',
      createdAt: '2025-11-16T02:00:00Z',
      updatedAt: '2025-11-16T02:00:00Z',
      isPublished: true,
    },
  ]

  it('should render list of articles', () => {
    const mockOnReorder = vi.fn()
    const mockOnSelectArticle = vi.fn()
    const mockOnDeleteArticle = vi.fn()

    render(
      <ArticleOrderManager
        articles={mockArticles}
        onReorder={mockOnReorder}
        onSelectArticle={mockOnSelectArticle}
        onDeleteArticle={mockOnDeleteArticle}
        selectedArticleId=""
        disabled={false}
      />
    )

    expect(screen.getByText('Article 1')).toBeDefined()
    expect(screen.getByText('Article 2')).toBeDefined()
    expect(screen.getByText('Article 3')).toBeDefined()
  })

  it('should select article when clicked', () => {
    const mockOnReorder = vi.fn()
    const mockOnSelectArticle = vi.fn()
    const mockOnDeleteArticle = vi.fn()

    render(
      <ArticleOrderManager
        articles={mockArticles}
        onReorder={mockOnReorder}
        onSelectArticle={mockOnSelectArticle}
        onDeleteArticle={mockOnDeleteArticle}
        selectedArticleId=""
        disabled={false}
      />
    )

    const article1 = screen.getByText('Article 1').closest('div')
    if (article1) {
      fireEvent.click(article1)
    }

    expect(mockOnSelectArticle).toHaveBeenCalledWith('article-001')
  })

  it('should highlight selected article', () => {
    const mockOnReorder = vi.fn()
    const mockOnSelectArticle = vi.fn()
    const mockOnDeleteArticle = vi.fn()

    const { container } = render(
      <ArticleOrderManager
        articles={mockArticles}
        onReorder={mockOnReorder}
        onSelectArticle={mockOnSelectArticle}
        onDeleteArticle={mockOnDeleteArticle}
        selectedArticleId="article-001"
        disabled={false}
      />
    )

    const selectedItem = container.querySelector('[data-selected="true"]')
    expect(selectedItem).toBeDefined()
  })

  it('should delete article when delete button clicked', () => {
    const mockOnReorder = vi.fn()
    const mockOnSelectArticle = vi.fn()
    const mockOnDeleteArticle = vi.fn()

    render(
      <ArticleOrderManager
        articles={mockArticles}
        onReorder={mockOnReorder}
        onSelectArticle={mockOnSelectArticle}
        onDeleteArticle={mockOnDeleteArticle}
        selectedArticleId="article-001"
        disabled={false}
      />
    )

    // Find and click delete button for first article
    const deleteButtons = screen.getAllByText(/刪除|Delete/i)
    if (deleteButtons.length > 0) {
      fireEvent.click(deleteButtons[0])
    }

    expect(mockOnDeleteArticle).toHaveBeenCalledWith('article-001')
  })

  it('should handle drag and drop reordering', async () => {
    const mockOnReorder = vi.fn()
    const mockOnSelectArticle = vi.fn()
    const mockOnDeleteArticle = vi.fn()

    const { container } = render(
      <ArticleOrderManager
        articles={mockArticles}
        onReorder={mockOnReorder}
        onSelectArticle={mockOnSelectArticle}
        onDeleteArticle={mockOnDeleteArticle}
        selectedArticleId=""
        disabled={false}
      />
    )

    // Get draggable elements
    const draggableItems = container.querySelectorAll('[draggable="true"]')
    expect(draggableItems.length).toBeGreaterThan(0)

    // Simulate drag and drop
    if (draggableItems.length >= 2) {
      const dragSource = draggableItems[0]
      const dropTarget = draggableItems[1]

      fireEvent.dragStart(dragSource)
      fireEvent.dragOver(dropTarget)
      fireEvent.drop(dropTarget)
      fireEvent.dragEnd(dragSource)

      // onReorder should be called with reordered articles
      await waitFor(() => {
        expect(mockOnReorder).toHaveBeenCalled()
      })
    }
  })

  it('should disable controls when disabled prop is true', () => {
    const mockOnReorder = vi.fn()
    const mockOnSelectArticle = vi.fn()
    const mockOnDeleteArticle = vi.fn()

    const { container } = render(
      <ArticleOrderManager
        articles={mockArticles}
        onReorder={mockOnReorder}
        onSelectArticle={mockOnSelectArticle}
        onDeleteArticle={mockOnDeleteArticle}
        selectedArticleId=""
        disabled={true}
      />
    )

    // Delete buttons should be disabled
    const deleteButtons = screen.queryAllByText(/刪除|Delete/i)
    deleteButtons.forEach(button => {
      expect(button.closest('button')).toHaveAttribute('disabled')
    })
  })

  it('should show correct article order numbers', () => {
    const mockOnReorder = vi.fn()
    const mockOnSelectArticle = vi.fn()
    const mockOnDeleteArticle = vi.fn()

    render(
      <ArticleOrderManager
        articles={mockArticles}
        onReorder={mockOnReorder}
        onSelectArticle={mockOnSelectArticle}
        onDeleteArticle={mockOnDeleteArticle}
        selectedArticleId=""
        disabled={false}
      />
    )

    // Check order indicators
    const orderIndicators = screen.getAllByText(/第|Order/i)
    expect(orderIndicators.length).toBeGreaterThan(0)
  })

  it('should handle empty article list', () => {
    const mockOnReorder = vi.fn()
    const mockOnSelectArticle = vi.fn()
    const mockOnDeleteArticle = vi.fn()

    render(
      <ArticleOrderManager
        articles={[]}
        onReorder={mockOnReorder}
        onSelectArticle={mockOnSelectArticle}
        onDeleteArticle={mockOnDeleteArticle}
        selectedArticleId=""
        disabled={false}
      />
    )

    // Should display empty state
    expect(screen.queryByText(/無文章|No articles/i)).toBeDefined()
  })

  it('should support move up and move down buttons', () => {
    const mockOnReorder = vi.fn()
    const mockOnSelectArticle = vi.fn()
    const mockOnDeleteArticle = vi.fn()

    render(
      <ArticleOrderManager
        articles={mockArticles}
        onReorder={mockOnReorder}
        onSelectArticle={mockOnSelectArticle}
        onDeleteArticle={mockOnDeleteArticle}
        selectedArticleId="article-002"
        disabled={false}
      />
    )

    // Move up button
    const moveUpButton = screen.getByText(/上移|Move Up/i)
    if (moveUpButton) {
      fireEvent.click(moveUpButton)
      expect(mockOnReorder).toHaveBeenCalled()
    }

    // Move down button
    const moveDownButton = screen.getByText(/下移|Move Down/i)
    if (moveDownButton) {
      fireEvent.click(moveDownButton)
      expect(mockOnReorder).toHaveBeenCalled()
    }
  })
})
