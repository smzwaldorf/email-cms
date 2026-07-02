/**
 * 測試 - ErrorPage 元件
 */

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import { ErrorPage } from '@/pages/ErrorPage'

describe('ErrorPage', () => {
  const renderWithRouter = (component: React.ReactNode) => {
    return render(<BrowserRouter>{component}</BrowserRouter>)
  }

  it('應該顯示預設錯誤訊息', () => {
    renderWithRouter(<ErrorPage />)

    expect(screen.getByText('發生錯誤')).toBeInTheDocument()
    expect(screen.getByText('找不到您要的內容')).toBeInTheDocument()
  })

  it('應該顯示文章不存在的錯誤', () => {
    renderWithRouter(<ErrorPage errorCode="ARTICLE_NOT_FOUND" />)

    expect(screen.getByText('文章不存在')).toBeInTheDocument()
    expect(screen.getByText('您訪問的文章不存在或已被刪除')).toBeInTheDocument()
  })

  it('應該顯示文章已刪除的錯誤', () => {
    renderWithRouter(<ErrorPage errorCode="ARTICLE_DELETED" />)

    expect(screen.getByText('文章已移除')).toBeInTheDocument()
    expect(screen.getByText('您訪問的文章已被編輯者刪除')).toBeInTheDocument()
  })

  it('應該顯示週份不存在的錯誤', () => {
    renderWithRouter(<ErrorPage errorCode="WEEK_NOT_FOUND" />)

    expect(screen.getByText('週份不存在')).toBeInTheDocument()
    expect(screen.getByText('您訪問的週份暫無內容或不存在')).toBeInTheDocument()
  })

  it('應該顯示無效 URL 的錯誤', () => {
    renderWithRouter(<ErrorPage errorCode="INVALID_URL" />)

    expect(screen.getByText('無效的連結')).toBeInTheDocument()
    expect(screen.getByText('您訪問的連結格式有誤')).toBeInTheDocument()
  })

  it('應該顯示自訂錯誤訊息', () => {
    renderWithRouter(
      <ErrorPage
        title="自訂錯誤"
        errorMessage="這是自訂錯誤訊息"
      />
    )

    expect(screen.getByText('自訂錯誤')).toBeInTheDocument()
    expect(screen.getByText('這是自訂錯誤訊息')).toBeInTheDocument()
  })

  it('應該顯示錯誤代碼', () => {
    renderWithRouter(
      <ErrorPage errorCode="CUSTOM_ERROR" />
    )

    expect(screen.getByText(/CUSTOM_ERROR/)).toBeInTheDocument()
  })

  it('應該有返回首頁按鈕', () => {
    renderWithRouter(<ErrorPage />)

    const homeButton = screen.getByText('返回首頁')
    expect(homeButton).toBeInTheDocument()
    expect(homeButton.tagName).toBe('BUTTON')
  })

  it('應該有返回上一頁按鈕', () => {
    renderWithRouter(<ErrorPage />)

    const backButton = screen.getByText('返回上一頁')
    expect(backButton).toBeInTheDocument()
  })
})
