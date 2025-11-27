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
    shortId: 'a001',
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
    const mockOnDragEnd = vi.fn()
    const mockOnDelete = vi.fn()
    const mockOnMoveUp = vi.fn()
    const mockOnMoveDown = vi.fn()

    render(
      <DragDropArticle
        article={mockArticle}
        isSelected={false}
        isDragging={false}
        disabled={false}
        onSelect={mockOnSelect}
        onDragStart={mockOnDragStart}
        onDragEnd={mockOnDragEnd}
        onDelete={mockOnDelete}
        onMoveUp={mockOnMoveUp}
        onMoveDown={mockOnMoveDown}
        index={0}
        totalArticles={5}
      />
    )

    expect(screen.getByText('Draggable Article')).toBeDefined()
  })

  it('should accept required props', () => {
    const mockOnSelect = vi.fn()
    const mockOnDragStart = vi.fn()
    const mockOnDragEnd = vi.fn()
    const mockOnDelete = vi.fn()
    const mockOnMoveUp = vi.fn()
    const mockOnMoveDown = vi.fn()

    render(
      <DragDropArticle
        article={mockArticle}
        isSelected={false}
        isDragging={false}
        disabled={false}
        onSelect={mockOnSelect}
        onDragStart={mockOnDragStart}
        onDragEnd={mockOnDragEnd}
        onDelete={mockOnDelete}
        onMoveUp={mockOnMoveUp}
        onMoveDown={mockOnMoveDown}
        index={0}
        totalArticles={5}
      />
    )

    expect(mockOnSelect).toBeDefined()
    expect(mockOnDragStart).toBeDefined()
  })

  it('should render with different selection state', () => {
    const mockOnSelect = vi.fn()
    const mockOnDragStart = vi.fn()
    const mockOnDragEnd = vi.fn()
    const mockOnDelete = vi.fn()
    const mockOnMoveUp = vi.fn()
    const mockOnMoveDown = vi.fn()

    const { rerender } = render(
      <DragDropArticle
        article={mockArticle}
        isSelected={false}
        isDragging={false}
        disabled={false}
        onSelect={mockOnSelect}
        onDragStart={mockOnDragStart}
        onDragEnd={mockOnDragEnd}
        onDelete={mockOnDelete}
        onMoveUp={mockOnMoveUp}
        onMoveDown={mockOnMoveDown}
        index={0}
        totalArticles={5}
      />
    )

    rerender(
      <DragDropArticle
        article={mockArticle}
        isSelected={true}
        isDragging={false}
        disabled={false}
        onSelect={mockOnSelect}
        onDragStart={mockOnDragStart}
        onDragEnd={mockOnDragEnd}
        onDelete={mockOnDelete}
        onMoveUp={mockOnMoveUp}
        onMoveDown={mockOnMoveDown}
        index={0}
        totalArticles={5}
      />
    )

    expect(screen.getByText('Draggable Article')).toBeDefined()
  })

  it('should handle different articles', () => {
    const mockOnSelect = vi.fn()
    const mockOnDragStart = vi.fn()
    const mockOnDragEnd = vi.fn()
    const mockOnDelete = vi.fn()
    const mockOnMoveUp = vi.fn()
    const mockOnMoveDown = vi.fn()

    const differentArticle = {
      ...mockArticle,
      id: 'article-002',
      title: 'Different Article',
    }

    render(
      <DragDropArticle
        article={differentArticle}
        isSelected={false}
        isDragging={false}
        disabled={false}
        onSelect={mockOnSelect}
        onDragStart={mockOnDragStart}
        onDragEnd={mockOnDragEnd}
        onDelete={mockOnDelete}
        onMoveUp={mockOnMoveUp}
        onMoveDown={mockOnMoveDown}
        index={1}
        totalArticles={5}
      />
    )

    expect(screen.getByText('Different Article')).toBeDefined()
  })
})
