/**
 * 元件測試 - SideButton (側邊按鈕)
 * 測試快速導航 (US3) 按鈕元件
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SideButton } from '@/components/SideButton'

describe('SideButton Component', () => {
  describe('Rendering', () => {
    it('should render a button element', () => {
      const mockOnClick = vi.fn()
      render(<SideButton direction="left" onClick={mockOnClick} />)

      const button = screen.getByRole('button')
      expect(button).toBeInTheDocument()
    })

    it('should render left arrow SVG for left direction', () => {
      const mockOnClick = vi.fn()
      const { container } = render(
        <SideButton direction="left" onClick={mockOnClick} />
      )

      const path = container.querySelector('path')
      // Left arrow SVG path
      expect(path?.getAttribute('d')).toBe('M15 19l-7-7 7-7')
    })

    it('should render right arrow SVG for right direction', () => {
      const mockOnClick = vi.fn()
      const { container } = render(
        <SideButton direction="right" onClick={mockOnClick} />
      )

      const path = container.querySelector('path')
      // Right arrow SVG path
      expect(path?.getAttribute('d')).toBe('M9 5l7 7-7 7')
    })

    it('should apply left positioning when direction is left', () => {
      const mockOnClick = vi.fn()
      const { container } = render(
        <SideButton direction="left" onClick={mockOnClick} />
      )

      const button = container.querySelector('button')
      expect(button?.className).toContain('left-4')
    })

    it('should apply right positioning when direction is right', () => {
      const mockOnClick = vi.fn()
      const { container } = render(
        <SideButton direction="right" onClick={mockOnClick} />
      )

      const button = container.querySelector('button')
      expect(button?.className).toContain('right-4')
    })

    it('should have fixed positioning', () => {
      const mockOnClick = vi.fn()
      const { container } = render(
        <SideButton direction="left" onClick={mockOnClick} />
      )

      const button = container.querySelector('button')
      expect(button?.className).toContain('fixed')
      expect(button?.className).toContain('top-1/2')
    })

    it('should set title attribute when label is provided', () => {
      const mockOnClick = vi.fn()
      render(
        <SideButton direction="left" onClick={mockOnClick} label="Previous" />
      )

      const button = screen.getByRole('button')
      expect(button).toHaveAttribute('title', 'Previous')
    })

    it('should not set title when label is not provided', () => {
      const mockOnClick = vi.fn()
      const { container } = render(
        <SideButton direction="left" onClick={mockOnClick} />
      )

      const button = container.querySelector('button')
      expect(button?.title).toBe('')
    })
  })

  describe('User Interactions', () => {
    it('should call onClick when button is clicked', () => {
      const mockOnClick = vi.fn()
      render(<SideButton direction="left" onClick={mockOnClick} />)

      const button = screen.getByRole('button')
      fireEvent.click(button)

      expect(mockOnClick).toHaveBeenCalledTimes(1)
    })

    it('should not call onClick when button is disabled', () => {
      const mockOnClick = vi.fn()
      render(
        <SideButton direction="left" onClick={mockOnClick} disabled={true} />
      )

      const button = screen.getByRole('button')
      fireEvent.click(button)

      expect(mockOnClick).not.toHaveBeenCalled()
    })

    it('should have disabled attribute when disabled is true', () => {
      const mockOnClick = vi.fn()
      const { container } = render(
        <SideButton direction="left" onClick={mockOnClick} disabled={true} />
      )

      const button = container.querySelector('button')
      expect(button).toBeDisabled()
    })

    it('should not be disabled when disabled is false or undefined', () => {
      const mockOnClick = vi.fn()
      const { container } = render(
        <SideButton direction="left" onClick={mockOnClick} />
      )

      const button = container.querySelector('button')
      expect(button).not.toBeDisabled()
    })

    it('should handle multiple clicks', () => {
      const mockOnClick = vi.fn()
      render(<SideButton direction="left" onClick={mockOnClick} />)

      const button = screen.getByRole('button')
      fireEvent.click(button)
      fireEvent.click(button)
      fireEvent.click(button)

      expect(mockOnClick).toHaveBeenCalledTimes(3)
    })
  })

  describe('Styling', () => {
    it('should apply disabled styling when disabled', () => {
      const mockOnClick = vi.fn()
      const { container } = render(
        <SideButton direction="left" onClick={mockOnClick} disabled={true} />
      )

      const button = container.querySelector('button')
      // Check for disabled styling classes
      expect(button?.className).toContain('cursor-not-allowed')
    })

    it('should apply enabled styling when not disabled', () => {
      const mockOnClick = vi.fn()
      const { container } = render(
        <SideButton direction="left" onClick={mockOnClick} disabled={false} />
      )

      const button = container.querySelector('button')
      // Check for enabled styling (shadow-lg, hover effects)
      expect(button?.className).toContain('shadow-lg')
    })

    it('should have transition classes for smooth hover effect', () => {
      const mockOnClick = vi.fn()
      const { container } = render(
        <SideButton direction="left" onClick={mockOnClick} />
      )

      const button = container.querySelector('button')
      expect(button?.className).toContain('transition-all')
    })
  })

  describe('Props Combinations', () => {
    it('should handle right direction with label', () => {
      const mockOnClick = vi.fn()
      render(
        <SideButton
          direction="right"
          onClick={mockOnClick}
          label="Next Article"
        />
      )

      const button = screen.getByRole('button')
      expect(button).toHaveAttribute('title', 'Next Article')
      expect(button?.className).toContain('right-4')
    })

    it('should handle left direction disabled with label', () => {
      const mockOnClick = vi.fn()
      render(
        <SideButton
          direction="left"
          onClick={mockOnClick}
          disabled={true}
          label="Previous Article"
        />
      )

      const button = screen.getByRole('button')
      expect(button).toBeDisabled()
      expect(button).toHaveAttribute('title', 'Previous Article')
    })

    it('should handle right direction disabled without label', () => {
      const mockOnClick = vi.fn()
      const { container } = render(
        <SideButton direction="right" onClick={mockOnClick} disabled={true} />
      )

      const button = container.querySelector('button')
      expect(button).toBeDisabled()
      expect(button?.className).toContain('right-4')
    })
  })

  describe('Accessibility', () => {
    it('should have button role for screen readers', () => {
      const mockOnClick = vi.fn()
      render(<SideButton direction="left" onClick={mockOnClick} />)

      const button = screen.getByRole('button')
      expect(button).toBeInTheDocument()
    })

    it('should be keyboard focusable', () => {
      const mockOnClick = vi.fn()
      render(<SideButton direction="left" onClick={mockOnClick} />)

      const button = screen.getByRole('button')
      button.focus()
      expect(button).toHaveFocus()
    })

    it('should communicate disabled state to assistive technology', () => {
      const mockOnClick = vi.fn()
      render(
        <SideButton direction="left" onClick={mockOnClick} disabled={true} />
      )

      const button = screen.getByRole('button')
      expect(button).toBeDisabled()
    })

    it('should provide title for assistive technology when label provided', () => {
      const mockOnClick = vi.fn()
      render(
        <SideButton direction="left" onClick={mockOnClick} label="Previous" />
      )

      const button = screen.getByRole('button')
      expect(button).toHaveAttribute('title', 'Previous')
    })
  })
})
