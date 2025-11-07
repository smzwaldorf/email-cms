/**
 * 測試 - PositionIndicator 元件
 */

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PositionIndicator } from '@/components/PositionIndicator'

describe('PositionIndicator', () => {
  it('應該顯示正確的位置文字', () => {
    render(<PositionIndicator currentPosition={3} totalArticles={10} />)

    expect(screen.getByText(/第 3 篇/)).toBeInTheDocument()
    expect(screen.getByText(/共 10 篇/)).toBeInTheDocument()
  })

  it('應該計算正確的進度百分比', () => {
    render(<PositionIndicator currentPosition={5} totalArticles={10} />)

    expect(screen.getByText('50%')).toBeInTheDocument()
  })

  it('應該在第一篇時顯示 10%', () => {
    render(<PositionIndicator currentPosition={1} totalArticles={10} />)

    expect(screen.getByText('10%')).toBeInTheDocument()
  })

  it('應該在最後一篇時顯示 100%', () => {
    render(<PositionIndicator currentPosition={10} totalArticles={10} />)

    expect(screen.getByText('100%')).toBeInTheDocument()
  })

  it('應該正確處理單篇文章的情況', () => {
    render(<PositionIndicator currentPosition={1} totalArticles={1} />)

    expect(screen.getByText(/第 1 篇/)).toBeInTheDocument()
    expect(screen.getByText(/共 1 篇/)).toBeInTheDocument()
    expect(screen.getByText('100%')).toBeInTheDocument()
  })

  it('應該顯示進度條', () => {
    const { container } = render(
      <PositionIndicator currentPosition={3} totalArticles={10} />
    )

    const progressBar = container.querySelector('div.bg-blue-500')
    expect(progressBar).toBeInTheDocument()
  })

  it('應該使用不同的數值風格', () => {
    const { container } = render(
      <PositionIndicator currentPosition={5} totalArticles={10} />
    )

    // currentPosition 應該使用藍色強調
    const boldNumbers = container.querySelectorAll('.font-bold')
    expect(boldNumbers.length).toBeGreaterThan(0)
  })
})
