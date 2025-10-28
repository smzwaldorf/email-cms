/**
 * 測試 - 導航欄組件
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { NavigationBar } from '@/components/NavigationBar'
import { NavigationState } from '@/types'

describe('NavigationBar', () => {
  const mockNavState: NavigationState = {
    currentWeekNumber: '2025-W43',
    currentArticleId: 'article-002',
    currentArticleOrder: 2,
    totalArticlesInWeek: 5,
    articleList: [],
    isLoading: false,
  }

  it('should display position text correctly', () => {
    const handlePrevious = vi.fn()
    const handleNext = vi.fn()

    render(
      <NavigationBar
        navigationState={mockNavState}
        onPrevious={handlePrevious}
        onNext={handleNext}
      />
    )

    expect(screen.getByText('第 2 篇，共 5 篇')).toBeInTheDocument()
  })

  it('should display position indicators', () => {
    const handlePrevious = vi.fn()
    const handleNext = vi.fn()

    const { container } = render(
      <NavigationBar
        navigationState={mockNavState}
        onPrevious={handlePrevious}
        onNext={handleNext}
      />
    )

    const indicators = container.querySelectorAll('.rounded-full')
    expect(indicators).toHaveLength(5)
  })

  it('should enable previous button when not at first article', () => {
    const handlePrevious = vi.fn()
    const handleNext = vi.fn()

    render(
      <NavigationBar
        navigationState={mockNavState}
        onPrevious={handlePrevious}
        onNext={handleNext}
      />
    )

    const previousButton = screen.getByRole('button', { name: /上一篇/ })
    expect(previousButton).not.toBeDisabled()
  })

  it('should disable previous button at first article', () => {
    const handlePrevious = vi.fn()
    const handleNext = vi.fn()

    const firstArticleState: NavigationState = {
      ...mockNavState,
      currentArticleOrder: 1,
    }

    render(
      <NavigationBar
        navigationState={firstArticleState}
        onPrevious={handlePrevious}
        onNext={handleNext}
      />
    )

    const previousButton = screen.getByRole('button', { name: /上一篇/ })
    expect(previousButton).toBeDisabled()
  })

  it('should enable next button when not at last article', () => {
    const handlePrevious = vi.fn()
    const handleNext = vi.fn()

    render(
      <NavigationBar
        navigationState={mockNavState}
        onPrevious={handlePrevious}
        onNext={handleNext}
      />
    )

    const nextButton = screen.getByRole('button', { name: /下一篇/ })
    expect(nextButton).not.toBeDisabled()
  })

  it('should disable next button at last article', () => {
    const handlePrevious = vi.fn()
    const handleNext = vi.fn()

    const lastArticleState: NavigationState = {
      ...mockNavState,
      currentArticleOrder: 5,
    }

    render(
      <NavigationBar
        navigationState={lastArticleState}
        onPrevious={handlePrevious}
        onNext={handleNext}
      />
    )

    const nextButton = screen.getByRole('button', { name: /下一篇/ })
    expect(nextButton).toBeDisabled()
  })

  it('should call onPrevious when previous button is clicked', async () => {
    const handlePrevious = vi.fn()
    const handleNext = vi.fn()
    const user = userEvent.setup()

    render(
      <NavigationBar
        navigationState={mockNavState}
        onPrevious={handlePrevious}
        onNext={handleNext}
      />
    )

    await user.click(screen.getByRole('button', { name: /上一篇/ }))
    expect(handlePrevious).toHaveBeenCalledOnce()
  })

  it('should call onNext when next button is clicked', async () => {
    const handlePrevious = vi.fn()
    const handleNext = vi.fn()
    const user = userEvent.setup()

    render(
      <NavigationBar
        navigationState={mockNavState}
        onPrevious={handlePrevious}
        onNext={handleNext}
      />
    )

    await user.click(screen.getByRole('button', { name: /下一篇/ }))
    expect(handleNext).toHaveBeenCalledOnce()
  })
})
