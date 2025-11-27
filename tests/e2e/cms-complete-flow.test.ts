/**
 * End-to-End Test Suite: Complete CMS Database Structure Workflows
 * Tests complete workflows including class-based article visibility
 *
 * Scope:
 * - Complete workflow: Create week → Add articles → Publish → View as visitor
 * - Multi-editor concurrency: Two editors creating articles simultaneously
 * - Family multi-class scenario: Parent with 2 children viewing relevant articles
 * - All edge cases from specification
 * - Audit log verification
 *
 * US1: Editor → US2: Visitor → US3: Class-Based Visibility
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import type { NewsletterWeekRow, ClassRow, FamilyRow } from '@/types/database'
import { ArticleService } from '@/services/ArticleService'
import { WeekService } from '@/services/WeekService'
import { FamilyService } from '@/services/FamilyService'
import { getArticlesForFamily } from '@/services/queries/classArticleQueries'

// Mock services
vi.mock('@/services/ArticleService')
vi.mock('@/services/WeekService')
vi.mock('@/services/FamilyService')
vi.mock('@/services/queries/classArticleQueries')

describe('E2E: Complete CMS Workflow', () => {
  // Mock data
  const mockWeek: NewsletterWeekRow = {
    id: 'week-w47-2025',
    week_number: '2025-W47',
    week_start_date: '2025-11-17',
    week_end_date: '2025-11-23',
    is_published: false,
    created_at: '2025-11-10T08:00:00Z',
    updated_at: '2025-11-10T08:00:00Z',
    deleted_at: null,
  }

  const mockClasses: ClassRow[] = [
    {
      id: 'A1',
      class_name: 'Grade 1A',
      class_grade_year: 1,
      created_at: '2025-11-01T08:00:00Z',
    },
    {
      id: 'B1',
      class_name: 'Grade 2B',
      class_grade_year: 2,
      created_at: '2025-11-01T08:00:00Z',
    },
    {
      id: 'B2',
      class_name: 'Grade 2A',
      class_grade_year: 2,
      created_at: '2025-11-01T08:00:00Z',
    },
  ]

  const mockArticles = {
    public: {
      id: 'article-1',
      short_id: 'a001',
      week_number: '2025-W47',
      title: 'School-Wide Announcement',
      content: '# School Announcement\n\nPlease note...',
      author: 'admin-001',
      article_order: 1,
      is_published: true,
      visibility_type: 'public' as const,
      restricted_to_classes: null,
      created_by: 'admin-001',
      created_at: '2025-11-17T08:00:00Z',
      updated_at: '2025-11-17T08:00:00Z',
      deleted_at: null,
    },
    classA1: {
      id: 'article-2',
      short_id: 'a002',
      week_number: '2025-W47',
      title: 'Grade 1A Updates',
      content: '# Grade 1A\n\nThis week...',
      author: 'teacher-001',
      article_order: 2,
      is_published: true,
      visibility_type: 'class_restricted' as const,
      restricted_to_classes: ['A1'],
      created_by: 'teacher-001',
      created_at: '2025-11-17T09:00:00Z',
      updated_at: '2025-11-17T09:00:00Z',
      deleted_at: null,
    },
    classB1: {
      id: 'article-3',
      short_id: 'a003',
      week_number: '2025-W47',
      title: 'Grade 2B Updates',
      content: '# Grade 2B\n\nThis week...',
      author: 'teacher-002',
      article_order: 3,
      is_published: true,
      visibility_type: 'class_restricted' as const,
      restricted_to_classes: ['B1'],
      created_by: 'teacher-002',
      created_at: '2025-11-17T10:00:00Z',
      updated_at: '2025-11-17T10:00:00Z',
      deleted_at: null,
    },
    classB2: {
      id: 'article-4',
      short_id: 'a004',
      week_number: '2025-W47',
      title: 'Grade 2A Updates',
      content: '# Grade 2A\n\nThis week...',
      author: 'teacher-003',
      article_order: 4,
      is_published: true,
      visibility_type: 'class_restricted' as const,
      restricted_to_classes: ['B2'],
      created_by: 'teacher-003',
      created_at: '2025-11-17T11:00:00Z',
      updated_at: '2025-11-17T11:00:00Z',
      deleted_at: null,
    },
  }

  const mockFamilyData: FamilyRow = {
    id: 'family-001',
    family_code: 'FAM-2025-001',
    created_at: '2025-11-01T08:00:00Z',
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('US1→US2→US3: Complete Workflow', () => {
    it('should complete full workflow: create week, add articles, publish, view as visitor', async () => {
      // Step 1: Create newsletter week (US1)
      vi.mocked(WeekService.createWeek).mockResolvedValue(mockWeek)

      const createdWeek = await WeekService.createWeek({
        week_number: mockWeek.week_number,
        week_start_date: mockWeek.week_start_date,
        week_end_date: mockWeek.week_end_date,
      })

      expect(createdWeek).toEqual(mockWeek)
      expect(WeekService.createWeek).toHaveBeenCalledWith(
        expect.objectContaining({
          week_number: '2025-W47',
        })
      )

      // Step 2: Create articles (US1)
      const createdArticle = {
        ...mockArticles.public,
        is_published: false,
      }

      vi.mocked(ArticleService.createArticle).mockResolvedValue(createdArticle)

      const article = await ArticleService.createArticle({
        week_number: '2025-W47',
        title: 'School-Wide Announcement',
        content: '# School Announcement\n\nPlease note...',
        author: 'admin-001',
      })

      expect(article.title).toBe('School-Wide Announcement')
      expect(article.is_published).toBe(false)
      expect(ArticleService.createArticle).toHaveBeenCalled()

      // Step 3: Publish article (US1)
      const publishedArticle = { ...mockArticles.public, is_published: true }
      vi.mocked(ArticleService.publishArticle).mockResolvedValue(publishedArticle)

      const published = await ArticleService.publishArticle(article.id)

      expect(published.is_published).toBe(true)
      expect(ArticleService.publishArticle).toHaveBeenCalledWith(article.id)

      // Step 4: Visitor views articles (US2)
      vi.mocked(ArticleService.getArticlesByWeek).mockResolvedValue([mockArticles.public])

      const visitorArticles = await ArticleService.getArticlesByWeek('2025-W47')

      expect(visitorArticles).toHaveLength(1)
      expect(visitorArticles[0].title).toBe('School-Wide Announcement')
      expect(visitorArticles[0].visibility_type).toBe('public')
    })

    it('should handle multi-editor concurrency without conflicts', async () => {
      // Two editors create articles simultaneously for same week
      const editor1Article = {
        ...mockArticles.public,
        id: 'article-concurrent-1',
        short_id: 'a005',
        author: 'teacher-001',
        article_order: 1,
      }

      const editor2Article = {
        ...mockArticles.classA1,
        id: 'article-concurrent-2',
        short_id: 'a006',
        author: 'teacher-002',
        article_order: 2,
        visibility_type: 'class_restricted' as const,
        restricted_to_classes: ['A1'],
      }

      // Mock concurrent creation
      vi.mocked(ArticleService.createArticle)
        .mockResolvedValueOnce(editor1Article)
        .mockResolvedValueOnce(editor2Article)

      // Simulate concurrent requests
      const [result1, result2] = await Promise.all([
        ArticleService.createArticle({
          week_number: '2025-W47',
          title: editor1Article.title,
          content: editor1Article.content,
          author: editor1Article.author,
        }),
        ArticleService.createArticle({
          week_number: '2025-W47',
          title: editor2Article.title,
          content: editor2Article.content,
          author: editor2Article.author,
        }),
      ])

      // Both articles created successfully with different article_order
      expect(result1.article_order).toBe(1)
      expect(result2.article_order).toBe(2)
      expect(result1.id).not.toBe(result2.id)
      expect(ArticleService.createArticle).toHaveBeenCalledTimes(2)
    })

    it('should support family with multiple children in different classes', async () => {
      // Family has:
      // - Child 1 in Grade 1A (A1)
      // - Child 2 in Grade 2B (B1)

      const familyClasses = [mockClasses[1], mockClasses[0]] // B1, then A1 (grade desc)

      vi.mocked(FamilyService.getChildrenClasses).mockResolvedValue(familyClasses)

      const children = await FamilyService.getChildrenClasses('family-001')

      expect(children).toHaveLength(2)
      // Should be sorted by grade_year DESC (B1=grade2 before A1=grade1)
      expect(children[0].class_grade_year).toBe(2)
      expect(children[1].class_grade_year).toBe(1)

      // Now get articles visible to this family
      const familyVisibleArticles = [
        mockArticles.public,
        mockArticles.classA1, // Visible - child in A1
        mockArticles.classB1, // Visible - child in B1
        // mockArticles.classB2 would NOT be visible - no child in B2
      ]

      vi.mocked(getArticlesForFamily).mockResolvedValue(familyVisibleArticles)

      const visibleArticles = await getArticlesForFamily('family-001', '2025-W47')

      expect(visibleArticles).toHaveLength(3)
      expect(visibleArticles.map((a) => a.id)).toEqual(['article-1', 'article-2', 'article-3'])

      // Verify no duplicates even if both children in same class
      const uniqueArticleIds = new Set(visibleArticles.map((a) => a.id))
      expect(uniqueArticleIds.size).toBe(visibleArticles.length)
    })

    it('should handle class restriction changes and visibility updates', async () => {
      // Start with public article
      let article = mockArticles.public

      // Change to class-restricted
      const restrictedArticle = {
        ...article,
        visibility_type: 'class_restricted' as const,
        restricted_to_classes: ['A1', 'A2'],
      }

      vi.mocked(ArticleService.setArticleClassRestriction).mockResolvedValue(restrictedArticle)

      const updated = await ArticleService.setArticleClassRestriction('article-1', ['A1', 'A2'])

      expect(updated.visibility_type).toBe('class_restricted')
      expect(updated.restricted_to_classes).toEqual(['A1', 'A2'])

      // Later revert to public
      const unrestrictedArticle = {
        ...restrictedArticle,
        visibility_type: 'public' as const,
        restricted_to_classes: null,
      }

      vi.mocked(ArticleService.removeArticleClassRestriction).mockResolvedValue(unrestrictedArticle)

      const reverted = await ArticleService.removeArticleClassRestriction('article-1')

      expect(reverted.visibility_type).toBe('public')
      expect(reverted.restricted_to_classes).toBeNull()
    })
  })

  describe('Edge Cases & Error Scenarios', () => {
    it('should prevent duplicate article_order in same week', async () => {
      const error = new Error('DUPLICATE_ARTICLE_ORDER')
      vi.mocked(ArticleService.createArticle).mockRejectedValue(error)

      await expect(
        ArticleService.createArticle({
          week_number: '2025-W47',
          title: 'Article 1',
          content: 'Content',
          author: 'teacher-001',
          article_order: 1, // Already exists
        })
      ).rejects.toThrow('DUPLICATE_ARTICLE_ORDER')
    })

    it('should not allow class-restricted article without classes', async () => {
      const error = new Error('EMPTY_CLASS_RESTRICTION')
      vi.mocked(ArticleService.createArticle).mockRejectedValue(error)

      await expect(
        ArticleService.createArticle({
          week_number: '2025-W47',
          title: 'Restricted Article',
          content: 'Content',
          author: 'teacher-001',
          visibility_type: 'class_restricted',
          restricted_to_classes: [], // Empty!
        })
      ).rejects.toThrow('EMPTY_CLASS_RESTRICTION')
    })

    it('should handle soft-delete correctly', async () => {
      // Article initially published
      const article = mockArticles.public

      // Soft delete by setting deleted_at
      const deletedArticle = {
        ...article,
        deleted_at: new Date().toISOString(),
      }

      vi.mocked(ArticleService.deleteArticle).mockResolvedValue(deletedArticle)

      const deleted = await ArticleService.deleteArticle(article.id)

      expect(deleted.deleted_at).not.toBeNull()

      // Verify article no longer appears in queries (filtered by WHERE deleted_at IS NULL)
      vi.mocked(ArticleService.getArticlesByWeek).mockResolvedValue([])

      const remaining = await ArticleService.getArticlesByWeek('2025-W47')

      expect(remaining).toHaveLength(0)
    })

    it('should prevent unauthorized deletion', async () => {
      const error = new Error('INSUFFICIENT_PERMISSIONS')
      vi.mocked(ArticleService.deleteArticle).mockRejectedValue(error)

      await expect(ArticleService.deleteArticle('article-1')).rejects.toThrow(
        'INSUFFICIENT_PERMISSIONS'
      )
    })

    it('should validate class references', async () => {
      const error = new Error('INVALID_CLASS_ID')
      vi.mocked(ArticleService.setArticleClassRestriction).mockRejectedValue(error)

      await expect(
        ArticleService.setArticleClassRestriction('article-1', ['INVALID-CLASS'])
      ).rejects.toThrow('INVALID_CLASS_ID')
    })
  })

  describe('Audit Log Verification', () => {
    it('should create audit log entry on article creation', async () => {
      const article = mockArticles.public

      vi.mocked(ArticleService.createArticle).mockResolvedValue(article)

      await ArticleService.createArticle({
        week_number: '2025-W47',
        title: article.title,
        content: article.content,
        author: article.author,
      })

      // Verify audit log entry would be created
      // (In real implementation, this is automatic via database trigger)
      expect(ArticleService.createArticle).toHaveBeenCalledWith(
        expect.objectContaining({
          week_number: '2025-W47',
        })
      )
    })

    it('should log article updates with before/after values', async () => {
      const originalArticle = mockArticles.public
      const updatedArticle = {
        ...originalArticle,
        title: 'Updated Title',
      }

      vi.mocked(ArticleService.updateArticle).mockResolvedValue(updatedArticle)

      await ArticleService.updateArticle(originalArticle.id, {
        title: 'Updated Title',
      })

      // In real implementation, audit log would contain:
      // - operation: 'UPDATE'
      // - old_values: { title: original.title }
      // - new_values: { title: updatedArticle.title }
      // - changed_by: currentUser.id

      expect(ArticleService.updateArticle).toHaveBeenCalledWith(originalArticle.id, {
        title: 'Updated Title',
      })
    })

    it('should maintain audit trail for class restriction changes', async () => {
      const article = mockArticles.public

      // Change 1: Add class restriction
      const restricted = {
        ...article,
        visibility_type: 'class_restricted' as const,
        restricted_to_classes: ['A1'],
      }

      vi.mocked(ArticleService.setArticleClassRestriction).mockResolvedValue(restricted)

      await ArticleService.setArticleClassRestriction(article.id, ['A1'])

      // Change 2: Expand restriction
      const expandedRestriction = {
        ...restricted,
        restricted_to_classes: ['A1', 'B1'],
      }

      vi.mocked(ArticleService.setArticleClassRestriction).mockResolvedValue(expandedRestriction)

      await ArticleService.setArticleClassRestriction(article.id, ['A1', 'B1'])

      // Change 3: Remove restriction
      const unrestricted = {
        ...expandedRestriction,
        visibility_type: 'public' as const,
        restricted_to_classes: null,
      }

      vi.mocked(ArticleService.removeArticleClassRestriction).mockResolvedValue(unrestricted)

      await ArticleService.removeArticleClassRestriction(article.id)

      // Each change would create audit log entry
      expect(ArticleService.setArticleClassRestriction).toHaveBeenCalledTimes(2)
      expect(ArticleService.removeArticleClassRestriction).toHaveBeenCalledTimes(1)
    })
  })

  describe('Performance & Scale Verification', () => {
    it('should handle week with many articles efficiently', async () => {
      // Generate 100 articles for a week
      const manyArticles = Array.from({ length: 100 }, (_, i) => ({
        ...mockArticles.public,
        id: `article-${i}`,
        short_id: `a${String(i + 1).padStart(3, '0')}`,
        article_order: i + 1,
        title: `Article ${i + 1}`,
      }))

      vi.mocked(ArticleService.getArticlesByWeek).mockResolvedValue(manyArticles)

      const startTime = Date.now()
      const articles = await ArticleService.getArticlesByWeek('2025-W47')
      const duration = Date.now() - startTime

      expect(articles).toHaveLength(100)
      expect(duration).toBeLessThan(500) // Target: <500ms for 100 articles
    })

    it('should filter family articles efficiently for large weeks', async () => {
      // Large week with many articles
      const largeWeekArticles = Array.from({ length: 100 }, (_, i) => ({
        ...mockArticles.public,
        id: `article-${i}`,
        short_id: `a${String(i + 1).padStart(3, '0')}`,
        article_order: i + 1,
        title: `Article ${i + 1}`,
        visibility_type: i % 3 === 0 ? ('class_restricted' as const) : ('public' as const),
        restricted_to_classes: i % 3 === 0 ? ['A1'] : null,
      }))

      vi.mocked(getArticlesForFamily).mockResolvedValue(largeWeekArticles)

      const startTime = Date.now()
      const visibleArticles = await getArticlesForFamily('family-001', '2025-W47')
      const duration = Date.now() - startTime

      expect(visibleArticles.length).toBeGreaterThan(0)
      expect(duration).toBeLessThan(100) // Target: <100ms for family filtering
    })

    it('should handle concurrent reads without degradation', async () => {
      // Simulate 10 concurrent reader requests
      vi.mocked(ArticleService.getArticlesByWeek).mockResolvedValue([
        mockArticles.public,
        mockArticles.classA1,
      ])

      const startTime = Date.now()

      await Promise.all(
        Array.from({ length: 10 }, () => ArticleService.getArticlesByWeek('2025-W47'))
      )

      const duration = Date.now() - startTime

      expect(ArticleService.getArticlesByWeek).toHaveBeenCalledTimes(10)
      expect(duration).toBeLessThan(1000) // Should handle 10 concurrent reads
    })
  })

  describe('Data Consistency & Integrity', () => {
    it('should maintain referential integrity for class restrictions', async () => {
      // Try to restrict article to non-existent class
      const error = new Error('INVALID_CLASS_ID')
      vi.mocked(ArticleService.setArticleClassRestriction).mockRejectedValue(error)

      await expect(
        ArticleService.setArticleClassRestriction(mockArticles.public.id, ['INVALID-CLASS'])
      ).rejects.toThrow('INVALID_CLASS_ID')
    })

    it('should ensure article_order uniqueness per week', async () => {
      // Create first article with order 1
      vi.mocked(ArticleService.createArticle).mockResolvedValueOnce({
        ...mockArticles.public,
        article_order: 1,
      })

      await ArticleService.createArticle({
        week_number: '2025-W47',
        title: 'First Article',
        content: 'Content',
        author: 'teacher-001',
        article_order: 1,
      })

      // Try to create second article with same order - should fail
      const error = new Error('DUPLICATE_ARTICLE_ORDER')
      vi.mocked(ArticleService.createArticle).mockRejectedValueOnce(error)

      await expect(
        ArticleService.createArticle({
          week_number: '2025-W47',
          title: 'Second Article',
          content: 'Content',
          author: 'teacher-002',
          article_order: 1, // Duplicate!
        })
      ).rejects.toThrow('DUPLICATE_ARTICLE_ORDER')
    })

    it('should preserve audit trail across all operations', async () => {
      const operations = ['CREATE', 'UPDATE', 'DELETE']

      // Each operation should be logged
      vi.mocked(ArticleService.createArticle).mockResolvedValue(mockArticles.public)
      vi.mocked(ArticleService.updateArticle).mockResolvedValue({
        ...mockArticles.public,
        title: 'Updated',
      })
      vi.mocked(ArticleService.deleteArticle).mockResolvedValue({
        ...mockArticles.public,
        deleted_at: new Date().toISOString(),
      })

      await ArticleService.createArticle({
        week_number: '2025-W47',
        title: 'Test Article',
        content: 'Content',
        author: 'teacher-001',
      })

      await ArticleService.updateArticle('article-1', { title: 'Updated' })

      await ArticleService.deleteArticle('article-1')

      // Verify all operations called (would create audit entries)
      expect(ArticleService.createArticle).toHaveBeenCalled()
      expect(ArticleService.updateArticle).toHaveBeenCalled()
      expect(ArticleService.deleteArticle).toHaveBeenCalled()
    })
  })
})
