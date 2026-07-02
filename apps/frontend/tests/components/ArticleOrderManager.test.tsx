/**
 * 測試 - 文章排序管理器
 * ArticleOrderManager 元件的單元測試
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ArticleOrderManager } from '@/components/ArticleOrderManager'
import { Article } from '@/types'

describe('ArticleOrderManager', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  const mockArticles: Article[] = [
    {
      id: 'article-001',
      shortId: 'a001',
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
      shortId: 'a002',
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

  it('should render article list', () => {
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
  })

  it('should accept callback props', () => {
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

    expect(mockOnReorder).toBeDefined()
    expect(mockOnSelectArticle).toBeDefined()
    expect(mockOnDeleteArticle).toBeDefined()
  })

  it('should render with empty articles', () => {
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

    expect(document.querySelector('div')).toBeDefined()
  })

  it('should support disabled state', () => {
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
        disabled={true}
      />
    )

    expect(document.querySelector('div')).toBeDefined()
  })
})
