/**
 * 性能測試 - 文章切換 (T049)
 * 驗證文章快速切換符合 US3 的性能要求（< 1 秒）
 *
 * 測試場景:
 * - 單次文章切換性能
 * - 連續多次切換
 * - 邊界按鈕點擊性能
 * - 工具列按鈕性能
 * - 文章清單點擊性能
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import { ArticleListView } from '@/components/ArticleListView'
import { Article } from '@/types'

// Mock useFetchAllWeeks hook
vi.mock('@/hooks/useFetchAllWeeks', () => ({
  useFetchAllWeeks: vi.fn(() => ({
    weeks: [],
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  })),
}))

// Helper to render with Router context
const renderWithRouter = (component: React.ReactElement) => {
  return render(<BrowserRouter>{component}</BrowserRouter>)
}

// Mock data generator
function generateMockArticles(count: number): Article[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `article-${i}`,
    shortId: `a${String(i + 1).padStart(3, '0')}`,
    title: `Test Article ${i + 1}`,
    content: `# Article ${i + 1}\n\nThis is test content for article ${i + 1}.`,
    author: `Author ${i + 1}`,
    summary: `Summary for article ${i + 1}`,
    weekNumber: '2025-w43',
    order: i + 1,
    slug: `article-${i}`,
    publicUrl: `/newsletter/2025-w43/article/article-${i}`,
    createdAt: new Date(2025, 10, 16 - (count - i)).toISOString(),
    updatedAt: new Date(2025, 10, 16 - (count - i)).toISOString(),
    isPublished: true,
  }))
}

describe('Article Switching Performance (T049)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Single Article Switch Performance', () => {
    it('should switch between articles in < 100ms for optimal performance', () => {
      const articles = generateMockArticles(5)
      const mockOnSelect = vi.fn()

      // Initial render with first article
      const { rerender } = renderWithRouter(
        <ArticleListView
          weekNumber="2025-w43"
          articles={articles}
          selectedArticleId={articles[0].id}
          onSelectArticle={mockOnSelect}
        />
      )

      // Measure switch to second article
      const switchStartTime = performance.now()

      rerender(
        <BrowserRouter>
          <ArticleListView
          weekNumber="2025-w43"
          articles={articles}
          selectedArticleId={articles[1].id}
          onSelectArticle={mockOnSelect}
          />
        )
        </BrowserRouter>
      )

      const switchEndTime = performance.now()
      const switchTime = switchEndTime - switchStartTime

      // Must complete in < 100ms
      expect(switchTime).toBeLessThan(100)
    })

    it('should maintain sub-100ms performance for article switching', () => {
      const articles = generateMockArticles(10)
      const mockOnSelect = vi.fn()

      const { rerender } = renderWithRouter(
        <ArticleListView
          weekNumber="2025-w43"
          articles={articles}
          selectedArticleId={articles[0].id}
          onSelectArticle={mockOnSelect}
        />
      )

      const times: number[] = []

      // Perform 5 consecutive switches
      for (let i = 1; i < 6; i++) {
        const switchStart = performance.now()

        rerender(
          <BrowserRouter>
            <ArticleListView
            weekNumber="2025-w43"
            articles={articles}
            selectedArticleId={articles[i].id}
            onSelectArticle={mockOnSelect}
            />
          )
          </BrowserRouter>
        )

        const switchEnd = performance.now()
        times.push(switchEnd - switchStart)
      }

      // Each individual switch should be < 100ms
      times.forEach((time) => {
        expect(time).toBeLessThan(100)
      })

      // Average switch time should be < 75ms
      const avgTime = times.reduce((a, b) => a + b) / times.length
      expect(avgTime).toBeLessThan(75)
    })
  })

  describe('Multiple Consecutive Switches', () => {
    it('should switch between 5 articles in < 1 second total', () => {
      const articles = generateMockArticles(10)
      const mockOnSelect = vi.fn()

      const { rerender } = renderWithRouter(
        <ArticleListView
          weekNumber="2025-w43"
          articles={articles}
          selectedArticleId={articles[0].id}
          onSelectArticle={mockOnSelect}
        />
      )

      const startTime = performance.now()
      const switchTimes: number[] = []

      // Perform 5 consecutive switches
      for (let i = 1; i < 6; i++) {
        const switchStart = performance.now()

        rerender(
          <BrowserRouter>
            <ArticleListView
            weekNumber="2025-w43"
            articles={articles}
            selectedArticleId={articles[i].id}
            onSelectArticle={mockOnSelect}
            />
          )
          </BrowserRouter>
        )

        const switchEnd = performance.now()
        switchTimes.push(switchEnd - switchStart)
      }

      const endTime = performance.now()
      const totalTime = endTime - startTime

      // Total time for 5 switches should be < 1 second
      expect(totalTime).toBeLessThan(1000)

      // Each individual switch should be < 200ms
      switchTimes.forEach((time) => {
        expect(time).toBeLessThan(200)
      })

      // Average switch time should be < 150ms
      const avgTime = switchTimes.reduce((a, b) => a + b) / switchTimes.length
      expect(avgTime).toBeLessThan(150)
    })

    it('should not degrade with repeated switches (no memory leaks)', () => {
      const articles = generateMockArticles(15)
      const mockOnSelect = vi.fn()

      const { rerender } = renderWithRouter(
        <ArticleListView
          weekNumber="2025-w43"
          articles={articles}
          selectedArticleId={articles[0].id}
          onSelectArticle={mockOnSelect}
        />
      )

      const times: number[] = []

      // Perform 20 rapid switches
      for (let i = 0; i < 20; i++) {
        const startTime = performance.now()

        rerender(
          <BrowserRouter>
            <ArticleListView
            weekNumber="2025-w43"
            articles={articles}
            selectedArticleId={articles[i % articles.length].id}
            onSelectArticle={mockOnSelect}
            />
          )
          </BrowserRouter>
        )

        const endTime = performance.now()
        times.push(endTime - startTime)
      }

      // First half average
      const firstHalf = times.slice(0, 10).reduce((a, b) => a + b) / 10
      // Second half average
      const secondHalf = times.slice(10, 20).reduce((a, b) => a + b) / 10

      // Performance should not degrade significantly
      // Allow up to 3x difference due to environment variations (test environment has overhead)
      expect(secondHalf).toBeLessThan(firstHalf * 3)

      // All switches should stay under 300ms
      times.forEach((time) => {
        expect(time).toBeLessThan(300)
      })
    })
  })

  describe('Navigation Method Performance', () => {
    it('should handle rapid article selection clicks efficiently', () => {
      const articles = generateMockArticles(20)
      const mockOnSelect = vi.fn()

      renderWithRouter(
        <ArticleListView
          weekNumber="2025-w43"
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

      // 5 rapid clicks should complete in < 500ms
      expect(totalTime).toBeLessThan(500)

      // Callback should be called 5 times
      expect(mockOnSelect).toHaveBeenCalledTimes(5)
    })
  })

  describe('End-to-End Performance Under 1 Second', () => {
    it('should complete article switching (click + render) in < 1 second', () => {
      const articles = generateMockArticles(8)
      const mockOnSelect = vi.fn()

      const { rerender } = renderWithRouter(
        <ArticleListView
          weekNumber="2025-w43"
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

      // Update component
      rerender(
        <BrowserRouter>
          <ArticleListView
          weekNumber="2025-w43"
          articles={articles}
          selectedArticleId={articles[4].id}
          onSelectArticle={mockOnSelect}
          />
        )
        </BrowserRouter>
      )

      const endTime = performance.now()
      const totalTime = endTime - startTime

      // Complete cycle should be < 1 second
      expect(totalTime).toBeLessThan(1000)
      expect(mockOnSelect).toHaveBeenCalledWith(articles[4].id)
    })

    it('should handle back-and-forth navigation efficiently', () => {
      const articles = generateMockArticles(5)
      const mockOnSelect = vi.fn()

      const { rerender } = renderWithRouter(
        <ArticleListView
          weekNumber="2025-w43"
          articles={articles}
          selectedArticleId={articles[2].id}
          onSelectArticle={mockOnSelect}
        />
      )

      const startTime = performance.now()

      // Navigate to previous
      rerender(
        <BrowserRouter>
          <ArticleListView
          weekNumber="2025-w43"
          articles={articles}
          selectedArticleId={articles[1].id}
          onSelectArticle={mockOnSelect}
          />
        )
        </BrowserRouter>
      )

      // Navigate forward again
      rerender(
        <BrowserRouter>
          <ArticleListView
          weekNumber="2025-w43"
          articles={articles}
          selectedArticleId={articles[2].id}
          onSelectArticle={mockOnSelect}
          />
        )
        </BrowserRouter>
      )

      const endTime = performance.now()
      const totalTime = endTime - startTime

      // Back-and-forth navigation should be < 300ms
      expect(totalTime).toBeLessThan(300)
    })
  })

  describe('Performance with Large Article Lists', () => {
    it('should switch articles efficiently with 20 articles', () => {
      const articles = generateMockArticles(20)
      const mockOnSelect = vi.fn()

      const { rerender } = renderWithRouter(
        <ArticleListView
          weekNumber="2025-w43"
          articles={articles}
          selectedArticleId={articles[0].id}
          onSelectArticle={mockOnSelect}
        />
      )

      const startTime = performance.now()

      // Switch to middle article
      rerender(
        <BrowserRouter>
          <ArticleListView
          weekNumber="2025-w43"
          articles={articles}
          selectedArticleId={articles[10].id}
          onSelectArticle={mockOnSelect}
          />
        )
        </BrowserRouter>
      )

      const endTime = performance.now()

      // Should still be < 150ms
      expect(endTime - startTime).toBeLessThan(150)
    })

    it('should handle rapid switches through large list in < 1 second', () => {
      const articles = generateMockArticles(30)
      const mockOnSelect = vi.fn()

      const { rerender } = renderWithRouter(
        <ArticleListView
          weekNumber="2025-w43"
          articles={articles}
          selectedArticleId={articles[0].id}
          onSelectArticle={mockOnSelect}
        />
      )

      const startTime = performance.now()

      // Jump to multiple articles quickly
      const indices = [5, 10, 15, 20, 25]
      indices.forEach((index) => {
        rerender(
          <BrowserRouter>
            <ArticleListView
            weekNumber="2025-w43"
            articles={articles}
            selectedArticleId={articles[index].id}
            onSelectArticle={mockOnSelect}
            />
          )
          </BrowserRouter>
        )
      })

      const endTime = performance.now()

      // 5 switches should be < 1 second
      expect(endTime - startTime).toBeLessThan(1000)
    })
  })

  describe('Performance Metrics Verification', () => {
    it('should record and verify performance metrics for US3 requirement', () => {
      const articles = generateMockArticles(10)
      const mockOnSelect = vi.fn()
      const performanceMetrics: { [key: string]: number[] } = {
        singleSwitch: [],
        rapidSwitches: [],
        navigationClick: [],
      }

      const { rerender } = renderWithRouter(
        <ArticleListView
          weekNumber="2025-w43"
          articles={articles}
          selectedArticleId={articles[0].id}
          onSelectArticle={mockOnSelect}
        />
      )

      // Test 1: Single switch
      let startTime = performance.now()
      rerender(
        <BrowserRouter>
          <ArticleListView
          weekNumber="2025-w43"
          articles={articles}
          selectedArticleId={articles[1].id}
          onSelectArticle={mockOnSelect}
          />
        )
        </BrowserRouter>
      )
      performanceMetrics.singleSwitch.push(performance.now() - startTime)

      // Test 2: Rapid switches (3 times)
      for (let i = 0; i < 3; i++) {
        startTime = performance.now()
        rerender(
          <BrowserRouter>
            <ArticleListView
            weekNumber="2025-w43"
            articles={articles}
            selectedArticleId={articles[(i + 2) % articles.length].id}
            onSelectArticle={mockOnSelect}
            />
          )
          </BrowserRouter>
        )
        performanceMetrics.rapidSwitches.push(performance.now() - startTime)
      }

      // Test 3: Navigation click
      const articleElement = screen.getByText(articles[3].title).closest('div')
      startTime = performance.now()
      if (articleElement) {
        fireEvent.click(articleElement)
      }
      performanceMetrics.navigationClick.push(performance.now() - startTime)

      // Verify US3 requirement: < 1 second for article switching
      const allMetrics = Object.values(performanceMetrics).flat()
      const avgTime = allMetrics.reduce((a, b) => a + b) / allMetrics.length
      const maxTime = Math.max(...allMetrics)

      // Average performance should be well under 1 second
      expect(avgTime).toBeLessThan(500)
      // Max should be under 1 second
      expect(maxTime).toBeLessThan(1000)
    })
  })
})
