/**
 * 測試 - 文章卡片組件
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ArticleCard } from '@/components/ArticleCard'
import { Article } from '@/types'

describe('ArticleCard', () => {
  const mockArticle: Article = {
    id: 'article-001',
    title: '測試文章標題',
    content: '測試內容',
    author: '作者名稱',
    summary: '文章摘要',
    weekNumber: '2025-W43',
    order: 1,
    slug: 'test-article',
    publicUrl: '/article/article-001',
    createdAt: '2025-10-20T10:00:00Z',
    updatedAt: '2025-10-20T10:00:00Z',
    isPublished: true,
  }

  it('should render article title', () => {
    const handleClick = vi.fn()
    render(
      <ArticleCard
        article={mockArticle}
        isSelected={false}
        onClick={handleClick}
      />
    )

    expect(screen.getByText('測試文章標題')).toBeInTheDocument()
  })

  it('should display author name', () => {
    const handleClick = vi.fn()
    render(
      <ArticleCard
        article={mockArticle}
        isSelected={false}
        onClick={handleClick}
      />
    )

    expect(screen.getByText(/作者名稱/)).toBeInTheDocument()
  })

  it('should display article order', () => {
    const handleClick = vi.fn()
    render(
      <ArticleCard
        article={mockArticle}
        isSelected={false}
        onClick={handleClick}
      />
    )

    expect(screen.getByText(/順序 #1/)).toBeInTheDocument()
  })

  it('should call onClick when clicked', async () => {
    const handleClick = vi.fn()
    const user = userEvent.setup()
    render(
      <ArticleCard
        article={mockArticle}
        isSelected={false}
        onClick={handleClick}
      />
    )

    await user.click(screen.getByText('測試文章標題'))
    expect(handleClick).toHaveBeenCalledOnce()
  })

  it('should have selected style when isSelected is true', () => {
    const handleClick = vi.fn()
    const { container } = render(
      <ArticleCard
        article={mockArticle}
        isSelected={true}
        onClick={handleClick}
      />
    )

    const card = container.firstChild
    expect(card).toHaveClass('bg-blue-50')
  })

  it('should have default style when isSelected is false', () => {
    const handleClick = vi.fn()
    const { container } = render(
      <ArticleCard
        article={mockArticle}
        isSelected={false}
        onClick={handleClick}
      />
    )

    const card = container.firstChild
    expect(card).toHaveClass('bg-white')
  })
})
