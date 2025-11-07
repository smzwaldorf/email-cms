/**
 * 測試 - LoadingSpinner 元件
 */

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { LoadingSpinner } from '@/components/LoadingSpinner'

describe('LoadingSpinner', () => {
  it('應該呈現旋轉動畫', () => {
    const { container } = render(<LoadingSpinner />)

    const spinner = container.querySelector('.animate-spin')
    expect(spinner).toBeInTheDocument()
  })

  it('應該顯示自訂訊息', () => {
    render(<LoadingSpinner message="正在加載文章..." />)

    expect(screen.getByText('正在加載文章...')).toBeInTheDocument()
  })

  it('應該不顯示訊息（預設）', () => {
    render(<LoadingSpinner />)

    // 檢查預設情況下沒有訊息文字
    expect(screen.queryByText(/正在/)).not.toBeInTheDocument()
  })

  it('應該支援不同的大小 - small', () => {
    const { container } = render(<LoadingSpinner size="sm" />)

    const svg = container.querySelector('svg')
    expect(svg?.parentElement?.className).toContain('w-6')
    expect(svg?.parentElement?.className).toContain('h-6')
  })

  it('應該支援不同的大小 - medium', () => {
    const { container } = render(<LoadingSpinner size="md" />)

    const svg = container.querySelector('svg')
    expect(svg?.parentElement?.className).toContain('w-10')
    expect(svg?.parentElement?.className).toContain('h-10')
  })

  it('應該支援不同的大小 - large', () => {
    const { container } = render(<LoadingSpinner size="lg" />)

    const svg = container.querySelector('svg')
    expect(svg?.parentElement?.className).toContain('w-16')
    expect(svg?.parentElement?.className).toContain('h-16')
  })

  it('應該支援全螢幕模式', () => {
    const { container } = render(<LoadingSpinner fullScreen={true} />)

    const fullScreenDiv = container.querySelector('.fixed')
    expect(fullScreenDiv).toBeInTheDocument()
    expect(fullScreenDiv?.className).toContain('inset-0')
    expect(fullScreenDiv?.className).toContain('z-50')
  })

  it('非全螢幕模式應該有 padding', () => {
    const { container } = render(<LoadingSpinner fullScreen={false} />)

    const paddedDiv = container.querySelector('.py-8')
    expect(paddedDiv).toBeInTheDocument()
  })

  it('應該使用藍色顏色', () => {
    const { container } = render(<LoadingSpinner />)

    const svg = container.querySelector('svg')
    expect(svg?.className).toContain('text-blue-500')
  })
})
