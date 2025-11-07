/**
 * 測試 - ErrorBoundary 元件
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ErrorBoundary } from '@/components/ErrorBoundary'

describe('ErrorBoundary', () => {
  // 抑制控制台錯誤輸出以保持測試輸出乾淨
  let originalConsoleError: typeof console.error
  beforeEach(() => {
    originalConsoleError = console.error
    console.error = vi.fn()
  })
  afterEach(() => {
    console.error = originalConsoleError
  })

  it('應該正常渲染子元件', () => {
    render(
      <ErrorBoundary>
        <div>測試內容</div>
      </ErrorBoundary>
    )

    expect(screen.getByText('測試內容')).toBeInTheDocument()
  })

  it('應該在子元件拋出錯誤時顯示錯誤 UI', () => {
    const ThrowError = () => {
      throw new Error('測試錯誤')
    }

    render(
      <ErrorBoundary>
        <ThrowError />
      </ErrorBoundary>
    )

    expect(screen.getByText('應用程式出錯')).toBeInTheDocument()
    expect(
      screen.getByText('抱歉，應用程式遇到意外錯誤。請重新載入頁面。')
    ).toBeInTheDocument()
  })

  it('應該在開發模式下顯示錯誤詳情', () => {
    const ThrowError = () => {
      throw new Error('開發錯誤訊息')
    }

    // 模擬開發模式
    const originalEnv = process.env.NODE_ENV
    Object.defineProperty(process.env, 'NODE_ENV', {
      value: 'development',
      writable: true,
    })

    render(
      <ErrorBoundary>
        <ThrowError />
      </ErrorBoundary>
    )

    expect(screen.getByText('錯誤詳情:')).toBeInTheDocument()
    expect(screen.getByText('開發錯誤訊息')).toBeInTheDocument()

    // 恢復原始環境
    Object.defineProperty(process.env, 'NODE_ENV', {
      value: originalEnv,
      writable: true,
    })
  })

  it('應該支援自訂 fallback 渲染', () => {
    const ThrowError = () => {
      throw new Error('自訂錯誤')
    }

    const CustomFallback = (error: Error) => (
      <div>自訂錯誤頁面: {error.message}</div>
    )

    render(
      <ErrorBoundary fallback={CustomFallback}>
        <ThrowError />
      </ErrorBoundary>
    )

    expect(screen.getByText('自訂錯誤頁面: 自訂錯誤')).toBeInTheDocument()
  })

  it('應該有重新載入按鈕', () => {
    const ThrowError = () => {
      throw new Error('測試')
    }

    render(
      <ErrorBoundary>
        <ThrowError />
      </ErrorBoundary>
    )

    const reloadButton = screen.getByText('重新載入')
    expect(reloadButton).toBeInTheDocument()
  })
})
