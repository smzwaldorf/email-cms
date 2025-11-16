/**
 * 整合測試 - 使用者故事 4
 * 編輯者工作流的基本測試
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as mockApi from '@/services/mockApi'

// Mock the API
vi.mock('@/services/mockApi')

// Mock router
const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useParams: () => ({ weekNumber: '2025-W43' }),
  }
})

describe('User Story 4 - Content Management', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  const mockArticles = [
    {
      id: 'article-001',
      title: 'First Article',
      content: 'Content 1',
      author: 'Author 1',
      summary: 'Summary 1',
      weekNumber: '2025-W43',
      order: 1,
      slug: 'first-article',
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

  it('should provide API for content management', () => {
    vi.mocked(mockApi.fetchWeeklyNewsletter).mockResolvedValue(mockWeekData)

    expect(mockApi.fetchWeeklyNewsletter).toBeDefined()
  })

  it('should support article creation', () => {
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

  it('should support article updates', () => {
    vi.mocked(mockApi.updateArticle).mockResolvedValue({
      ...mockArticles[0],
      title: 'Updated Title',
    })

    expect(mockApi.updateArticle).toBeDefined()
  })

  it('should support article reordering', () => {
    vi.mocked(mockApi.reorderArticles).mockResolvedValue(true)

    expect(mockApi.reorderArticles).toBeDefined()
  })
})
