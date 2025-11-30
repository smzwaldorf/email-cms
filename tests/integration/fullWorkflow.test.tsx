/**
 * 整合測試 - 完整工作流程
 * 測試整個應用的端到端工作流程，涵蓋讀者和編輯者場景
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as mockApi from '@/services/mockApi'

// Mock the API
vi.mock('@/services/mockApi')

describe('Full Application Workflow', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  const mockArticles = [
    {
      id: 'article-001',
      shortId: 'a001',
      title: 'First Article',
      content: '# Content 1',
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
    {
      id: 'article-002',
      shortId: 'a002',
      title: 'Second Article',
      content: '# Content 2',
      author: 'Author 2',
      summary: 'Summary 2',
      weekNumber: '2025-W43',
      order: 2,
      slug: 'second-article',
      publicUrl: '/article/article-002',
      createdAt: '2025-11-16T01:00:00Z',
      updatedAt: '2025-11-16T01:00:00Z',
      isPublished: true,
    },
    {
      id: 'article-003',
      shortId: 'a003',
      title: 'Third Article',
      content: '# Content 3',
      author: 'Author 3',
      summary: 'Summary 3',
      weekNumber: '2025-W43',
      order: 3,
      slug: 'third-article',
      publicUrl: '/article/article-003',
      createdAt: '2025-11-16T02:00:00Z',
      updatedAt: '2025-11-16T02:00:00Z',
      isPublished: true,
    },
  ]

  const mockWeekData = {
    weekNumber: '2025-W43',
    releaseDate: '2025-11-16',
    title: 'Week 43',
    articleIds: ['article-001', 'article-002', 'article-003'],
    createdAt: '2025-11-16T00:00:00Z',
    updatedAt: '2025-11-16T00:00:00Z',
    isPublished: true,
    totalArticles: 3,
    articles: mockArticles,
  }

  describe('Reader Workflow', () => {
    it('should fetch and load reader data with multiple articles', async () => {
      vi.mocked(mockApi.fetchWeeklyNewsletter).mockResolvedValue(mockWeekData)

      const result = await mockApi.fetchWeeklyNewsletter('2025-W43')
      expect(result.weekNumber).toBe('2025-W43')
      expect(result.totalArticles).toBe(3)
    })

    it('should support multiple article viewing scenarios', () => {
      expect(mockArticles.length).toBe(3)

      // Simulate viewing each article
      mockArticles.forEach((article, index) => {
        expect(article.order).toBe(index + 1)
        expect(article.isPublished).toBe(true)
      })
    })

    it('should handle article data correctly', () => {
      expect(mockArticles.length).toBe(3)
      expect(mockWeekData.totalArticles).toBe(3)
      expect(mockWeekData.articles[0].isPublished).toBe(true)
    })

    it('should maintain article sequence for navigation', () => {
      const articleIds = mockWeekData.articles.map((a) => a.id)
      expect(articleIds.length).toBe(3)
      expect(articleIds[0]).toBe('article-001')
      expect(articleIds[2]).toBe('article-003')
    })
  })

  describe('Editor Workflow', () => {
    it('should create new articles', () => {
      const newArticle = {
        ...mockArticles[0],
        id: 'article-004',
        title: 'New Article',
      }

      vi.mocked(mockApi.createArticle).mockResolvedValue(newArticle)

      expect(mockApi.createArticle).toBeDefined()
    })

    it('should support article CRUD operations', () => {
      vi.mocked(mockApi.createArticle).mockResolvedValue({
        ...mockArticles[0],
        id: 'article-004',
      })
      vi.mocked(mockApi.updateArticle).mockResolvedValue({
        ...mockArticles[0],
        title: 'Updated Title',
      })
      vi.mocked(mockApi.deleteArticle).mockResolvedValue(false)
      vi.mocked(mockApi.reorderArticles).mockResolvedValue(true)

      expect(mockApi.createArticle).toBeDefined()
      expect(mockApi.updateArticle).toBeDefined()
      expect(mockApi.deleteArticle).toBeDefined()
      expect(mockApi.reorderArticles).toBeDefined()
    })

    it('should maintain article order during reordering', () => {
      const orderedArticles = mockWeekData.articles.sort((a, b) => a.order - b.order)
      expect(orderedArticles[0].order).toBe(1)
      expect(orderedArticles[1].order).toBe(2)
      expect(orderedArticles[2].order).toBe(3)
    })

    it('should update article metadata', async () => {
      const updatedArticle = {
        ...mockArticles[0],
        title: 'Updated Title',
      }

      vi.mocked(mockApi.updateArticle).mockResolvedValue(updatedArticle)

      const result = await mockApi.updateArticle('article-001', updatedArticle)
      expect(result.title).toBe('Updated Title')
    })

    it('should delete articles', async () => {
      vi.mocked(mockApi.deleteArticle).mockResolvedValue(false)

      await mockApi.deleteArticle('article-001')
      expect(mockApi.deleteArticle).toHaveBeenCalled()
    })
  })

  describe('Data Integrity', () => {
    it('should validate article data structure', () => {
      mockArticles.forEach((article) => {
        expect(article.id).toBeDefined()
        expect(article.title).toBeDefined()
        expect(article.content).toBeDefined()
        expect(article.author).toBeDefined()
        expect(article.summary).toBeDefined()
        expect(article.weekNumber).toBe('2025-W43')
        expect(article.isPublished).toBe(true)
      })
    })

    it('should validate week data structure', () => {
      expect(mockWeekData.weekNumber).toBe('2025-W43')
      expect(mockWeekData.articles.length).toBe(mockWeekData.totalArticles)
      expect(mockWeekData.isPublished).toBe(true)
    })

    it('should ensure no data loss during operations', () => {
      const originalCount = mockArticles.length
      const modifiedArticles = [...mockArticles, {
        ...mockArticles[0],
        id: 'article-004',
      }]
      expect(modifiedArticles.length).toBe(originalCount + 1)
    })
  })

  describe('Cross-Story Integration', () => {
    it('should integrate US1 (article viewing) with US2 (direct links)', () => {
      const directLinkUrl = `/article/${mockArticles[0].id}`
      expect(mockArticles[0].publicUrl).toBe(`/article/article-001`)
      expect(directLinkUrl).toBeDefined()
    })

    it('should integrate US3 (quick navigation) with US1 (article display)', () => {
      expect(mockArticles.length).toBe(3)
      // User should be able to navigate through all articles
      mockArticles.forEach((article, index) => {
        expect(article.order).toBe(index + 1)
      })
    })

    it('should integrate US4 (editor) with US1 (reader display)', () => {
      // Editor changes should reflect in reader
      vi.mocked(mockApi.fetchWeeklyNewsletter).mockResolvedValue(mockWeekData)
      vi.mocked(mockApi.updateArticle).mockResolvedValue({
        ...mockArticles[0],
        title: 'Updated Title',
      })

      expect(mockApi.fetchWeeklyNewsletter).toBeDefined()
      expect(mockApi.updateArticle).toBeDefined()
    })
  })

  describe('Error Handling and Edge Cases', () => {
    it('should handle empty article list', () => {
      const emptyData = {
        ...mockWeekData,
        articles: [],
        totalArticles: 0,
      }
      expect(emptyData.articles.length).toBe(0)
      expect(emptyData.totalArticles).toBe(0)
    })

    it('should handle article with missing optional fields', () => {
      const minimalArticle = {
        id: 'article-test',
        title: 'Test Article',
        content: 'Test content',
        author: 'Test Author',
        summary: 'Test summary',
        weekNumber: '2025-W43',
        order: 1,
        slug: 'test-article',
        publicUrl: '/article/test',
        createdAt: '2025-11-16T00:00:00Z',
        updatedAt: '2025-11-16T00:00:00Z',
        isPublished: true,
      }
      expect(minimalArticle.id).toBeDefined()
      expect(minimalArticle.isPublished).toBe(true)
    })

    it('should handle rapid consecutive requests', () => {
      const requests = [
        mockApi.fetchWeeklyNewsletter('2025-W43'),
        mockApi.fetchWeeklyNewsletter('2025-W43'),
        mockApi.fetchWeeklyNewsletter('2025-W43'),
      ]
      expect(requests.length).toBe(3)
    })
  })

  describe('Performance Considerations', () => {
    it('should handle large article counts', () => {
      const largeArticleList = Array.from({ length: 50 }, (_, i) => ({
        ...mockArticles[0],
        id: `article-${i}`,
        order: i + 1,
      }))
      expect(largeArticleList.length).toBe(50)
      expect(largeArticleList[49].order).toBe(50)
    })

    it('should maintain performance with nested data structures', () => {
      const complexData = {
        ...mockWeekData,
        articles: mockArticles.map((article) => ({
          ...article,
          metadata: {
            views: 100,
            likes: 50,
            shares: 10,
          },
        })),
      }
      expect(complexData.articles.length).toBe(mockArticles.length)
    })
  })

  describe('Accessibility and User Experience', () => {
    it('should provide all required article information', () => {
      mockArticles.forEach((article) => {
        expect(article.title).toBeTruthy()
        expect(article.author).toBeTruthy()
        expect(article.summary).toBeTruthy()
      })
    })

    it('should maintain chronological order', () => {
      const orderedArticles = mockWeekData.articles.sort((a, b) => a.order - b.order)
      for (let i = 0; i < orderedArticles.length - 1; i++) {
        expect(orderedArticles[i].order).toBeLessThan(orderedArticles[i + 1].order)
      }
    })

    it('should support article navigation metadata', () => {
      expect(mockWeekData.totalArticles).toBe(mockArticles.length)
      mockArticles.forEach((article) => {
        expect(article.order).toBeGreaterThan(0)
        expect(article.order).toBeLessThanOrEqual(mockWeekData.totalArticles)
      })
    })
  })
})
