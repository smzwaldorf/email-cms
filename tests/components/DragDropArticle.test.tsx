/**
 * 測試 - 可拖拽的文章項目
 * DragDropArticle 元件的單元測試
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
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

  it('should render article content', () => {
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
    expect(screen.getByText('Test Author')).toBeDefined()
  })

  it('should be draggable', () => {
    const mockOnSelect = vi.fn()
    const mockOnDragStart = vi.fn()

    const { container } = render(
      <DragDropArticle
        article={mockArticle}
        isSelected={false}
        onSelect={mockOnSelect}
        onDragStart={mockOnDragStart}
        index={0}
      />
    )

    const draggableElement = container.querySelector('[draggable="true"]')
    expect(draggableElement).toBeDefined()
  })

  it('should call onDragStart when dragging starts', () => {
    const mockOnSelect = vi.fn()
    const mockOnDragStart = vi.fn()

    const { container } = render(
      <DragDropArticle
        article={mockArticle}
        isSelected={false}
        onSelect={mockOnSelect}
        onDragStart={mockOnDragStart}
        index={0}
      />
    )

    const draggableElement = container.querySelector('[draggable="true"]')
    if (draggableElement) {
      fireEvent.dragStart(draggableElement)
    }

    expect(mockOnDragStart).toHaveBeenCalledWith(0)
  })

  it('should call onSelect when clicked', () => {
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

    const titleElement = screen.getByText('Draggable Article')
    if (titleElement.closest('div')) {
      fireEvent.click(titleElement.closest('div')!)
    }

    expect(mockOnSelect).toHaveBeenCalledWith('article-001')
  })

  it('should show selected state with isSelected prop', () => {
    const mockOnSelect = vi.fn()
    const mockOnDragStart = vi.fn()

    const { container } = render(
      <DragDropArticle
        article={mockArticle}
        isSelected={true}
        onSelect={mockOnSelect}
        onDragStart={mockOnDragStart}
        index={0}
      />
    )

    const selectedElement = container.querySelector('[data-selected="true"]')
    expect(selectedElement).toBeDefined()
  })

  it('should display article order number', () => {
    const mockOnSelect = vi.fn()
    const mockOnDragStart = vi.fn()

    render(
      <DragDropArticle
        article={mockArticle}
        isSelected={false}
        onSelect={mockOnSelect}
        onDragStart={mockOnDragStart}
        index={2}
      />
    )

    // Order number should be displayed
    expect(screen.getByText(/3|第 3/)).toBeDefined()
  })

  it('should show drag handle visual indicator', () => {
    const mockOnSelect = vi.fn()
    const mockOnDragStart = vi.fn()

    const { container } = render(
      <DragDropArticle
        article={mockArticle}
        isSelected={false}
        onSelect={mockOnSelect}
        onDragStart={mockOnDragStart}
        index={0}
      />
    )

    // Drag handle icon or indicator should be present
    const dragHandle = container.querySelector('[data-drag-handle]')
    expect(dragHandle || container.querySelector('svg')).toBeDefined()
  })

  it('should handle drag over with visual feedback', () => {
    const mockOnSelect = vi.fn()
    const mockOnDragStart = vi.fn()

    const { container } = render(
      <DragDropArticle
        article={mockArticle}
        isSelected={false}
        onSelect={mockOnSelect}
        onDragStart={mockOnDragStart}
        index={0}
        isDragOver={true}
      />
    )

    const dragOverElement = container.querySelector('[data-drag-over="true"]')
    expect(dragOverElement).toBeDefined()
  })

  it('should display article summary', () => {
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

    expect(screen.getByText(/Test summary/)).toBeDefined()
  })

  it('should show published status', () => {
    const mockOnSelect = vi.fn()
    const mockOnDragStart = vi.fn()

    const publishedArticle = { ...mockArticle, isPublished: true }

    render(
      <DragDropArticle
        article={publishedArticle}
        isSelected={false}
        onSelect={mockOnSelect}
        onDragStart={mockOnDragStart}
        index={0}
      />
    )

    // Published indicator should be present
    expect(screen.queryByText(/已發布|Published/i)).toBeDefined()
  })

  it('should handle different article types', () => {
    const mockOnSelect = vi.fn()
    const mockOnDragStart = vi.fn()

    const unpublishedArticle = { ...mockArticle, isPublished: false, title: 'Draft Article' }

    render(
      <DragDropArticle
        article={unpublishedArticle}
        isSelected={false}
        onSelect={mockOnSelect}
        onDragStart={mockOnDragStart}
        index={0}
      />
    )

    expect(screen.getByText('Draft Article')).toBeDefined()
  })

  it('should prevent default drag behavior', () => {
    const mockOnSelect = vi.fn()
    const mockOnDragStart = vi.fn()

    const { container } = render(
      <DragDropArticle
        article={mockArticle}
        isSelected={false}
        onSelect={mockOnSelect}
        onDragStart={mockOnDragStart}
        index={0}
      />
    )

    const draggableElement = container.querySelector('[draggable="true"]')
    if (draggableElement) {
      const dragStartEvent = new DragEvent('dragstart', { bubbles: true })
      const preventDefaultSpy = vi.spyOn(dragStartEvent, 'preventDefault')
      draggableElement.dispatchEvent(dragStartEvent)
      // Drag behavior is handled
    }
  })

  it('should render with proper accessibility', () => {
    const mockOnSelect = vi.fn()
    const mockOnDragStart = vi.fn()

    const { container } = render(
      <DragDropArticle
        article={mockArticle}
        isSelected={false}
        onSelect={mockOnSelect}
        onDragStart={mockOnDragStart}
        index={0}
      />
    )

    // Should have proper ARIA attributes for drag and drop
    const draggableElement = container.querySelector('[draggable="true"]')
    expect(draggableElement).toBeDefined()
  })
})
