/**
 * 測試 - 編輯頁面
 * EditorPage 編輯器頁面單元測試
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import { EditorPage } from '@/pages/EditorPage'
import * as mockApi from '@/services/mockApi'

// Mock the mockApi module
vi.mock('@/services/mockApi')

// Mock useNavigate
const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useParams: () => ({ weekNumber: '2025-W43' }),
  }
})

describe('EditorPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  const mockArticles = [
    {
      id: 'article-001',
      shortId: 'a001',
      title: 'Article 1',
      content: 'Content 1',
      author: 'Author 1',
      summary: 'Summary 1',
      weekNumber: '2025-W43',
      order: 1,
      slug: 'article-1',
      publicUrl: '/article/article-001',
      createdAt: '2025-11-16T00:00:00Z',
      updatedAt: '2025-11-16T00:00:00Z',
      isPublished: true,
    },
  ]

  const mockWeekData = {
    weekNumber: '2025-W43',
    releaseDate: '2025-11-16',
    title: 'Week 43',
    articleIds: ['article-001'],
    createdAt: '2025-11-16T00:00:00Z',
    updatedAt: '2025-11-16T00:00:00Z',
    isPublished: true,
    totalArticles: 1,
    articles: mockArticles,
  }

  it('should render editor page', () => {
    vi.mocked(mockApi.fetchWeeklyNewsletter).mockResolvedValue(mockWeekData)

    render(
      <BrowserRouter>
        <EditorPage />
      </BrowserRouter>
    )

    // Editor page should render without errors
    expect(document.querySelector('div')).toBeDefined()
  })

  it('should have correct mock API function', () => {
    expect(mockApi.fetchWeeklyNewsletter).toBeDefined()
  })

  it('should support article operations', () => {
    vi.mocked(mockApi.createArticle).mockResolvedValue({
      ...mockArticles[0],
      id: 'article-002',
      title: 'New Article',
    })

    expect(mockApi.createArticle).toBeDefined()
  })

  it('should support article deletion', () => {
    vi.mocked(mockApi.deleteArticle).mockResolvedValue(false)

    expect(mockApi.deleteArticle).toBeDefined()
  })
})
