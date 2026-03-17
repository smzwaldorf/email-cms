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
  then: vi.fn((resolve) => resolve({ data: [], error: null })),
}

const mockSupabase = {
  from: vi.fn(() => mockBuilder),
  rpc: vi.fn(),
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
    mockSupabase.rpc.mockResolvedValue({ data: null, error: null })
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


    it('creates newsletter without week_number (special edition)', async () => {
      const mockResponse = {
        id: 'a4444444-4444-4444-4444-444444444444',
        week_number: null,
        title: 'Special Edition',
        release_date: '2025-12-25',
        status: 'draft',
        created_at: '2025-12-25',
        updated_at: '2025-12-25',
      }
      mockBuilder.then.mockImplementation((resolve) => resolve({ data: mockResponse, error: null }))

      await adminService.createNewsletter(null, '2025-12-25')

      expect(mockSupabase.from).toHaveBeenCalledWith('newsletters')
      expect(mockBuilder.insert).toHaveBeenCalledWith(expect.objectContaining({
        week_number: null,
        release_date: '2025-12-25',
        status: 'draft',
      }))
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

  describe('admin user role RPCs', () => {
    it('createUser uses the admin_create_user_role RPC', async () => {
      const createdAt = '2025-01-01T00:00:00.000Z'
      mockSupabase.rpc.mockResolvedValue({
        data: {
          id: 'u1111111-1111-1111-1111-111111111111',
          email: 'teacher@example.com',
          role: 'teacher',
          created_at: createdAt,
          updated_at: createdAt,
          last_login_at: null,
        },
        error: null,
      })

      const result = await adminService.createUser(
        'teacher@example.com',
        'Teacher',
        'teacher',
        'active'
      )

      expect(mockSupabase.rpc).toHaveBeenCalledWith(
        'admin_create_user_role',
        expect.objectContaining({
          target_email: 'teacher@example.com',
          target_role: 'teacher',
          target_user_id: expect.any(String),
        })
      )
      expect(result.email).toBe('teacher@example.com')
      expect(result.role).toBe('teacher')
      expect(result.status).toBe('active')
    })

    it('updateUser uses the admin_update_user_role RPC', async () => {
      const updatedAt = '2025-01-02T00:00:00.000Z'
      mockSupabase.rpc.mockResolvedValue({
        data: {
          id: 'u2222222-2222-2222-2222-222222222222',
          email: 'parent@example.com',
          role: 'admin',
          created_at: '2025-01-01T00:00:00.000Z',
          updated_at: updatedAt,
          last_login_at: null,
        },
        error: null,
      })

      const result = await adminService.updateUser(
        'u2222222-2222-2222-2222-222222222222',
        { role: 'admin', status: 'active', name: 'Parent Admin' }
      )

      expect(mockSupabase.rpc).toHaveBeenCalledWith('admin_update_user_role', {
        target_user_id: 'u2222222-2222-2222-2222-222222222222',
        target_role: 'admin',
      })
      expect(result.role).toBe('admin')
      expect(result.status).toBe('active')
    })

    it('deleteUser uses the admin_delete_user_role RPC', async () => {
      mockSupabase.rpc.mockResolvedValue({ data: true, error: null })

      await adminService.deleteUser('u3333333-3333-3333-3333-333333333333')

      expect(mockSupabase.rpc).toHaveBeenCalledWith('admin_delete_user_role', {
        target_user_id: 'u3333333-3333-3333-3333-333333333333',
      })
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


  describe('fetchArticlesByNewsletterId', () => {
    it('fetches articles using junction table', async () => {
      const newsletterId = 'a1111111-1111-1111-1111-111111111111'
      const mockJunctionData = [
        {
          article_order: 1,
          articles: {
            id: 'article-1',
            title: 'Test Article',
            content: 'Content',
            status: 'published',
            author_id: 'user-1',
            created_at: '2025-01-01',
            updated_at: '2025-01-01',
          }
        }
      ]
      const mockNewsletterData = {
        id: newsletterId,
        week_number: '2025-W01',
        title: 'Week 1',
      }

      // First call: fetch articles from junction
      // Second call: fetch newsletter details
      mockBuilder.then
        .mockImplementationOnce((resolve) => resolve({ data: mockJunctionData, error: null }))
        .mockImplementationOnce((resolve) => resolve({ data: mockNewsletterData, error: null }))

      const result = await adminService.fetchArticlesByNewsletterId(newsletterId)

      expect(result).toHaveLength(1)
      expect(result[0].id).toBe('article-1')
      expect(result[0].weekNumber).toBe('2025-W01')
      expect(result[0].order).toBe(1)
    })
  })

  describe('addArticleToNewsletter', () => {
    it('adds article to junction table with order', async () => {
      // Mock getNewsletterIdByWeek (internal call)
      const mockNewsletterId = 'a1111111-1111-1111-1111-111111111111'
      const mockNewsletterResponse = { data: { id: mockNewsletterId }, error: null }
      
      // Mock insert response
      const mockInsertResponse = { 
        data: { 
          newsletter_id: mockNewsletterId, 
          article_id: 'article-1', 
          article_order: 5 
        }, 
        error: null 
      }

      mockBuilder.then
        .mockImplementationOnce((resolve) => resolve(mockNewsletterResponse)) // getNewsletterIdByWeek
        .mockImplementationOnce((resolve) => resolve(mockInsertResponse))     // insert

      await adminService.addArticleToNewsletter('article-1', '2025-W01', 5)

      expect(mockSupabase.from).toHaveBeenCalledWith('newsletter_articles')
      expect(mockBuilder.insert).toHaveBeenCalledWith(expect.objectContaining({
        newsletter_id: mockNewsletterId,
        article_id: 'article-1',
        article_order: 5
      }))
    })

    it('auto-increments order if not provided', async () => {
      const mockNewsletterId = 'a1111111-1111-1111-1111-111111111111'
      
      // 1. getNewsletterIdByWeek
      // 2. get max order
      // 3. insert
      
      mockBuilder.then
        .mockImplementationOnce((resolve) => resolve({ data: { id: mockNewsletterId }, error: null }))
        .mockImplementationOnce((resolve) => resolve({ data: [{ article_order: 4 }], error: null }))
        .mockImplementationOnce((resolve) => resolve({ data: {}, error: null }))

      await adminService.addArticleToNewsletter('article-1', '2025-W01')

      expect(mockBuilder.insert).toHaveBeenCalledWith(expect.objectContaining({
        article_order: 5
      }))
    })

    it('throws error if article already in newsletter', async () => {
          const mockNewsletterId = 'a1111111-1111-1111-1111-111111111111'
      const duplicateError = { code: '23505', message: 'duplicate key' }

      mockBuilder.then
        .mockImplementationOnce((resolve) => resolve({ data: { id: mockNewsletterId }, error: null }))
        .mockImplementationOnce((resolve) => resolve({ data: null, error: duplicateError }))

      await expect(adminService.addArticleToNewsletter('article-1', '2025-W01', 1))
        .rejects.toThrow('Article is already in newsletter')
    })
  })

  describe('removeArticleFromNewsletter', () => {
    it('removes article from junction table', async () => {
      const mockNewsletterId = 'a1111111-1111-1111-1111-111111111111'

      mockBuilder.then
        .mockImplementationOnce((resolve) => resolve({ data: { id: mockNewsletterId }, error: null }))
        .mockImplementationOnce((resolve) => resolve({ error: null }))

      await adminService.removeArticleFromNewsletter('article-1', '2025-W01')

      expect(mockSupabase.from).toHaveBeenCalledWith('newsletter_articles')
      expect(mockBuilder.delete).toHaveBeenCalled()
      expect(mockBuilder.eq).toHaveBeenCalledWith('newsletter_id', mockNewsletterId)
    })
  })
})
