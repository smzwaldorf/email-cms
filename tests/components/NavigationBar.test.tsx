/**
 * 測試 - 導航欄組件
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BrowserRouter } from 'react-router-dom'
import { NavigationBar } from '@/components/NavigationBar'
import { NavigationState } from '@/types'

// Mock useNavigate
const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

describe('NavigationBar', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

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

  // T052: 鍵盤快捷鍵支援
  describe('Keyboard Navigation (T052)', () => {
    it('should navigate to previous article with left arrow key', async () => {
      const handlePrevious = vi.fn()
      const handleNext = vi.fn()

      render(
        <NavigationBar
          navigationState={mockNavState}
          onPrevious={handlePrevious}
          onNext={handleNext}
        />
      )

      // Simulate left arrow key press
      fireEvent.keyDown(window, { key: 'ArrowLeft' })

      expect(handlePrevious).toHaveBeenCalledOnce()
      expect(handleNext).not.toHaveBeenCalled()
    })

    it('should navigate to next article with right arrow key', async () => {
      const handlePrevious = vi.fn()
      const handleNext = vi.fn()

      render(
        <NavigationBar
          navigationState={mockNavState}
          onPrevious={handlePrevious}
          onNext={handleNext}
        />
      )

      // Simulate right arrow key press
      fireEvent.keyDown(window, { key: 'ArrowRight' })

      expect(handleNext).toHaveBeenCalledOnce()
      expect(handlePrevious).not.toHaveBeenCalled()
    })

    it('should not navigate previous when at first article', async () => {
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

      // Simulate left arrow key press
      fireEvent.keyDown(window, { key: 'ArrowLeft' })

      expect(handlePrevious).not.toHaveBeenCalled()
    })

    it('should not navigate next when at last article', async () => {
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

      // Simulate right arrow key press
      fireEvent.keyDown(window, { key: 'ArrowRight' })

      expect(handleNext).not.toHaveBeenCalled()
    })

    it('should prevent default behavior for left arrow key', async () => {
      const handlePrevious = vi.fn()
      const handleNext = vi.fn()

      render(
        <NavigationBar
          navigationState={mockNavState}
          onPrevious={handlePrevious}
          onNext={handleNext}
        />
      )

      const event = new KeyboardEvent('keydown', { key: 'ArrowLeft' })
      const preventDefaultSpy = vi.spyOn(event, 'preventDefault')

      window.dispatchEvent(event)

      expect(preventDefaultSpy).toHaveBeenCalled()
    })

    it('should prevent default behavior for right arrow key', async () => {
      const handlePrevious = vi.fn()
      const handleNext = vi.fn()

      render(
        <NavigationBar
          navigationState={mockNavState}
          onPrevious={handlePrevious}
          onNext={handleNext}
        />
      )

      const event = new KeyboardEvent('keydown', { key: 'ArrowRight' })
      const preventDefaultSpy = vi.spyOn(event, 'preventDefault')

      window.dispatchEvent(event)

      expect(preventDefaultSpy).toHaveBeenCalled()
    })

    it('should not respond to other keys', async () => {
      const handlePrevious = vi.fn()
      const handleNext = vi.fn()

      render(
        <NavigationBar
          navigationState={mockNavState}
          onPrevious={handlePrevious}
          onNext={handleNext}
        />
      )

      // Simulate pressing 'a' key
      fireEvent.keyDown(window, { key: 'a' })

      expect(handlePrevious).not.toHaveBeenCalled()
      expect(handleNext).not.toHaveBeenCalled()
    })

    it('should handle continuous keyboard navigation', async () => {
      const handlePrevious = vi.fn()
      const handleNext = vi.fn()

      const middleArticleState: NavigationState = {
        ...mockNavState,
        currentArticleOrder: 3,
      }

      render(
        <NavigationBar
          navigationState={middleArticleState}
          onPrevious={handlePrevious}
          onNext={handleNext}
        />
      )

      // Simulate multiple arrow key presses
      fireEvent.keyDown(window, { key: 'ArrowRight' })
      fireEvent.keyDown(window, { key: 'ArrowRight' })
      fireEvent.keyDown(window, { key: 'ArrowLeft' })

      expect(handleNext).toHaveBeenCalledTimes(2)
      expect(handlePrevious).toHaveBeenCalledTimes(1)
    })

    // Extended keyboard shortcuts (vi-style navigation)
    it('should navigate to previous article with p key', async () => {
      const handlePrevious = vi.fn()
      const handleNext = vi.fn()

      render(
        <NavigationBar
          navigationState={mockNavState}
          onPrevious={handlePrevious}
          onNext={handleNext}
        />
      )

      fireEvent.keyDown(window, { key: 'p' })

      expect(handlePrevious).toHaveBeenCalledOnce()
      expect(handleNext).not.toHaveBeenCalled()
    })

    it('should navigate to previous article with k key', async () => {
      const handlePrevious = vi.fn()
      const handleNext = vi.fn()

      render(
        <NavigationBar
          navigationState={mockNavState}
          onPrevious={handlePrevious}
          onNext={handleNext}
        />
      )

      fireEvent.keyDown(window, { key: 'k' })

      expect(handlePrevious).toHaveBeenCalledOnce()
      expect(handleNext).not.toHaveBeenCalled()
    })

    it('should navigate to next article with n key', async () => {
      const handlePrevious = vi.fn()
      const handleNext = vi.fn()

      render(
        <NavigationBar
          navigationState={mockNavState}
          onPrevious={handlePrevious}
          onNext={handleNext}
        />
      )

      fireEvent.keyDown(window, { key: 'n' })

      expect(handleNext).toHaveBeenCalledOnce()
      expect(handlePrevious).not.toHaveBeenCalled()
    })

    it('should navigate to next article with j key', async () => {
      const handlePrevious = vi.fn()
      const handleNext = vi.fn()

      render(
        <NavigationBar
          navigationState={mockNavState}
          onPrevious={handlePrevious}
          onNext={handleNext}
        />
      )

      fireEvent.keyDown(window, { key: 'j' })

      expect(handleNext).toHaveBeenCalledOnce()
      expect(handlePrevious).not.toHaveBeenCalled()
    })

    it('should navigate to editor when e key is pressed', async () => {
      const handlePrevious = vi.fn()
      const handleNext = vi.fn()

      render(
        <NavigationBar
          navigationState={mockNavState}
          onPrevious={handlePrevious}
          onNext={handleNext}
        />
      )

      fireEvent.keyDown(window, { key: 'e' })

      expect(mockNavigate).toHaveBeenCalledWith('/editor/2025-W43/article-002')
      expect(handlePrevious).not.toHaveBeenCalled()
      expect(handleNext).not.toHaveBeenCalled()
    })

    it('should prevent default for p key navigation', async () => {
      const handlePrevious = vi.fn()
      const handleNext = vi.fn()

      render(
        <NavigationBar
          navigationState={mockNavState}
          onPrevious={handlePrevious}
          onNext={handleNext}
        />
      )

      const event = new KeyboardEvent('keydown', { key: 'p' })
      const preventDefaultSpy = vi.spyOn(event, 'preventDefault')

      window.dispatchEvent(event)

      expect(preventDefaultSpy).toHaveBeenCalled()
    })

    it('should prevent default for e key (edit)', async () => {
      const handlePrevious = vi.fn()
      const handleNext = vi.fn()

      render(
        <NavigationBar
          navigationState={mockNavState}
          onPrevious={handlePrevious}
          onNext={handleNext}
        />
      )

      const event = new KeyboardEvent('keydown', { key: 'e' })
      const preventDefaultSpy = vi.spyOn(event, 'preventDefault')

      window.dispatchEvent(event)

      expect(preventDefaultSpy).toHaveBeenCalled()
      expect(mockNavigate).toHaveBeenCalledWith('/editor/2025-W43/article-002')
    })

    it('should support case-insensitive keyboard shortcuts', async () => {
      const handlePrevious = vi.fn()
      const handleNext = vi.fn()

      render(
        <NavigationBar
          navigationState={mockNavState}
          onPrevious={handlePrevious}
          onNext={handleNext}
        />
      )

      // Test uppercase P
      fireEvent.keyDown(window, { key: 'P' })
      expect(handlePrevious).toHaveBeenCalledOnce()

      handlePrevious.mockClear()

      // Test uppercase N
      fireEvent.keyDown(window, { key: 'N' })
      expect(handleNext).toHaveBeenCalledOnce()
    })

    it('should handle mixed keyboard shortcuts', async () => {
      const handlePrevious = vi.fn()
      const handleNext = vi.fn()

      const middleArticleState: NavigationState = {
        ...mockNavState,
        currentArticleOrder: 3,
      }

      render(
        <NavigationBar
          navigationState={middleArticleState}
          onPrevious={handlePrevious}
          onNext={handleNext}
        />
      )

      // Use different shortcuts
      fireEvent.keyDown(window, { key: 'ArrowRight' }) // Next via arrow
      fireEvent.keyDown(window, { key: 'n' }) // Next via n
      fireEvent.keyDown(window, { key: 'j' }) // Next via j
      fireEvent.keyDown(window, { key: 'p' }) // Prev via p
      fireEvent.keyDown(window, { key: 'ArrowLeft' }) // Prev via arrow

      expect(handleNext).toHaveBeenCalledTimes(3)
      expect(handlePrevious).toHaveBeenCalledTimes(2)
    })
  })
})
