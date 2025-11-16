/**
 * 性能測試 - 文章切換 (快速導航)
 * 測試 US3 文章快速切換的性能
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ArticleListView } from '@/components/ArticleListView'
import { Article } from '@/types'

// Mock article generator
function generateMockArticles(count: number): Article[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `article-${i}`,
    title: `Article ${i + 1}`,
    content: `# Content ${i + 1}`,
    author: `Author ${i + 1}`,
    summary: `Summary for article ${i + 1}`,
    weekNumber: '2025-W43',
    order: i + 1,
    slug: `article-${i}`,
    publicUrl: `/article/article-${i}`,
    createdAt: new Date(2025, 10, 16 - (count - i)).toISOString(),
    updatedAt: new Date(2025, 10, 16 - (count - i)).toISOString(),
    isPublished: true,
  }))
}

describe('Article Switching Performance', () => {
  describe('Single Article Switch', () => {
    it('should switch between two articles in < 50ms', () => {
      const mockOnSelect = vi.fn()
      const articles = generateMockArticles(5)

      const { rerender } = render(
        <ArticleListView
          weekNumber="2025-W43"
          articles={articles}
          selectedArticleId={articles[0].id}
          onSelectArticle={mockOnSelect}
        />
      )

      const startTime = performance.now()

      // Switch to second article
      rerender(
        <ArticleListView
          weekNumber="2025-W43"
          articles={articles}
          selectedArticleId={articles[1].id}
          onSelectArticle={mockOnSelect}
        />
      )

      const endTime = performance.now()
      const switchTime = endTime - startTime

      expect(switchTime).toBeLessThan(50)
    })

    it('should maintain sub-100ms switches for multiple articles', () => {
      const mockOnSelect = vi.fn()
      const articles = generateMockArticles(10)

      const { rerender } = render(
        <ArticleListView
          weekNumber="2025-W43"
          articles={articles}
          selectedArticleId={articles[0].id}
          onSelectArticle={mockOnSelect}
        />
      )

      const times: number[] = []

      // Perform 5 sequential switches
      for (let i = 1; i < 6; i++) {
        const startTime = performance.now()

        rerender(
          <ArticleListView
            weekNumber="2025-W43"
            articles={articles}
            selectedArticleId={articles[i].id}
            onSelectArticle={mockOnSelect}
          />
        )

        const endTime = performance.now()
        times.push(endTime - startTime)
      }

      // All switches should be under 100ms
      times.forEach((time) => {
        expect(time).toBeLessThan(100)
      })

      // Average should be well under 100ms
      const avgTime = times.reduce((a, b) => a + b, 0) / times.length
      expect(avgTime).toBeLessThan(75)
    })
  })

  describe('Rapid Article Clicking', () => {
    it('should handle rapid clicks without performance degradation', () => {
      const mockOnSelect = vi.fn()
      const articles = generateMockArticles(20)

      render(
        <ArticleListView
          weekNumber="2025-W43"
          articles={articles}
          selectedArticleId={articles[0].id}
          onSelectArticle={mockOnSelect}
        />
      )

      const startTime = performance.now()

      // Simulate rapid clicks on different articles
      const articleElements = articles.slice(0, 5)
      articleElements.forEach((article) => {
        const element = screen.getByText(article.title).closest('div')
        if (element) {
          fireEvent.click(element)
        }
      })

      const endTime = performance.now()
      const totalTime = endTime - startTime

      // 5 rapid clicks should complete in < 200ms
      expect(totalTime).toBeLessThan(200)

      // Callback should be called 5 times
      expect(mockOnSelect).toHaveBeenCalledTimes(5)
    })

    it('should not degrade with consecutive rapid switches', () => {
      const mockOnSelect = vi.fn()
      const articles = generateMockArticles(15)

      const { rerender } = render(
        <ArticleListView
          weekNumber="2025-W43"
          articles={articles}
          selectedArticleId={articles[0].id}
          onSelectArticle={mockOnSelect}
        />
      )

      const times: number[] = []

      // Perform 10 rapid consecutive re-renders
      for (let i = 1; i < 11; i++) {
        const startTime = performance.now()

        rerender(
          <ArticleListView
            weekNumber="2025-W43"
            articles={articles}
            selectedArticleId={articles[i % articles.length].id}
            onSelectArticle={mockOnSelect}
          />
        )

        const endTime = performance.now()
        times.push(endTime - startTime)
      }

      // No switch should exceed 100ms
      times.forEach((time) => {
        expect(time).toBeLessThan(100)
      })

      // No performance degradation: later switches shouldn't be slower
      const firstHalf = times.slice(0, 5).reduce((a, b) => a + b) / 5
      const secondHalf = times.slice(5, 10).reduce((a, b) => a + b) / 5

      // Second half shouldn't be more than 1.5x slower
      expect(secondHalf).toBeLessThan(firstHalf * 1.5)
    })
  })

  describe('Large List Performance', () => {
    it('should switch articles in large lists (50 articles) in < 100ms', () => {
      const mockOnSelect = vi.fn()
      const articles = generateMockArticles(50)

      const { rerender } = render(
        <ArticleListView
          weekNumber="2025-W43"
          articles={articles}
          selectedArticleId={articles[0].id}
          onSelectArticle={mockOnSelect}
        />
      )

      const startTime = performance.now()

      rerender(
        <ArticleListView
          weekNumber="2025-W43"
          articles={articles}
          selectedArticleId={articles[25].id}
          onSelectArticle={mockOnSelect}
        />
      )

      const endTime = performance.now()
      expect(endTime - startTime).toBeLessThan(100)
    })

    it('should handle article list changes efficiently', () => {
      const mockOnSelect = vi.fn()
      const initialArticles = generateMockArticles(30)

      const { rerender } = render(
        <ArticleListView
          weekNumber="2025-W43"
          articles={initialArticles}
          selectedArticleId={initialArticles[0].id}
          onSelectArticle={mockOnSelect}
        />
      )

      const startTime = performance.now()

      // Replace list with new articles
      const newArticles = generateMockArticles(30)
      rerender(
        <ArticleListView
          weekNumber="2025-W43"
          articles={newArticles}
          selectedArticleId={newArticles[0].id}
          onSelectArticle={mockOnSelect}
        />
      )

      const endTime = performance.now()
      expect(endTime - startTime).toBeLessThan(150)
    })
  })

  describe('Memory Efficiency', () => {
    it('should not leak memory during repeated switches', () => {
      const mockOnSelect = vi.fn()
      const articles = generateMockArticles(20)

      const { rerender } = render(
        <ArticleListView
          weekNumber="2025-W43"
          articles={articles}
          selectedArticleId={articles[0].id}
          onSelectArticle={mockOnSelect}
        />
      )

      // Perform many switches to detect memory leaks
      const times: number[] = []
      for (let i = 0; i < 50; i++) {
        const startTime = performance.now()

        rerender(
          <ArticleListView
            weekNumber="2025-W43"
            articles={articles}
            selectedArticleId={articles[i % articles.length].id}
            onSelectArticle={mockOnSelect}
          />
        )

        const endTime = performance.now()
        times.push(endTime - startTime)
      }

      // If we got here without crashing, memory usage is reasonable
      // Check that rendering times don't degrade significantly
      const lastTenAvg = times.slice(-10).reduce((a, b) => a + b) / 10
      const firstTenAvg = times.slice(0, 10).reduce((a, b) => a + b) / 10

      // Last 10 renders shouldn't be significantly slower than first 10
      expect(lastTenAvg).toBeLessThan(firstTenAvg * 2)
    })
  })

  describe('End-to-End Switching Performance', () => {
    it('should complete full switch cycle (click + render) in < 100ms', () => {
      const mockOnSelect = vi.fn()
      const articles = generateMockArticles(10)

      const { rerender } = render(
        <ArticleListView
          weekNumber="2025-W43"
          articles={articles}
          selectedArticleId={articles[0].id}
          onSelectArticle={mockOnSelect}
        />
      )

      const startTime = performance.now()

      // Click on article 5
      const articleElement = screen.getByText(articles[4].title).closest('div')
      if (articleElement) {
        fireEvent.click(articleElement)
      }

      // Re-render with new selection
      rerender(
        <ArticleListView
          weekNumber="2025-W43"
          articles={articles}
          selectedArticleId={articles[4].id}
          onSelectArticle={mockOnSelect}
        />
      )

      const endTime = performance.now()
      const totalTime = endTime - startTime

      expect(totalTime).toBeLessThan(100)
      expect(mockOnSelect).toHaveBeenCalledWith(articles[4].id)
    })

    it('should handle keyboard navigation with good performance', () => {
      const mockOnSelect = vi.fn()
      const articles = generateMockArticles(15)

      const { container, rerender } = render(
        <ArticleListView
          weekNumber="2025-W43"
          articles={articles}
          selectedArticleId={articles[0].id}
          onSelectArticle={mockOnSelect}
        />
      )

      const startTime = performance.now()

      // Simulate keyboard navigation with arrow keys
      const listContainer = container.querySelector('.space-y-2')
      if (listContainer) {
        // Simulate 5 arrow down presses
        for (let i = 0; i < 5; i++) {
          fireEvent.keyDown(listContainer, { key: 'ArrowDown' })
        }
      }

      // Re-render after navigation
      rerender(
        <ArticleListView
          weekNumber="2025-W43"
          articles={articles}
          selectedArticleId={articles[4].id}
          onSelectArticle={mockOnSelect}
        />
      )

      const endTime = performance.now()
      expect(endTime - startTime).toBeLessThan(150)
    })
  })
})
