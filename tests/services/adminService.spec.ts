import { describe, it, expect, vi, beforeEach } from 'vitest'
import { adminService } from '@/services/adminService'

// Mock Supabase client
const mockBuilder = {
  select: vi.fn().mockReturnThis(),
  insert: vi.fn().mockReturnThis(),
  update: vi.fn().mockReturnThis(),
  delete: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  order: vi.fn().mockReturnThis(),
  limit: vi.fn().mockReturnThis(),
  single: vi.fn().mockReturnThis(),
  gte: vi.fn().mockReturnThis(),
  lte: vi.fn().mockReturnThis(),
  or: vi.fn().mockReturnThis(),
  then: vi.fn((resolve, reject) => resolve({ data: [], error: null })),
}

const mockSupabase = {
  from: vi.fn(() => mockBuilder),
}

vi.mock('@/lib/supabase', () => ({
  getSupabaseClient: () => mockSupabase,
}))

describe('AdminService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset builder methods to return self
    Object.values(mockBuilder).forEach((mock) => {
      if (mock.mockReturnThis) {
        mock.mockReturnThis()
      }
    })
    // Reset default response
    mockBuilder.then.mockImplementation((resolve) => resolve({ data: [], error: null }))
  })

  describe('fetchNewsletters', () => {
    it('maps status=published correctly', async () => {
      const mockData = [
        {
          id: 'a1111111-1111-1111-1111-111111111111',
          week_number: '2025-W01',
          title: 'Week 1 Newsletter',
          release_date: '2025-01-01',
          status: 'published',
          created_at: '2025-01-01',
          updated_at: '2025-01-01',
          newsletter_articles: [{ count: 5 }],
        },
      ]
      mockBuilder.then.mockImplementation((resolve) => resolve({ data: mockData, error: null }))

      const result = await adminService.fetchNewsletters()

      expect(result[0].status).toBe('published')
      expect(result[0].isPublished).toBe(true)
    })

    it('maps status=draft correctly', async () => {
      const mockData = [
        {
          id: 'a2222222-2222-2222-2222-222222222222',
          week_number: '2025-W02',
          title: 'Week 2 Newsletter',
          release_date: '2025-01-08',
          status: 'draft',
          created_at: '2025-01-08',
          updated_at: '2025-01-08',
          newsletter_articles: [{ count: 0 }],
        },
      ]
      mockBuilder.then.mockImplementation((resolve) => resolve({ data: mockData, error: null }))

      const result = await adminService.fetchNewsletters()

      expect(result[0].status).toBe('draft')
      expect(result[0].isPublished).toBe(false)
    })

    it('uses newsletters table with newsletter_articles count', async () => {
      mockBuilder.then.mockImplementation((resolve) => resolve({ data: [], error: null }))

      await adminService.fetchNewsletters()

      expect(mockSupabase.from).toHaveBeenCalledWith('newsletters')
    })
  })

  describe('createNewsletter', () => {
    it('inserts with correct fields including status', async () => {
      const mockResponse = {
        id: 'a3333333-3333-3333-3333-333333333333',
        week_number: '2025-W48',
        title: 'Week 48 Newsletter',
        release_date: '2025-11-30',
        status: 'draft',
        created_at: '2025-11-30',
        updated_at: '2025-11-30',
      }
      mockBuilder.then.mockImplementation((resolve) => resolve({ data: mockResponse, error: null }))

      await adminService.createNewsletter('2025-W48', '2025-11-30')

      expect(mockSupabase.from).toHaveBeenCalledWith('newsletters')
      expect(mockBuilder.insert).toHaveBeenCalledWith(expect.objectContaining({
        week_number: '2025-W48',
        release_date: '2025-11-30',
        status: 'draft',
      }))
    })

    it('throws DUPLICATE_NEWSLETTER_ERROR on duplicate key violation', async () => {
      const error = { code: '23505', message: 'duplicate key value' }
      // @ts-ignore
      mockBuilder.then.mockImplementation((resolve, reject) => reject(error))

      await expect(adminService.createNewsletter('2025-W48', '2025-11-30'))
        .rejects.toThrow('Newsletter for week 2025-W48 already exists')
    })
  })

  describe('publishNewsletter', () => {
    it('updates status to published', async () => {
      // Mock article check (first call) and update response (second call)
      const mockArticleResponse = { data: [{ article_id: 'article-1' }], error: null }
      const mockUpdateResponse = {
        data: {
          id: 'a1111111-1111-1111-1111-111111111111',
          week_number: '2025-W01',
          title: 'Week 1 Newsletter',
          release_date: '2025-01-01',
          status: 'published',
          published_at: '2025-01-01T12:00:00Z',
          created_at: '2025-01-01',
          updated_at: '2025-01-01',
        },
        error: null
      }

      mockBuilder.then
        .mockImplementationOnce((resolve) => resolve(mockArticleResponse))
        .mockImplementationOnce((resolve) => resolve(mockUpdateResponse))

      await adminService.publishNewsletter('a1111111-1111-1111-1111-111111111111')

      expect(mockSupabase.from).toHaveBeenCalledWith('newsletters')
      expect(mockBuilder.update).toHaveBeenCalledWith(expect.objectContaining({
        status: 'published',
      }))
    })
  })

  describe('archiveNewsletter', () => {
    it('updates status to archived', async () => {
      const mockResponse = {
        id: 'a1111111-1111-1111-1111-111111111111',
        week_number: '2025-W01',
        title: 'Week 1 Newsletter',
        release_date: '2025-01-01',
        status: 'archived',
        created_at: '2025-01-01',
        updated_at: '2025-01-01',
      }
      mockBuilder.then.mockImplementation((resolve) => resolve({ data: mockResponse, error: null }))

      await adminService.archiveNewsletter('a1111111-1111-1111-1111-111111111111')

      expect(mockSupabase.from).toHaveBeenCalledWith('newsletters')
      expect(mockBuilder.update).toHaveBeenCalledWith(expect.objectContaining({
        status: 'archived',
      }))
    })
  })
})
