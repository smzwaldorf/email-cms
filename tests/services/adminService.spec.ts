import { describe, it, expect, vi, beforeEach } from 'vitest'
import { adminService } from '@/services/adminService'

// Mock Supabase client
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
    it('maps is_published=true to status=published', async () => {
      const mockData = [
        {
          id: '2025-W01',
          week_number: '2025-W01',
          release_date: '2025-01-01',
          is_published: true,
          created_at: '2025-01-01',
          updated_at: '2025-01-01',
          articles: [{ count: 5 }],
        },
      ]
      mockBuilder.then.mockImplementation((resolve) => resolve({ data: mockData, error: null }))

      const result = await adminService.fetchNewsletters()

      expect(result[0].status).toBe('published')
      expect(result[0].isPublished).toBe(true)
    })

    it('maps is_published=false to status=draft', async () => {
      const mockData = [
        {
          id: '2025-W02',
          week_number: '2025-W02',
          release_date: '2025-01-08',
          is_published: false,
          created_at: '2025-01-08',
          updated_at: '2025-01-08',
          articles: [{ count: 0 }],
        },
      ]
      mockBuilder.then.mockImplementation((resolve) => resolve({ data: mockData, error: null }))

      const result = await adminService.fetchNewsletters()

      expect(result[0].status).toBe('draft')
      expect(result[0].isPublished).toBe(false)
    })
  })

  describe('createNewsletter', () => {
    it('inserts with correct fields and no article_count', async () => {
      const mockResponse = {
        id: '2025-W48',
        week_number: '2025-W48',
        release_date: '2025-11-30',
        is_published: false,
        created_at: '2025-11-30',
        updated_at: '2025-11-30',
      }
      mockBuilder.then.mockImplementation((resolve) => resolve({ data: mockResponse, error: null }))

      await adminService.createNewsletter('2025-W48', '2025-11-30')

      expect(mockSupabase.from).toHaveBeenCalledWith('newsletter_weeks')
      expect(mockBuilder.insert).toHaveBeenCalledWith({
        week_number: '2025-W48',
        release_date: '2025-11-30',
        is_published: false,
      })
      // Verify article_count is NOT in the call
      expect(mockBuilder.insert).not.toHaveBeenCalledWith(expect.objectContaining({ article_count: 0 }))
      expect(mockBuilder.insert).not.toHaveBeenCalledWith(expect.objectContaining({ status: 'draft' }))
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
    it('updates is_published to true', async () => {
      // Mock article check (first call) and update response (second call)
      const mockArticleResponse = { data: [{ id: 'article-1' }], error: null }
      const mockUpdateResponse = {
        data: {
          id: '2025-W01',
          week_number: '2025-W01',
          release_date: '2025-01-01',
          is_published: true,
          created_at: '2025-01-01',
          updated_at: '2025-01-01',
        },
        error: null
      }

      mockBuilder.then
        .mockImplementationOnce((resolve) => resolve(mockArticleResponse))
        .mockImplementationOnce((resolve) => resolve(mockUpdateResponse))

      await adminService.publishNewsletter('1')

      expect(mockSupabase.from).toHaveBeenCalledWith('newsletter_weeks')
      expect(mockBuilder.update).toHaveBeenCalledWith(expect.objectContaining({
        is_published: true,
      }))
      expect(mockBuilder.update).not.toHaveBeenCalledWith(expect.objectContaining({
        status: 'published',
      }))
    })
  })

  describe('archiveNewsletter', () => {
    it('updates is_published to false', async () => {
      const mockResponse = {
        id: '2025-W01',
        week_number: '2025-W01',
        release_date: '2025-01-01',
        is_published: false,
        created_at: '2025-01-01',
        updated_at: '2025-01-01',
      }
      mockBuilder.then.mockImplementation((resolve) => resolve({ data: mockResponse, error: null }))

      await adminService.archiveNewsletter('1')

      expect(mockSupabase.from).toHaveBeenCalledWith('newsletter_weeks')
      expect(mockBuilder.update).toHaveBeenCalledWith({ is_published: false })
      expect(mockBuilder.update).not.toHaveBeenCalledWith(expect.objectContaining({
        status: 'archived',
      }))
    })
  })
})
