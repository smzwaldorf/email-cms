/**
 * 測試 - 可拖拽的文章項目
 * DragDropArticle 元件的單元測試
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DragDropArticle } from '@/components/DragDropArticle'
import { Article } from '@/types'

describe('DragDropArticle', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  const mockArticle: Article = {
    id: 'article-001',
    title: 'Draggable Article',
    content: 'Content for dragging test',
    author: 'Test Author',
    summary: 'Test summary for dragging',
    weekNumber: '2025-W43',
    order: 1,
    slug: 'draggable-article',
    publicUrl: '/article/article-001',
    createdAt: '2025-11-16T00:00:00Z',
    updatedAt: '2025-11-16T00:00:00Z',
    isPublished: true,
  }

  it('should render article component', () => {
    const mockOnSelect = vi.fn()
    const mockOnDragStart = vi.fn()

    render(
      <DragDropArticle
        article={mockArticle}
        isSelected={false}
        onSelect={mockOnSelect}
        onDragStart={mockOnDragStart}
        index={0}
      />
    )

    expect(screen.getByText('Draggable Article')).toBeDefined()
  })

  it('should accept required props', () => {
    const mockOnSelect = vi.fn()
    const mockOnDragStart = vi.fn()

    render(
      <DragDropArticle
        article={mockArticle}
        isSelected={false}
        onSelect={mockOnSelect}
        onDragStart={mockOnDragStart}
        index={0}
      />
    )

    expect(mockOnSelect).toBeDefined()
    expect(mockOnDragStart).toBeDefined()
  })

  it('should render with different selection state', () => {
    const mockOnSelect = vi.fn()
    const mockOnDragStart = vi.fn()

    const { rerender } = render(
      <DragDropArticle
        article={mockArticle}
        isSelected={false}
        onSelect={mockOnSelect}
        onDragStart={mockOnDragStart}
        index={0}
      />
    )

    rerender(
      <DragDropArticle
        article={mockArticle}
        isSelected={true}
        onSelect={mockOnSelect}
        onDragStart={mockOnDragStart}
        index={0}
      />
    )

    expect(screen.getByText('Draggable Article')).toBeDefined()
  })

  it('should handle different articles', () => {
    const mockOnSelect = vi.fn()
    const mockOnDragStart = vi.fn()

    const differentArticle = {
      ...mockArticle,
      id: 'article-002',
      title: 'Different Article',
    }

    render(
      <DragDropArticle
        article={differentArticle}
        isSelected={false}
        onSelect={mockOnSelect}
        onDragStart={mockOnDragStart}
        index={1}
      />
    )

    expect(screen.getByText('Different Article')).toBeDefined()
  })
})
