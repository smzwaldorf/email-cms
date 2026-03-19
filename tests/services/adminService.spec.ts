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
  is: vi.fn().mockReturnThis(),
  in: vi.fn().mockReturnThis(),
  ilike: vi.fn().mockReturnThis(),
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
        title: null,
        description: null,
        release_date: '2025-11-30',
        status: 'draft',
      }))
    })

    it('accepts metadata fields when creating a newsletter', async () => {
      const mockResponse = {
        id: 'a3333333-3333-3333-3333-333333333333',
        week_number: null,
        title: 'Special Edition',
        description: 'December update',
        release_date: '2025-12-20',
        status: 'draft',
        created_at: '2025-12-20',
        updated_at: '2025-12-20',
      }
      mockBuilder.then.mockImplementation((resolve) => resolve({ data: mockResponse, error: null }))

      await adminService.createNewsletter(null, '2025-12-20', {
        title: 'Special Edition',
        description: 'December update',
      })

      expect(mockBuilder.insert).toHaveBeenCalledWith(expect.objectContaining({
        title: 'Special Edition',
        description: 'December update',
      }))
    })

    it('throws DUPLICATE_NEWSLETTER_ERROR on duplicate key violation', async () => {
      const error = { code: '23505', message: 'duplicate key value' }
      // @ts-expect-error - mock then signature differs from PromiseLike in test harness
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

  describe('updateNewsletter', () => {
    it('updates draft newsletter metadata', async () => {
      mockBuilder.then
        .mockImplementationOnce((resolve) => resolve({
          data: {
            id: 'newsletter-1',
            week_number: '2025-W48',
            title: 'Before',
            description: null,
            release_date: '2025-11-30',
            status: 'draft',
            created_at: '2025-11-01',
            updated_at: '2025-11-01',
          },
          error: null,
        }))
        .mockImplementationOnce((resolve) => resolve({
          data: {
            id: 'newsletter-1',
            week_number: '2025-W49',
            title: 'After',
            description: 'Updated',
            release_date: '2025-12-07',
            status: 'draft',
            created_at: '2025-11-01',
            updated_at: '2025-11-02',
            newsletter_articles: [{ count: 2 }],
          },
          error: null,
        }))

      const result = await adminService.updateNewsletter('newsletter-1', {
        weekNumber: '2025-W49',
        title: 'After',
        description: 'Updated',
        releaseDate: '2025-12-07',
      })

      expect(mockBuilder.update).toHaveBeenCalledWith(expect.objectContaining({
        week_number: '2025-W49',
        title: 'After',
        description: 'Updated',
        release_date: '2025-12-07',
      }))
      expect(result.weekNumber).toBe('2025-W49')
    })
  })

  describe('getNewsletterPublishReadiness', () => {
    it('flags newsletters without articles as not publishable', async () => {
      mockBuilder.then
        .mockImplementationOnce((resolve) => resolve({
          data: {
            id: 'newsletter-1',
            week_number: '2025-W48',
            title: 'Week 48',
            release_date: '2025-11-30',
            status: 'draft',
            created_at: '2025-11-01',
            updated_at: '2025-11-01',
          },
          error: null,
        }))
        .mockImplementationOnce((resolve) => resolve({ data: [], error: null }))

      const result = await adminService.getNewsletterPublishReadiness('newsletter-1')

      expect(result.canPublish).toBe(false)
      expect(result.issues).toContain('至少需要一篇文章才能發布')
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

  describe('fetchAllArticles', () => {
    it('fetches all non-deleted articles ordered by updated_at', async () => {
      mockBuilder.then.mockImplementationOnce((resolve) => resolve({
        data: [
          {
            id: 'article-1',
            title: 'All Article',
            content: '<p>Content</p>',
            summary: null,
            status: 'draft',
            week_number: '2025-W01',
            article_order: 1,
            class_ids: [],
            family_ids: [],
            created_at: '2025-01-01',
            updated_at: '2025-01-02',
            published_at: null,
            edited_at: null,
          },
        ],
        error: null,
      }))

      const result = await adminService.fetchAllArticles()

      expect(mockSupabase.from).toHaveBeenCalledWith('articles')
      expect(mockBuilder.is).toHaveBeenCalledWith('deleted_at', null)
      expect(result).toHaveLength(1)
      expect(result[0].id).toBe('article-1')
      expect(result[0].weekNumber).toBe('2025-W01')
    })
  })

  describe('article version history', () => {
    it('fetchArticleVersionHistory maps audit entries with diffs', async () => {
      mockBuilder.then.mockImplementationOnce((resolve) => resolve({
        data: [
          {
            id: 'revision-1',
            article_id: 'article-1',
            action: 'update',
            changed_by: 'editor-1',
            changed_at: '2025-11-03T10:00:00Z',
            old_values: { title: 'Before', status: 'draft' },
            new_values: { title: 'After', status: 'published' },
          },
        ],
        error: null,
      }))

      const result = await adminService.fetchArticleVersionHistory('article-1')

      expect(mockSupabase.from).toHaveBeenCalledWith('article_audit_log')
      expect(result).toHaveLength(1)
      expect(result[0].changeSummary).toContain('更新內容')
      expect(result[0].fieldDiffs).toEqual(expect.arrayContaining([
        expect.objectContaining({
          field: 'title',
          before: 'Before',
          after: 'After',
        }),
      ]))
      expect(result[0].canRestore).toBe(true)
    })

    it('restoreArticleVersion applies selected snapshot to article record', async () => {
      mockBuilder.then
        .mockImplementationOnce((resolve) => resolve({
          data: {
            id: 'revision-1',
            article_id: 'article-1',
            action: 'update',
            old_values: { title: 'Before', status: 'draft' },
            new_values: {
              id: 'article-1',
              title: 'After',
              content: '<p>Updated</p>',
              summary: 'new summary',
              status: 'published',
              visibility_type: 'public',
              restricted_to_classes: null,
              author_id: null,
              deleted_at: null,
            },
          },
          error: null,
        }))
        .mockImplementationOnce((resolve) => resolve({
          data: {
            id: 'article-1',
            title: 'After',
            content: '<p>Updated</p>',
            summary: 'new summary',
            status: 'published',
            week_number: '2025-W48',
            article_order: 2,
            class_ids: [],
            family_ids: [],
            author_id: null,
            created_at: '2025-11-01',
            updated_at: '2025-11-03',
            published_at: null,
            edited_at: null,
            last_edited_by: null,
          },
          error: null,
        }))

      const result = await adminService.restoreArticleVersion('article-1', 'revision-1')

      expect(mockSupabase.from).toHaveBeenCalledWith('article_audit_log')
      expect(mockSupabase.from).toHaveBeenCalledWith('articles')
      expect(mockBuilder.update).toHaveBeenCalledWith(expect.objectContaining({
        title: 'After',
        content: '<p>Updated</p>',
        summary: 'new summary',
        status: 'published',
      }))
      expect(result.id).toBe('article-1')
      expect(result.title).toBe('After')
      expect(result.weekNumber).toBe('2025-W48')
    })
  })

  describe('fetchArticleNewsletterMemberships', () => {
    it('returns newsletter tags grouped by article id', async () => {
      mockBuilder.then.mockImplementationOnce((resolve) => resolve({
        data: [
          {
            article_id: 'article-1',
            newsletters: {
              id: 'newsletter-1',
              week_number: '2025-W48',
              title: 'Week 48',
              is_template: false,
            },
          },
          {
            article_id: 'article-1',
            newsletters: {
              id: 'newsletter-2',
              week_number: null,
              title: 'Special Edition',
              is_template: true,
            },
          },
        ],
        error: null,
      }))

      const result = await adminService.fetchArticleNewsletterMemberships(['article-1'])

      expect(mockSupabase.from).toHaveBeenCalledWith('newsletter_articles')
      expect(mockBuilder.in).toHaveBeenCalledWith('article_id', ['article-1'])
      expect(result['article-1']).toEqual([
        { newsletterId: 'newsletter-1', label: '2025-W48', isTemplate: false },
        { newsletterId: 'newsletter-2', label: 'Special Edition', isTemplate: true },
      ])
    })
  })

  describe('article taxonomy management', () => {
    it('fetchArticleCategories defaults to active-only listings', async () => {
      mockBuilder.then.mockImplementationOnce((resolve) => resolve({
        data: [
          {
            id: 'category-1',
            name: '校務公告',
            description: null,
            is_active: true,
            created_at: '2025-01-01',
            updated_at: '2025-01-01',
            deactivated_at: null,
          },
        ],
        error: null,
      }))

      const result = await adminService.fetchArticleCategories()
      expect(mockSupabase.from).toHaveBeenCalledWith('article_categories')
      expect(mockBuilder.eq).toHaveBeenCalledWith('is_active', true)
      expect(result[0].name).toBe('校務公告')
    })

    it('createArticleCategory rejects duplicate active names', async () => {
      mockBuilder.then.mockImplementationOnce((resolve) => resolve({
        data: [{ id: 'existing-category' }],
        error: null,
      }))

      await expect(adminService.createArticleCategory('校務公告'))
        .rejects.toMatchObject({ code: 'ARTICLE_CATEGORY_VALIDATION_ERROR' })
    })

    it('fetchArticleTaxonomyAssignments groups category and tag ids by article', async () => {
      mockBuilder.then
        .mockImplementationOnce((resolve) => resolve({
          data: [{ article_id: 'article-1', category_id: 'category-1' }],
          error: null,
        }))
        .mockImplementationOnce((resolve) => resolve({
          data: [
            { article_id: 'article-1', tag_id: 'tag-1' },
            { article_id: 'article-1', tag_id: 'tag-2' },
          ],
          error: null,
        }))

      const result = await adminService.fetchArticleTaxonomyAssignments(['article-1'])

      expect(mockSupabase.from).toHaveBeenCalledWith('article_category_assignments')
      expect(mockSupabase.from).toHaveBeenCalledWith('article_tag_assignments')
      expect(result['article-1']).toEqual({
        categoryIds: ['category-1'],
        tagIds: ['tag-1', 'tag-2'],
      })
    })

    it('updateArticleTaxonomyAssignments rewrites article assignments', async () => {
      mockBuilder.then
        .mockImplementationOnce((resolve) => resolve({ data: [{ id: 'category-1' }], error: null }))
        .mockImplementationOnce((resolve) => resolve({ data: [{ id: 'tag-1' }], error: null }))
        .mockImplementationOnce((resolve) => resolve({ error: null }))
        .mockImplementationOnce((resolve) => resolve({ error: null }))
        .mockImplementationOnce((resolve) => resolve({ error: null }))
        .mockImplementationOnce((resolve) => resolve({ error: null }))

      await adminService.updateArticleTaxonomyAssignments('article-1', {
        categoryIds: ['category-1'],
        tagIds: ['tag-1'],
      })

      expect(mockBuilder.delete).toHaveBeenCalled()
      expect(mockBuilder.insert).toHaveBeenCalledWith([
        { article_id: 'article-1', category_id: 'category-1' },
      ])
      expect(mockBuilder.insert).toHaveBeenCalledWith([
        { article_id: 'article-1', tag_id: 'tag-1' },
      ])
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

  describe('addArticleToNewsletterById', () => {
    it('adds article using newsletter id directly', async () => {
      mockBuilder.then
        .mockImplementationOnce((resolve) => resolve({ data: [{ article_order: 1 }], error: null }))
        .mockImplementationOnce((resolve) => resolve({
          data: { newsletter_id: 'newsletter-1', article_id: 'article-2', article_order: 2 },
          error: null,
        }))

      await adminService.addArticleToNewsletterById('article-2', 'newsletter-1')

      expect(mockBuilder.insert).toHaveBeenCalledWith(expect.objectContaining({
        newsletter_id: 'newsletter-1',
        article_id: 'article-2',
        article_order: 2,
        targeting_mode: 'shared',
        target_class_ids: [],
      }))
    })

    it('persists targeted class metadata for newsletter-article association', async () => {
      mockBuilder.then
        .mockImplementationOnce((resolve) => resolve({ data: [{ article_order: 0 }], error: null }))
        .mockImplementationOnce((resolve) => resolve({ data: [{ id: 'A1' }, { id: 'B1' }], error: null }))
        .mockImplementationOnce((resolve) => resolve({
          data: { newsletter_id: 'newsletter-1', article_id: 'article-2', article_order: 1 },
          error: null,
        }))

      await adminService.addArticleToNewsletterById('article-2', 'newsletter-1', undefined, undefined, {
        mode: 'targeted',
        classIds: ['A1', 'B1'],
      })

      expect(mockBuilder.insert).toHaveBeenCalledWith(expect.objectContaining({
        targeting_mode: 'targeted',
        target_class_ids: ['A1', 'B1'],
      }))
    })
  })

  describe('updateArticleTargetingInNewsletterById', () => {
    it('rejects targeted mode without class selections', async () => {
      await expect(
        adminService.updateArticleTargetingInNewsletterById('newsletter-1', 'article-1', 'targeted', [])
      ).rejects.toThrow('請至少選擇一個班級')
    })

    it('rejects unknown class IDs', async () => {
      mockBuilder.then.mockImplementationOnce((resolve) => resolve({
        data: [{ id: 'A1' }],
        error: null,
      }))

      await expect(
        adminService.updateArticleTargetingInNewsletterById(
          'newsletter-1',
          'article-1',
          'targeted',
          ['A1', 'UNKNOWN']
        )
      ).rejects.toThrow('Unknown class IDs: UNKNOWN')
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

  describe('createNewsletterFromTemplate', () => {
    it('creates a draft newsletter and copies source articles', async () => {
      mockBuilder.then
        .mockImplementationOnce((resolve) => resolve({
          data: {
            id: 'source-newsletter',
            week_number: '2025-W47',
            title: 'Source',
            description: 'Source desc',
            release_date: '2025-11-23',
            status: 'published',
            is_template: true,
            created_at: '2025-11-20',
            updated_at: '2025-11-20',
          },
          error: null,
        }))
        .mockImplementationOnce((resolve) => resolve({
          data: {
            id: 'new-newsletter',
            week_number: '2025-W48',
            title: 'Source',
            description: 'Source desc',
            release_date: '2025-11-30',
            status: 'draft',
            created_at: '2025-11-24',
            updated_at: '2025-11-24',
          },
          error: null,
        }))
        .mockImplementationOnce((resolve) => resolve({
          data: [
            {
              article_order: 1,
              articles: {
                title: 'Copied article',
                content: '<p>Hello</p>',
                author_id: null,
                author: null,
                summary: null,
                visibility_type: 'public',
                restricted_to_classes: null,
                class_ids: [],
                family_ids: [],
              },
            },
          ],
          error: null,
        }))
        .mockImplementationOnce((resolve) => resolve({
          data: [{ id: 'new-article' }],
          error: null,
        }))
        .mockImplementationOnce((resolve) => resolve({ data: null, error: null }))

      const result = await adminService.createNewsletterFromTemplate('source-newsletter', {
        weekNumber: '2025-W48',
        releaseDate: '2025-11-30',
      })

      expect(mockBuilder.insert).toHaveBeenCalledWith(expect.objectContaining({
        week_number: '2025-W48',
        status: 'draft',
      }))
      expect(mockBuilder.update).not.toHaveBeenCalled()
      expect(result.articleCount).toBe(1)
    })
  })

  describe('createTemplateFromNewsletter', () => {
    it('creates a template newsletter and copies source composition', async () => {
      mockBuilder.then
        .mockImplementationOnce((resolve) => resolve({
          data: {
            id: 'source-newsletter',
            week_number: '2025-W47',
            title: 'Source',
            description: 'Source desc',
            release_date: '2025-11-23',
            status: 'published',
            is_template: false,
            created_at: '2025-11-20',
            updated_at: '2025-11-20',
          },
          error: null,
        }))
        .mockImplementationOnce((resolve) => resolve({
          data: {
            id: 'template-newsletter',
            week_number: null,
            title: 'Template',
            description: 'Template desc',
            release_date: '2025-11-24',
            status: 'draft',
            is_template: true,
            created_at: '2025-11-24',
            updated_at: '2025-11-24',
          },
          error: null,
        }))
        .mockImplementationOnce((resolve) => resolve({
          data: [
            {
              article_order: 1,
              articles: {
                title: 'Copied article',
                content: '<p>Hello</p>',
                author_id: null,
                author: null,
                summary: null,
                visibility_type: 'public',
                restricted_to_classes: null,
                class_ids: [],
                family_ids: [],
              },
            },
          ],
          error: null,
        }))
        .mockImplementationOnce((resolve) => resolve({
          data: [{ id: 'template-article' }],
          error: null,
        }))
        .mockImplementationOnce((resolve) => resolve({ data: null, error: null }))

      const result = await adminService.createTemplateFromNewsletter('source-newsletter', {
        title: 'Template',
        description: 'Template desc',
        releaseDate: '2025-11-24',
      })

      expect(mockBuilder.insert).toHaveBeenCalledWith(expect.objectContaining({
        is_template: true,
        status: 'draft',
      }))
      expect(result.isTemplate).toBe(true)
      expect(result.articleCount).toBe(1)
    })

    it('does not mutate source newsletter records while creating template', async () => {
      mockBuilder.then
        .mockImplementationOnce((resolve) => resolve({
          data: {
            id: 'source-newsletter',
            week_number: '2025-W47',
            title: 'Source',
            description: 'Source desc',
            release_date: '2025-11-23',
            status: 'published',
            is_template: false,
            created_at: '2025-11-20',
            updated_at: '2025-11-20',
          },
          error: null,
        }))
        .mockImplementationOnce((resolve) => resolve({
          data: {
            id: 'template-newsletter',
            week_number: null,
            title: 'Template',
            description: 'Template desc',
            release_date: '2025-11-24',
            status: 'draft',
            is_template: true,
            created_at: '2025-11-24',
            updated_at: '2025-11-24',
          },
          error: null,
        }))
        .mockImplementationOnce((resolve) => resolve({ data: [], error: null }))

      await adminService.createTemplateFromNewsletter('source-newsletter')

      expect(mockBuilder.update).not.toHaveBeenCalled()
      expect(mockBuilder.delete).not.toHaveBeenCalled()
    })
  })

  describe('template instantiation safety', () => {
    it('does not mutate template newsletter records while creating newsletter from template', async () => {
      mockBuilder.then
        .mockImplementationOnce((resolve) => resolve({
          data: {
            id: 'source-template',
            week_number: null,
            title: 'Template',
            description: 'Template desc',
            release_date: '2025-11-23',
            status: 'draft',
            is_template: true,
            created_at: '2025-11-20',
            updated_at: '2025-11-20',
          },
          error: null,
        }))
        .mockImplementationOnce((resolve) => resolve({
          data: {
            id: 'new-newsletter',
            week_number: '2025-W48',
            title: 'From template',
            description: 'Copied',
            release_date: '2025-11-30',
            status: 'draft',
            is_template: false,
            created_at: '2025-11-24',
            updated_at: '2025-11-24',
          },
          error: null,
        }))
        .mockImplementationOnce((resolve) => resolve({ data: [], error: null }))

      await adminService.createNewsletterFromTemplate('source-template', {
        weekNumber: '2025-W48',
        releaseDate: '2025-11-30',
      })

      expect(mockBuilder.update).not.toHaveBeenCalled()
      expect(mockBuilder.delete).not.toHaveBeenCalled()
    })
  })

  describe('newsletter composition workflows', () => {
    it('creates and attaches a draft article for a newsletter', async () => {
      mockBuilder.then
        .mockImplementationOnce((resolve) => resolve({
          data: {
            id: 'newsletter-1',
            week_number: '2025-W48',
            title: 'Week 48',
            description: null,
            release_date: '2025-11-30',
            status: 'draft',
            is_template: false,
            created_at: '2025-11-01',
            updated_at: '2025-11-01',
          },
          error: null,
        }))
        .mockImplementationOnce((resolve) => resolve({
          data: [{ article_order: 2 }],
          error: null,
        }))
        .mockImplementationOnce((resolve) => resolve({
          data: {
            id: 'article-3',
            title: '未命名文章',
            content: '',
            author: null,
            summary: null,
            status: 'draft',
            class_ids: [],
            family_ids: [],
            created_at: '2025-11-02',
            updated_at: '2025-11-02',
            last_edited_by: null,
            edited_at: '2025-11-02T00:00:00Z',
          },
          error: null,
        }))
        .mockImplementationOnce((resolve) => resolve({
          data: {
            id: 'link-1',
            newsletter_id: 'newsletter-1',
            article_id: 'article-3',
            article_order: 3,
          },
          error: null,
        }))

      const created = await adminService.createArticleForNewsletter('newsletter-1')

      const insertPayloads = mockBuilder.insert.mock.calls.map((call) => call[0])
      expect(insertPayloads).toEqual(expect.arrayContaining([
        expect.objectContaining({
          title: '未命名文章',
          status: 'draft',
          week_number: '2025-W48',
          article_order: 3,
        }),
        expect.objectContaining({
          newsletter_id: 'newsletter-1',
          article_id: 'article-3',
          article_order: 3,
        }),
      ]))
      expect(created.id).toBe('article-3')
      expect(created.order).toBe(3)
    })

    it('unlinks an article from newsletter composition by id', async () => {
      mockBuilder.then.mockImplementationOnce((resolve) => resolve({ error: null }))

      await adminService.removeArticleFromNewsletterById('article-1', 'newsletter-1')

      expect(mockSupabase.from).toHaveBeenCalledWith('newsletter_articles')
      expect(mockBuilder.delete).toHaveBeenCalled()
      expect(mockBuilder.eq).toHaveBeenCalledWith('newsletter_id', 'newsletter-1')
      expect(mockBuilder.eq).toHaveBeenCalledWith('article_id', 'article-1')
    })

    it('persists reordered article order for every linked article', async () => {
      mockBuilder.then
        .mockImplementationOnce((resolve) => resolve({ data: [{ article_order: 3 }], error: null }))
        .mockImplementationOnce((resolve) => resolve({ error: null }))
        .mockImplementationOnce((resolve) => resolve({ error: null }))
        .mockImplementationOnce((resolve) => resolve({ error: null }))
        .mockImplementationOnce((resolve) => resolve({ error: null }))
        .mockImplementationOnce((resolve) => resolve({ error: null }))
        .mockImplementationOnce((resolve) => resolve({ error: null }))

      await adminService.reorderArticlesInNewsletterById('newsletter-1', [
        'article-3',
        'article-1',
        'article-2',
      ])

      expect(mockBuilder.update).toHaveBeenNthCalledWith(1, { article_order: 107 })
      expect(mockBuilder.update).toHaveBeenNthCalledWith(2, { article_order: 108 })
      expect(mockBuilder.update).toHaveBeenNthCalledWith(3, { article_order: 109 })
      expect(mockBuilder.update).toHaveBeenNthCalledWith(4, { article_order: 1 })
      expect(mockBuilder.update).toHaveBeenNthCalledWith(5, { article_order: 2 })
      expect(mockBuilder.update).toHaveBeenNthCalledWith(6, { article_order: 3 })
      expect(mockBuilder.eq).toHaveBeenCalledWith('newsletter_id', 'newsletter-1')
    })
  })

  describe('class lifecycle workflows', () => {
    it('fetchClasses defaults to active-only listings', async () => {
      mockBuilder.then
        .mockImplementationOnce((resolve) => resolve({
          data: [
            {
              id: 'G6A',
              class_code: 'G6A',
              class_name: '六年級A班',
              class_grade_year: 6,
              description: 'desc',
              is_active: true,
              created_at: '2025-01-01',
              updated_at: '2025-01-02',
            },
          ],
          error: null,
        }))
        .mockImplementationOnce((resolve) => resolve({ data: [], error: null }))
        .mockImplementationOnce((resolve) => resolve({ data: [], error: null }))

      await adminService.fetchClasses()

      expect(mockBuilder.eq).toHaveBeenCalledWith('is_active', true)
    })

    it('allows including inactive classes in listings', async () => {
      mockBuilder.then
        .mockImplementationOnce((resolve) => resolve({
          data: [
            {
              id: 'G6A',
              class_code: 'G6A',
              class_name: '六年級A班',
              class_grade_year: 6,
              description: 'desc',
              is_active: false,
              created_at: '2025-01-01',
              updated_at: '2025-01-02',
              deactivated_at: '2025-01-03',
            },
          ],
          error: null,
        }))
        .mockImplementationOnce((resolve) => resolve({ data: [], error: null }))
        .mockImplementationOnce((resolve) => resolve({ data: [], error: null }))

      const result = await adminService.fetchClasses({ includeInactive: true })
      expect(result[0].isActive).toBe(false)
      expect(mockBuilder.eq).not.toHaveBeenCalledWith('is_active', true)
    })

    it('rejects duplicate class codes during create', async () => {
      mockBuilder.then
        .mockImplementationOnce((resolve) => resolve({ data: [{ id: 'EXISTING' }], error: null }))
        .mockImplementationOnce((resolve) => resolve({ data: [], error: null }))

      await expect(
        adminService.createClass('六年級A班', 'desc', [], [], { code: 'G6A', gradeYear: 6 })
      ).rejects.toMatchObject({ code: 'CLASS_VALIDATION_ERROR' })
    })

    it('deactivates classes via lifecycle API', async () => {
      mockBuilder.then
        .mockImplementationOnce((resolve) => resolve({
          data: {
            id: 'G6A',
            class_name: '六年級A班',
            class_grade_year: 6,
            description: null,
            is_active: true,
            created_at: '2025-01-01',
            updated_at: '2025-01-01',
          },
          error: null,
        }))
        .mockImplementationOnce((resolve) => resolve({
          data: {
            id: 'G6A',
            class_code: 'G6A',
            class_name: '六年級A班',
            class_grade_year: 6,
            description: null,
            is_active: false,
            deactivated_at: '2025-01-03',
            created_at: '2025-01-01',
            updated_at: '2025-01-03',
          },
          error: null,
        }))
        .mockImplementationOnce((resolve) => resolve({ data: null, error: null }))

      const result = await adminService.deactivateClass('G6A')
      expect(result.isActive).toBe(false)
      expect(mockBuilder.update).toHaveBeenCalledWith({ is_active: false })
    })

    it('reactivates previously inactive classes via lifecycle API', async () => {
      mockBuilder.then
        .mockImplementationOnce((resolve) => resolve({
          data: {
            id: 'G6A',
            class_name: '六年級A班',
            class_grade_year: 6,
            description: null,
            is_active: false,
            deactivated_at: '2025-01-03',
            created_at: '2025-01-01',
            updated_at: '2025-01-03',
          },
          error: null,
        }))
        .mockImplementationOnce((resolve) => resolve({
          data: {
            id: 'G6A',
            class_code: 'G6A',
            class_name: '六年級A班',
            class_grade_year: 6,
            description: null,
            is_active: true,
            deactivated_at: null,
            created_at: '2025-01-01',
            updated_at: '2025-01-04',
          },
          error: null,
        }))
        .mockImplementationOnce((resolve) => resolve({ data: null, error: null }))

      const result = await adminService.activateClass('G6A')
      expect(result.isActive).toBe(true)
      expect(result.deactivatedAt).toBeNull()
      expect(mockBuilder.update).toHaveBeenCalledWith({ is_active: true })
    })
  })

  describe('teacher lifecycle workflows', () => {
    it('fetchTeachers defaults to active teachers only', async () => {
      mockBuilder.then.mockImplementationOnce((resolve) => resolve({
        data: [
          {
            id: 'teacher-1',
            email: 'teacher1@example.com',
            role: 'teacher',
            created_at: '2025-01-01',
            updated_at: '2025-01-01',
            teacher_profiles: [
              {
                display_name: '王老師',
                status: 'active',
                is_active: true,
                updated_at: '2025-01-02',
              },
            ],
          },
        ],
        error: null,
      }))

      const teachers = await adminService.fetchTeachers()
      expect(mockBuilder.eq).toHaveBeenCalledWith('teacher_profiles.is_active', true)
      expect(teachers[0].status).toBe('active')
      expect(teachers[0].name).toBe('王老師')
    })

    it('allows includeInactive option when fetching teachers', async () => {
      mockBuilder.then.mockImplementationOnce((resolve) => resolve({
        data: [
          {
            id: 'teacher-2',
            email: 'teacher2@example.com',
            role: 'teacher',
            created_at: '2025-01-01',
            updated_at: '2025-01-01',
            teacher_profiles: [
              {
                display_name: '李老師',
                status: 'disabled',
                is_active: false,
                updated_at: '2025-01-03',
              },
            ],
          },
        ],
        error: null,
      }))

      const teachers = await adminService.fetchTeachers({ includeInactive: true })
      expect(teachers[0].status).toBe('disabled')
      expect(mockBuilder.eq).not.toHaveBeenCalledWith('teacher_profiles.is_active', true)
    })

    it('deactivates teacher profile and returns disabled status', async () => {
      mockBuilder.then
        .mockImplementationOnce((resolve) => resolve({
          data: {
            id: 'teacher-3',
            email: 'teacher3@example.com',
            role: 'teacher',
            created_at: '2025-01-01',
            updated_at: '2025-01-01',
            teacher_profiles: [
              {
                display_name: '陳老師',
                status: 'active',
                is_active: true,
                deactivated_at: null,
                updated_at: '2025-01-01',
              },
            ],
          },
          error: null,
        }))
        .mockImplementationOnce((resolve) => resolve({ data: null, error: null }))
        .mockImplementationOnce((resolve) => resolve({
          data: {
            user_id: 'teacher-3',
            display_name: '陳老師',
            status: 'disabled',
            is_active: false,
            deactivated_at: '2025-01-03T00:00:00Z',
            updated_at: '2025-01-03T00:00:00Z',
          },
          error: null,
        }))
        .mockImplementationOnce((resolve) => resolve({ data: null, error: null }))

      const result = await adminService.deactivateTeacher('teacher-3')
      expect(mockBuilder.update).toHaveBeenCalledWith({ is_active: false })
      expect(result.status).toBe('disabled')
    })

    it('reactivates teacher profile and clears deactivated state', async () => {
      mockBuilder.then
        .mockImplementationOnce((resolve) => resolve({
          data: {
            id: 'teacher-4',
            email: 'teacher4@example.com',
            role: 'teacher',
            created_at: '2025-01-01',
            updated_at: '2025-01-01',
            teacher_profiles: [
              {
                display_name: '林老師',
                status: 'disabled',
                is_active: false,
                deactivated_at: '2025-01-02T00:00:00Z',
                updated_at: '2025-01-02T00:00:00Z',
              },
            ],
          },
          error: null,
        }))
        .mockImplementationOnce((resolve) => resolve({ data: null, error: null }))
        .mockImplementationOnce((resolve) => resolve({
          data: {
            user_id: 'teacher-4',
            display_name: '林老師',
            status: 'active',
            is_active: true,
            deactivated_at: null,
            updated_at: '2025-01-04T00:00:00Z',
          },
          error: null,
        }))
        .mockImplementationOnce((resolve) => resolve({ data: null, error: null }))

      const result = await adminService.activateTeacher('teacher-4')
      expect(mockBuilder.update).toHaveBeenCalledWith({ is_active: true })
      expect(result.status).toBe('active')
    })

    it('rejects duplicate teacher email during createTeacher', async () => {
      mockBuilder.then.mockImplementationOnce((resolve) =>
        resolve({
          data: [{ id: 'existing-teacher', role: 'teacher' }],
          error: null,
        }),
      )

      await expect(
        adminService.createTeacher('teacher1@example.com', '王老師'),
      ).rejects.toMatchObject({ code: 'TEACHER_VALIDATION_ERROR' })
    })

    it('rejects duplicate teacher email during updateTeacher validation', async () => {
      mockBuilder.then
        .mockImplementationOnce((resolve) =>
          resolve({
            data: {
              id: 'teacher-5',
              email: 'teacher5@example.com',
              role: 'teacher',
              created_at: '2025-01-01',
              updated_at: '2025-01-01',
              teacher_profiles: [
                {
                  display_name: '趙老師',
                  status: 'active',
                  is_active: true,
                },
              ],
            },
            error: null,
          }),
        )
        .mockImplementationOnce((resolve) =>
          resolve({
            data: [{ id: 'another-user', role: 'teacher' }],
            error: null,
          }),
        )

      await expect(
        adminService.updateTeacher('teacher-5', { name: '趙老師(更新)' }),
      ).rejects.toMatchObject({ code: 'TEACHER_VALIDATION_ERROR' })
    })
  })
})
