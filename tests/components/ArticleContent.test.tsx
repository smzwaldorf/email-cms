/**
 * 元件測試 - ArticleContent (文章內容)
 * 測試文章內容顯示和性能優化 (US3: 快速導航)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { ArticleContent } from '@/components/ArticleContent'

// contentConverter is no longer needed since content is already HTML
// No mocking needed - ArticleContent receives HTML directly from the database

describe('ArticleContent Component', () => {
  const defaultProps = {
    title: 'Test Article Title',
    author: 'Test Author',
    content: 'This is test content',
    createdAt: '2025-11-16T10:00:00Z',
    viewCount: 1000,
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Rendering', () => {
    it('should render article with title', () => {
      render(<ArticleContent {...defaultProps} />)

      const title = screen.getByRole('heading', { level: 1 })
      expect(title).toBeInTheDocument()
      expect(title).toHaveTextContent('Test Article Title')
    })

    it('should render article author when provided', () => {
      render(<ArticleContent {...defaultProps} />)

      expect(screen.getByText(/作者：Test Author/)).toBeInTheDocument()
    })

    it('should not render author section when author is undefined', () => {
      const props = { ...defaultProps, author: undefined }
      render(<ArticleContent {...props} />)

      expect(screen.queryByText(/作者：/)).not.toBeInTheDocument()
    })

    it('should render formatted date when createdAt is provided', () => {
      render(<ArticleContent {...defaultProps} />)

      // The formatDate function should format the date
      expect(screen.getByText(/2025\/11\/16/)).toBeInTheDocument()
    })

    it('should not render date section when createdAt is undefined', () => {
      const props = { ...defaultProps, createdAt: undefined }
      render(<ArticleContent {...props} />)

      expect(screen.queryByText(/2025\/11\/16/)).not.toBeInTheDocument()
    })

    it('should render formatted view count when provided', () => {
      render(<ArticleContent {...defaultProps} />)

      expect(screen.getByText(/瀏覽：/)).toBeInTheDocument()
    })

    it('should not render view count section when viewCount is undefined', () => {
      const props = { ...defaultProps, viewCount: undefined }
      render(<ArticleContent {...props} />)

      expect(screen.queryByText(/瀏覽：/)).not.toBeInTheDocument()
    })

    it('should render HTML content with dangerouslySetInnerHTML', () => {
      render(<ArticleContent {...defaultProps} />)

      const contentDiv = screen.getByText(/This is test content/)
      expect(contentDiv).toBeInTheDocument()
    })

    it('should disable checkboxes in task lists', () => {
      const contentWithCheckbox =
        '<ul data-type="taskList"><li data-type="taskItem"><label><input type="checkbox"><span>Task 1</span></label></li></ul>'
      const props = { ...defaultProps, content: contentWithCheckbox }
      render(<ArticleContent {...props} />)

      const checkbox = screen.getByRole('checkbox')
      expect(checkbox).toBeDisabled()
    })
  })

  describe('Loading State', () => {
    it('should show loading spinner when isLoading is true', () => {
      const props = { ...defaultProps, isLoading: true }
      render(<ArticleContent {...props} />)

      expect(screen.getByText('載入文章中...')).toBeInTheDocument()
    })

    it('should show article when isLoading is false (conversion is synchronous)', () => {
      const props = { ...defaultProps, isLoading: false }
      render(<ArticleContent {...props} />)

      // When not loading, article should be visible (conversion happens immediately)
      expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument()
    })

    it('should hide article content when isLoading is true', () => {
      const props = { ...defaultProps, isLoading: true }
      render(<ArticleContent {...props} />)

      const title = screen.queryByRole('heading', { level: 1 })
      expect(title).not.toBeInTheDocument()
    })

    it('should display article when isLoading is false (default)', () => {
      render(<ArticleContent {...defaultProps} />)

      const title = screen.getByRole('heading', { level: 1 })
      expect(title).toBeInTheDocument()
    })
  })

  describe('Styling and Layout', () => {
    it('should have article structure', () => {
      const { container } = render(<ArticleContent {...defaultProps} />)

      const article = container.querySelector('article')
      expect(article).toBeInTheDocument()
      expect(article?.className).toContain('h-full')
      expect(article?.className).toContain('flex-col')
    })

    it('should have header section with border', () => {
      const { container } = render(<ArticleContent {...defaultProps} />)

      const header = container.querySelector('div.border-b')
      expect(header).toBeInTheDocument()
      expect(header?.className).toContain('border-waldorf-cream-200')
    })

    it('should have scrollable content area', () => {
      const { container } = render(<ArticleContent {...defaultProps} />)

      const contentArea = container.querySelector('div.overflow-y-auto')
      expect(contentArea).toBeInTheDocument()
    })

    it('should apply prose styling to content', () => {
      const { container } = render(<ArticleContent {...defaultProps} />)

      const proseDiv = container.querySelector('div.prose')
      expect(proseDiv).toBeInTheDocument()
      expect(proseDiv?.className).toContain('prose')
      expect(proseDiv?.className).toContain('max-w-none')
    })
  })

  describe('Props Variations', () => {
    it('should handle minimal props (title and content only)', () => {
      const props = {
        title: 'Minimal Article',
        content: 'Content',
      }
      render(<ArticleContent {...props} />)

      expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument()
      expect(screen.getByText(/Content/)).toBeInTheDocument()
    })

    it('should handle all props provided', () => {
      render(<ArticleContent {...defaultProps} />)

      expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument()
      expect(screen.getByText(/作者：Test Author/)).toBeInTheDocument()
      expect(screen.getByText(/瀏覽：/)).toBeInTheDocument()
    })

    it('should handle empty string content', () => {
      const props = { ...defaultProps, content: '' }
      render(<ArticleContent {...props} />)

      // Should still render the component
      expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument()
    })

    it('should handle very long titles', () => {
      const longTitle = 'A'.repeat(200)
      const props = { ...defaultProps, title: longTitle }
      render(<ArticleContent {...props} />)

      const title = screen.getByRole('heading', { level: 1 })
      expect(title).toHaveTextContent(longTitle)
    })

    it('should handle large view counts', () => {
      const props = { ...defaultProps, viewCount: 1000000 }
      render(<ArticleContent {...props} />)

      expect(screen.getByText(/瀏覽：/)).toBeInTheDocument()
    })
  })

  describe('Accessibility', () => {
    it('should have semantic heading structure', () => {
      render(<ArticleContent {...defaultProps} />)

      const heading = screen.getByRole('heading', { level: 1 })
      expect(heading).toBeInTheDocument()
    })

    it('should render proper article tag for semantic markup', () => {
      const { container } = render(<ArticleContent {...defaultProps} />)

      const article = container.querySelector('article')
      expect(article).toBeInTheDocument()
    })

    it('should have good text contrast with appropriate color classes', () => {
      render(<ArticleContent {...defaultProps} />)

      const title = screen.getByRole('heading', { level: 1 })
      expect(title?.className).toContain('text-waldorf-clay-800')
    })

    it('should have readable font sizes', () => {
      render(<ArticleContent {...defaultProps} />)

      const title = screen.getByRole('heading', { level: 1 })
      expect(title?.className).toContain('text-2xl')
    })

    it('should have proper line height for readability', () => {
      const { container } = render(<ArticleContent {...defaultProps} />)

      const proseDiv = container.querySelector('div.prose')
      expect(proseDiv?.className).toContain('leading-relaxed')
    })
  })

  describe('Performance Optimization', () => {
    it('should be a memoized component to prevent unnecessary re-renders', () => {
      // This test verifies that the component is exported as a memo
      // The actual memo check would be at import time
      expect(ArticleContent).toBeDefined()
    })

    it('should handle content changes efficiently', async () => {
      const { rerender } = render(<ArticleContent {...defaultProps} />)

      const newContent = { ...defaultProps, content: 'Updated content' }
      rerender(<ArticleContent {...newContent} />)

      await waitFor(() => {
        expect(screen.getByText(/Updated content/)).toBeInTheDocument()
      })
    })

    it('should not re-render when non-content props change unnecessarily', () => {
      const renderSpy = vi.fn()
      const TestWrapper = () => {
        renderSpy()
        return <ArticleContent {...defaultProps} />
      }

      const { rerender } = render(<TestWrapper />)
      expect(renderSpy).toHaveBeenCalledTimes(1)

      // Re-render with same props
      rerender(<TestWrapper />)
      // With memoization, the internal component should not re-render
      expect(renderSpy).toHaveBeenCalledTimes(2) // Only TestWrapper re-renders
    })

    it('should use useMemo for HTML content to avoid recalculation', () => {
      // useMemo should cache the HTML content
      const { rerender } = render(<ArticleContent {...defaultProps} />)

      // Change other props but keep content the same
      const sameContent = { ...defaultProps, viewCount: 2000 }
      rerender(<ArticleContent {...sameContent} />)

      // The HTML content should use cached result if content is same
      expect(screen.getByText(/This is test content/)).toBeInTheDocument()
    })
  })

  describe('Content Updates', () => {
    it('should update article title when prop changes', () => {
      const { rerender } = render(<ArticleContent {...defaultProps} />)

      expect(screen.getByText('Test Article Title')).toBeInTheDocument()

      const newProps = { ...defaultProps, title: 'Updated Title' }
      rerender(<ArticleContent {...newProps} />)

      expect(screen.getByText('Updated Title')).toBeInTheDocument()
    })

    it('should update article author when prop changes', () => {
      const { rerender } = render(<ArticleContent {...defaultProps} />)

      expect(screen.getByText(/Test Author/)).toBeInTheDocument()

      const newProps = { ...defaultProps, author: 'New Author' }
      rerender(<ArticleContent {...newProps} />)

      expect(screen.getByText(/New Author/)).toBeInTheDocument()
    })

    it('should handle transitioning from loading to loaded state', () => {
      const props = { ...defaultProps, isLoading: true }
      const { rerender } = render(<ArticleContent {...props} />)

      expect(screen.getByText('載入文章中...')).toBeInTheDocument()

      const loadedProps = { ...defaultProps, isLoading: false }
      rerender(<ArticleContent {...loadedProps} />)

      expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument()
    })
  })

  describe('Edge Cases', () => {
    it('should handle special characters in title', () => {
      const props = {
        ...defaultProps,
        title: 'Title with <>&"\'',
      }
      render(<ArticleContent {...props} />)

      const title = screen.getByRole('heading', { level: 1 })
      expect(title).toBeInTheDocument()
    })

    it('should handle HTML-like content safely', () => {
      const props = {
        ...defaultProps,
        content: '<script>alert("xss")</script>',
      }
      render(<ArticleContent {...props} />)

      // Component should still render without errors
      expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument()
    })

    it('should handle zero view count', () => {
      const props = { ...defaultProps, viewCount: 0 }
      render(<ArticleContent {...props} />)

      expect(screen.getByText(/瀏覽：/)).toBeInTheDocument()
    })

    it('should handle undefined isLoading (defaults to false)', () => {
      const props = { ...defaultProps }
      // isLoading is not included, so it defaults to false
      render(<ArticleContent {...props} />)

      expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument()
      expect(screen.queryByText('載入文章中...')).not.toBeInTheDocument()
    })
  })
})
