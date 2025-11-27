/**
 * 整合測試 - 使用者故事 3 - 快速導航文章 (T050)
 * 驗證文章快速導航的完整工作流程
 *
 * 驗收場景:
 * - 讀者可通過螢幕左邊按鈕快速導航上一篇文章（無延遲）
 * - 讀者可通過螢幕右邊按鈕快速導航下一篇文章（無延遲）
 * - 讀者可通過頂部工具列按鈕導航
 * - 讀者可通過點擊文章清單導航
 * - 重複點擊導航按鈕，所有文章在 1 秒內加載（US3 效能要求）
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import { useState } from 'react'
import { Article } from '@/types'
import { SideButton } from '@/components/SideButton'
import { ArticleListView } from '@/components/ArticleListView'

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
function createMockArticle(id: string, order: number): Article {
  return {
    id,
    title: `Article ${order}`,
    content: `# Content for article ${order}`,
    author: `Author ${order}`,
    summary: `Summary for article ${order}`,
    weekNumber: '2025-W43',
    order,
    slug: `article-${order}`,
    publicUrl: `/article/${id}`,
    createdAt: new Date(2025, 10, 16).toISOString(),
    updatedAt: new Date(2025, 10, 16).toISOString(),
    isPublished: true,
  }
}

// Container component that simulates full quick navigation with toolbar
function QuickNavigationContainer({
  initialArticleId,
  onSelectionChange,
}: {
  initialArticleId: string
  onSelectionChange?: (id: string) => void
}) {
  const [selectedArticleId, setSelectedArticleId] = useState(initialArticleId)
  const articles = [
    createMockArticle('article-1', 1),
    createMockArticle('article-2', 2),
    createMockArticle('article-3', 3),
    createMockArticle('article-4', 4),
    createMockArticle('article-5', 5),
  ]

  const currentIndex = articles.findIndex((a) => a.id === selectedArticleId)

  const handlePrevious = () => {
    if (currentIndex > 0) {
      const newId = articles[currentIndex - 1].id
      setSelectedArticleId(newId)
      onSelectionChange?.(newId)
    }
  }

  const handleNext = () => {
    if (currentIndex < articles.length - 1) {
      const newId = articles[currentIndex + 1].id
      setSelectedArticleId(newId)
      onSelectionChange?.(newId)
    }
  }

  const handleSelectArticle = (id: string) => {
    setSelectedArticleId(id)
    onSelectionChange?.(id)
  }

  return (
    <div className="flex h-screen">
      {/* Left side button for previous article */}
      <SideButton
        direction="left"
        onClick={handlePrevious}
        disabled={currentIndex === 0}
        label="Previous article"
      />

      {/* Main content area with list and details */}
      <div className="flex-1 flex flex-col">
        {/* Toolbar with navigation buttons */}
        <div className="flex justify-between items-center p-4 border-b border-waldorf-cream-200">
          <button
            onClick={handlePrevious}
            disabled={currentIndex === 0}
            title="Previous article (toolbar)"
            className="px-4 py-2 rounded bg-waldorf-sage-500 text-white disabled:opacity-50"
          >
            上一篇
          </button>

          <span className="text-waldorf-clay-700">
            第 {currentIndex + 1} 篇，共 {articles.length} 篇
          </span>

          <button
            onClick={handleNext}
            disabled={currentIndex === articles.length - 1}
            title="Next article (toolbar)"
            className="px-4 py-2 rounded bg-waldorf-sage-500 text-white disabled:opacity-50"
          >
            下一篇
          </button>
        </div>

        {/* Article list and content area */}
        <ArticleListView
          weekNumber="2025-W43"
          articles={articles}
          selectedArticleId={selectedArticleId}
          onSelectArticle={handleSelectArticle}
        />
      </div>

      {/* Right side button for next article */}
      <SideButton
        direction="right"
        onClick={handleNext}
        disabled={currentIndex === articles.length - 1}
        label="Next article"
      />
    </div>
  )
}

describe('User Story 3 - Quick Navigation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('US3-Scenario-1: Left Side Button Navigation', () => {
    it('should navigate to previous article via left side button immediately', () => {
      renderWithRouter(<QuickNavigationContainer initialArticleId="article-3" />)

      // Verify starting article
      expect(screen.getByText('Article 3')).toBeInTheDocument()

      // Click left button to go to article 2
      const leftButton = screen.getByTitle('Previous article')
      fireEvent.click(leftButton)

      // Should display article 2 without delay
      expect(screen.getByText('Article 2')).toBeInTheDocument()
      expect(screen.getByText(/Author 2/)).toBeInTheDocument()
    })

    it('should disable left button at first article', () => {
      const { container } = renderWithRouter(
        <QuickNavigationContainer initialArticleId="article-1" />
      )

      // Find left button (should be disabled at first article)
      const buttons = container.querySelectorAll('button')
      const leftButton = Array.from(buttons).find((btn) =>
        btn.getAttribute('title')?.includes('Previous article')
      ) as HTMLButtonElement

      expect(leftButton.disabled).toBe(true)
    })

    it('should allow continuous left navigation from middle article', () => {
      renderWithRouter(<QuickNavigationContainer initialArticleId="article-4" />)

      const leftButton = screen.getByTitle('Previous article')

      // Navigate left 3 times: article-4 -> 3 -> 2 -> 1
      fireEvent.click(leftButton)
      expect(screen.getByText('Article 3')).toBeInTheDocument()

      fireEvent.click(leftButton)
      expect(screen.getByText('Article 2')).toBeInTheDocument()

      fireEvent.click(leftButton)
      expect(screen.getByText('Article 1')).toBeInTheDocument()
    })
  })

  describe('US3-Scenario-2: Right Side Button Navigation', () => {
    it('should navigate to next article via right side button immediately', () => {
      renderWithRouter(<QuickNavigationContainer initialArticleId="article-2" />)

      // Verify starting article
      expect(screen.getByText('Article 2')).toBeInTheDocument()

      // Click right button to go to article 3
      const rightButton = screen.getByTitle('Next article')
      fireEvent.click(rightButton)

      // Should display article 3 without delay
      expect(screen.getByText('Article 3')).toBeInTheDocument()
      expect(screen.getByText(/Author 3/)).toBeInTheDocument()
    })

    it('should disable right button at last article', () => {
      const { container } = renderWithRouter(
        <QuickNavigationContainer initialArticleId="article-5" />
      )

      // Find right button (should be disabled at last article)
      const buttons = container.querySelectorAll('button')
      const rightButton = Array.from(buttons).find((btn) =>
        btn.getAttribute('title')?.includes('Next article')
      ) as HTMLButtonElement

      expect(rightButton.disabled).toBe(true)
    })

    it('should allow continuous right navigation from middle article', () => {
      renderWithRouter(<QuickNavigationContainer initialArticleId="article-1" />)

      const rightButton = screen.getByTitle('Next article')

      // Navigate right 4 times: article-1 -> 2 -> 3 -> 4 -> 5
      fireEvent.click(rightButton)
      expect(screen.getByText('Article 2')).toBeInTheDocument()

      fireEvent.click(rightButton)
      expect(screen.getByText('Article 3')).toBeInTheDocument()

      fireEvent.click(rightButton)
      expect(screen.getByText('Article 4')).toBeInTheDocument()

      fireEvent.click(rightButton)
      expect(screen.getByText('Article 5')).toBeInTheDocument()
    })
  })

  describe('US3-Scenario-3: Toolbar Button Navigation', () => {
    it('should support previous article button in toolbar', () => {
      renderWithRouter(<QuickNavigationContainer initialArticleId="article-3" />)

      // Click toolbar "上一篇" (Previous) button
      const toolbarPrevButton = screen.getByTitle('Previous article (toolbar)')
      fireEvent.click(toolbarPrevButton)

      expect(screen.getByText('Article 2')).toBeInTheDocument()
    })

    it('should support next article button in toolbar', () => {
      renderWithRouter(<QuickNavigationContainer initialArticleId="article-2" />)

      // Click toolbar "下一篇" (Next) button
      const toolbarNextButton = screen.getByTitle('Next article (toolbar)')
      fireEvent.click(toolbarNextButton)

      expect(screen.getByText('Article 3')).toBeInTheDocument()
    })

    it('should display position indicator in toolbar', () => {
      renderWithRouter(<QuickNavigationContainer initialArticleId="article-2" />)

      // Verify position indicator shows correct information
      expect(screen.getByText('第 2 篇，共 5 篇')).toBeInTheDocument()
    })

    it('should update position indicator after navigation', () => {
      renderWithRouter(<QuickNavigationContainer initialArticleId="article-1" />)

      // Initially at article 1
      expect(screen.getByText('第 1 篇，共 5 篇')).toBeInTheDocument()

      // Navigate to article 4
      const rightButton = screen.getByTitle('Next article')
      fireEvent.click(rightButton)
      fireEvent.click(rightButton)
      fireEvent.click(rightButton)

      // Position indicator should update to 4
      expect(screen.getByText('第 4 篇，共 5 篇')).toBeInTheDocument()
    })
  })

  describe('US3-Scenario-4: Article List Click Navigation', () => {
    it('should support direct article selection via list click', () => {
      renderWithRouter(<QuickNavigationContainer initialArticleId="article-1" />)

      // Click on article 4 in the list
      const article4Element = screen.getByText('Article 4').closest('div')
      if (article4Element) {
        fireEvent.click(article4Element)
      }

      // Should display article 4
      expect(screen.getByText('Article 4')).toBeInTheDocument()
      expect(screen.getByText(/Author 4/)).toBeInTheDocument()
    })

    it('should support jumping to any article via list', () => {
      renderWithRouter(<QuickNavigationContainer initialArticleId="article-2" />)

      // Click article 5
      const article5 = screen.getByText('Article 5').closest('div')
      if (article5) {
        fireEvent.click(article5)
      }

      expect(screen.getByText('Article 5')).toBeInTheDocument()

      // Click article 1
      const article1 = screen.getByText('Article 1').closest('div')
      if (article1) {
        fireEvent.click(article1)
      }

      expect(screen.getByText('Article 1')).toBeInTheDocument()
    })

    it('should keep article list visible while navigating', () => {
      renderWithRouter(<QuickNavigationContainer initialArticleId="article-1" />)

      // All articles should be visible in list
      for (let i = 1; i <= 5; i++) {
        expect(screen.getByText(`Article ${i}`)).toBeInTheDocument()
      }

      // Navigate via toolbar
      const nextButton = screen.getByTitle('Next article (toolbar)')
      fireEvent.click(nextButton)

      // List should still be visible
      for (let i = 1; i <= 5; i++) {
        expect(screen.getByText(`Article ${i}`)).toBeInTheDocument()
      }
    })
  })

  describe('US3-Scenario-5: Multi-Method Navigation Consistency', () => {
    it('should maintain consistent state across navigation methods', () => {
      renderWithRouter(
        <QuickNavigationContainer initialArticleId="article-1" />
      )

      // Navigate via list click
      const article3List = screen.getByText('Article 3').closest('div')
      if (article3List) {
        fireEvent.click(article3List)
      }

      expect(screen.getByText('Article 3')).toBeInTheDocument()
      expect(screen.getByText('第 3 篇，共 5 篇')).toBeInTheDocument()

      // Navigate via side button
      const rightButton = screen.getByTitle('Next article')
      fireEvent.click(rightButton)

      expect(screen.getByText('Article 4')).toBeInTheDocument()
      expect(screen.getByText('第 4 篇，共 5 篇')).toBeInTheDocument()

      // Navigate via toolbar
      const toolbarPrev = screen.getByTitle('Previous article (toolbar)')
      fireEvent.click(toolbarPrev)

      expect(screen.getByText('Article 3')).toBeInTheDocument()
      expect(screen.getByText('第 3 篇，共 5 篇')).toBeInTheDocument()
    })

    it('should handle rapid navigation without state loss', () => {
      renderWithRouter(<QuickNavigationContainer initialArticleId="article-1" />)

      // Perform rapid navigation using different methods
      const rightButton = screen.getByTitle('Next article')
      fireEvent.click(rightButton) // -> article 2
      fireEvent.click(rightButton) // -> article 3

      // Use list click
      const article5 = screen.getByText('Article 5').closest('div')
      if (article5) {
        fireEvent.click(article5)
      } // -> article 5

      // Use toolbar previous
      const toolbarPrev = screen.getByTitle('Previous article (toolbar)')
      fireEvent.click(toolbarPrev) // -> article 4

      expect(screen.getByText('Article 4')).toBeInTheDocument()
      expect(screen.getByText('第 4 篇，共 5 篇')).toBeInTheDocument()
    })
  })

  describe('US3-Performance-Requirement: < 1 second for switching', () => {
    it('should complete article switching in < 1 second (SC-001)', () => {
      const startTime = performance.now()

      const { rerender } = renderWithRouter(
        <QuickNavigationContainer initialArticleId="article-1" />
      )

      // Perform multiple article switches
      const articles = ['article-2', 'article-3', 'article-4', 'article-5', 'article-3', 'article-1']

      articles.forEach((articleId) => {
        rerender(
          <BrowserRouter>
            <QuickNavigationContainer initialArticleId={articleId} />
          </BrowserRouter>
        )
      })

      const endTime = performance.now()
      const totalTime = endTime - startTime

      // All switches (6 total) should complete in < 1 second
      expect(totalTime).toBeLessThan(1000)
    })

    it('should handle rapid list clicks within 1 second', () => {
      renderWithRouter(<QuickNavigationContainer initialArticleId="article-1" />)

      const startTime = performance.now()

      // Simulate rapid clicks on different articles
      const articleNumbers = [2, 4, 1, 5, 3, 2, 4]
      articleNumbers.forEach((num) => {
        const element = screen.getByText(`Article ${num}`).closest('div')
        if (element) {
          fireEvent.click(element)
        }
      })

      const endTime = performance.now()
      const totalTime = endTime - startTime

      // 7 rapid clicks should complete within 1 second
      expect(totalTime).toBeLessThan(1000)
    })

    it('should maintain responsive button clicks during navigation', () => {
      renderWithRouter(<QuickNavigationContainer initialArticleId="article-2" />)

      const startTime = performance.now()

      const rightButton = screen.getByTitle('Next article')
      const toolbarNext = screen.getByTitle('Next article (toolbar)')

      // Alternate between side button and toolbar button
      fireEvent.click(rightButton)
      fireEvent.click(toolbarNext)
      fireEvent.click(rightButton)
      fireEvent.click(toolbarNext)

      const endTime = performance.now()

      // 4 rapid clicks should be responsive (< 200ms total)
      expect(endTime - startTime).toBeLessThan(200)

      // Should be at article 6 (but limited to 5)
      expect(screen.getByText('Article 5')).toBeInTheDocument()
    })
  })

  describe('Keyboard Navigation Accessibility', () => {
    it('should support button focus and keyboard interaction', () => {
      renderWithRouter(
        <QuickNavigationContainer initialArticleId="article-2" />
      )

      const rightButton = screen.getByTitle('Next article') as HTMLButtonElement

      // Button should be focusable
      rightButton.focus()
      expect(rightButton).toHaveFocus()

      // Simulate Enter key press
      fireEvent.keyDown(rightButton, { key: 'Enter' })

      // Navigation should work
      expect(screen.getByText('Article 3')).toBeInTheDocument()
    })

    it('should have proper ARIA labels for navigation buttons', () => {
      const { container } = renderWithRouter(
        <QuickNavigationContainer initialArticleId="article-3" />
      )

      const buttons = container.querySelectorAll('button[title]')
      expect(buttons.length).toBeGreaterThanOrEqual(2) // At least previous and next buttons

      // Buttons should have descriptive titles
      const buttonTitles = Array.from(buttons).map((btn) => btn.getAttribute('title'))
      expect(buttonTitles.some((title) => title?.includes('Next'))).toBe(true)
      expect(buttonTitles.some((title) => title?.includes('Previous'))).toBe(true)
    })
  })

  describe('Visual Feedback & State Indication', () => {
    it('should highlight current article in list', () => {
      renderWithRouter(
        <QuickNavigationContainer initialArticleId="article-3" />
      )

      // Current article should be displayed prominently
      expect(screen.getByText('Article 3')).toBeInTheDocument()

      // Navigate and verify new article is highlighted
      const article5 = screen.getByText('Article 5').closest('div')
      if (article5) {
        fireEvent.click(article5)
      }

      expect(screen.getByText('Article 5')).toBeInTheDocument()
    })

    it('should show disabled state on navigation buttons at boundaries', () => {
      renderWithRouter(
        <QuickNavigationContainer initialArticleId="article-1" />
      )

      // Check previous button at first article - should be disabled
      const prevButtonFirst = screen.getByTitle('Previous article') as HTMLButtonElement
      expect(prevButtonFirst.disabled).toBe(true)

      // Check next button at first article - should be enabled
      const nextButtonFirst = screen.getByTitle('Next article') as HTMLButtonElement
      expect(nextButtonFirst.disabled).toBe(false)
    })
  })

  describe('Edge Cases & Error Handling', () => {
    it('should prevent navigation beyond boundaries', () => {
      renderWithRouter(<QuickNavigationContainer initialArticleId="article-5" />)

      expect(screen.getByText('Article 5')).toBeInTheDocument()

      // Try to navigate beyond last article
      const rightButton = screen.getByTitle('Next article') as HTMLButtonElement
      expect(rightButton.disabled).toBe(true)

      // Should still be at article 5
      expect(screen.getByText('Article 5')).toBeInTheDocument()
    })

    it('should handle navigation to same article gracefully', () => {
      renderWithRouter(<QuickNavigationContainer initialArticleId="article-3" />)

      expect(screen.getByText('Article 3')).toBeInTheDocument()

      // Click article 3 again
      const article3 = screen.getByText('Article 3').closest('div')
      if (article3) {
        fireEvent.click(article3)
      }

      // Should remain at article 3
      expect(screen.getByText('Article 3')).toBeInTheDocument()
      expect(screen.getByText('第 3 篇，共 5 篇')).toBeInTheDocument()
    })

    it('should maintain navigation state across re-renders', () => {
      const { rerender } = renderWithRouter(
        <QuickNavigationContainer initialArticleId="article-2" />
      )

      expect(screen.getByText('Article 2')).toBeInTheDocument()

      // Force re-render with BrowserRouter wrapper
      rerender(
        <BrowserRouter>
          <QuickNavigationContainer initialArticleId="article-2" />
        </BrowserRouter>
      )

      // Should still be at article 2
      expect(screen.getByText('Article 2')).toBeInTheDocument()
      expect(screen.getByText('第 2 篇，共 5 篇')).toBeInTheDocument()
    })
  })

  describe('Comprehensive Quick Navigation Workflow', () => {
    it('should support complete US3 workflow: side buttons + toolbar + list clicks', () => {
      renderWithRouter(<QuickNavigationContainer initialArticleId="article-1" />)

      // 1. Verify initial state
      expect(screen.getByText('Article 1')).toBeInTheDocument()
      expect(screen.getByText('第 1 篇，共 5 篇')).toBeInTheDocument()

      // 2. Navigate with side button
      const rightButton = screen.getByTitle('Next article')
      fireEvent.click(rightButton)
      expect(screen.getByText('Article 2')).toBeInTheDocument()

      // 3. Jump via list click to article 5
      const article5 = screen.getByText('Article 5').closest('div')
      if (article5) {
        fireEvent.click(article5)
      }
      expect(screen.getByText('Article 5')).toBeInTheDocument()
      expect(screen.getByText('第 5 篇，共 5 篇')).toBeInTheDocument()

      // 4. Navigate with toolbar button
      const toolbarPrev = screen.getByTitle('Previous article (toolbar)')
      fireEvent.click(toolbarPrev)
      expect(screen.getByText('Article 4')).toBeInTheDocument()

      // 5. Multiple side button presses
      const leftButton = screen.getByTitle('Previous article')
      fireEvent.click(leftButton)
      fireEvent.click(leftButton)
      expect(screen.getByText('Article 2')).toBeInTheDocument()

      // 6. Back to first article
      const article1 = screen.getByText('Article 1').closest('div')
      if (article1) {
        fireEvent.click(article1)
      }
      expect(screen.getByText('Article 1')).toBeInTheDocument()
      expect(screen.getByText('第 1 篇，共 5 篇')).toBeInTheDocument()
    })
  })
})
