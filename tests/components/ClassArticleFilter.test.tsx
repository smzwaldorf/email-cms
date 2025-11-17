/**
 * ClassArticleFilter Component Tests
 * Tests for multi-select class filtering UI
 *
 * US3: Class-Based Article Visibility
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ClassRow, ArticleRow } from '@/types/database'
import { ClassArticleFilter } from '@/components/ClassArticleFilter'

// Mock services
vi.mock('@/services/FamilyService', () => ({
  FamilyService: {
    getChildrenClasses: vi.fn(),
  },
}))

vi.mock('@/services/queries/classArticleQueries', () => ({
  getArticlesForFamily: vi.fn(),
  getArticlesForClass: vi.fn(),
}))

describe('ClassArticleFilter Component', () => {
  const mockClasses: ClassRow[] = [
    {
      id: 'B1',
      class_name: 'Grade 2A',
      class_grade_year: 2,
      created_at: '2025-11-17T10:00:00Z',
    },
    {
      id: 'A1',
      class_name: 'Grade 1A',
      class_grade_year: 1,
      created_at: '2025-11-17T10:00:00Z',
    },
  ]

  const mockArticles: ArticleRow[] = [
    {
      id: 'article-1',
      week_number: '2025-W47',
      title: 'Article 1',
      content: '# Content',
      author: 'Author',
      article_order: 1,
      is_published: true,
      visibility_type: 'public',
      restricted_to_classes: null,
      created_by: 'user-1',
      created_at: '2025-11-17T10:00:00Z',
      updated_at: '2025-11-17T10:00:00Z',
      deleted_at: null,
    },
  ]

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('Rendering', () => {
    it('should render filter header', async () => {
      const { FamilyService } = await import('@/services/FamilyService')
      vi.mocked(FamilyService.getChildrenClasses).mockResolvedValue([])

      render(<ClassArticleFilter weekNumber="2025-W47" />)

      expect(screen.getByText('Filter by Class')).toBeInTheDocument()
    })

    it('should display no classes message when empty', async () => {
      const { FamilyService } = await import('@/services/FamilyService')
      vi.mocked(FamilyService.getChildrenClasses).mockResolvedValue([])

      render(<ClassArticleFilter weekNumber="2025-W47" />)

      await waitFor(() => {
        expect(
          screen.getByText(/No classes available/)
        ).toBeInTheDocument()
      })
    })
  })

  describe('Class Selection with Family', () => {
    it('should load and display family classes', async () => {
      const { FamilyService } = await import('@/services/FamilyService')
      const { getArticlesForFamily } = await import(
        '@/services/queries/classArticleQueries'
      )

      vi.mocked(FamilyService.getChildrenClasses).mockResolvedValue(mockClasses)
      vi.mocked(getArticlesForFamily).mockResolvedValue({
        articles: mockArticles,
        classes: mockClasses,
        totalCount: 1,
      })

      render(
        <ClassArticleFilter
          familyId="family-1"
          weekNumber="2025-W47"
        />
      )

      await waitFor(() => {
        const classElements = screen.getAllByText(/Grade [12]A/)
        expect(classElements.length).toBeGreaterThanOrEqual(2)
      })
    })

    it('should display grade year indicators', async () => {
      const { FamilyService } = await import('@/services/FamilyService')
      const { getArticlesForFamily } = await import(
        '@/services/queries/classArticleQueries'
      )

      vi.mocked(FamilyService.getChildrenClasses).mockResolvedValue(mockClasses)
      vi.mocked(getArticlesForFamily).mockResolvedValue({
        articles: mockArticles,
        classes: mockClasses,
        totalCount: 1,
      })

      render(
        <ClassArticleFilter
          familyId="family-1"
          weekNumber="2025-W47"
        />
      )

      await waitFor(() => {
        const gradeElements = screen.getAllByText(/Grade [12]/)
        expect(gradeElements.length).toBeGreaterThanOrEqual(2)
      })
    })

    it('should auto-select all family classes on load', async () => {
      const { FamilyService } = await import('@/services/FamilyService')
      const { getArticlesForFamily } = await import(
        '@/services/queries/classArticleQueries'
      )

      vi.mocked(FamilyService.getChildrenClasses).mockResolvedValue(mockClasses)
      vi.mocked(getArticlesForFamily).mockResolvedValue({
        articles: mockArticles,
        classes: mockClasses,
        totalCount: 1,
      })

      render(
        <ClassArticleFilter
          familyId="family-1"
          weekNumber="2025-W47"
        />
      )

      await waitFor(() => {
        const checkboxes = screen.getAllByRole('checkbox')
        // First is "Select All", rest are individual classes
        expect(checkboxes[0]).toBeChecked() // Select All
        expect(checkboxes[1]).toBeChecked() // B1
        expect(checkboxes[2]).toBeChecked() // A1
      })
    })
  })

  describe('Manual Class Selection', () => {
    it('should toggle class selection', async () => {
      const { FamilyService } = await import('@/services/FamilyService')
      const { getArticlesForFamily, getArticlesForClass } = await import(
        '@/services/queries/classArticleQueries'
      )

      vi.mocked(FamilyService.getChildrenClasses).mockResolvedValue([])
      vi.mocked(getArticlesForClass).mockResolvedValue(mockArticles)

      render(
        <ClassArticleFilter
          familyId="family-1"
          weekNumber="2025-W47"
        />
      )

      const checkboxes = screen.queryAllByRole('checkbox')
      expect(checkboxes.length).toBe(0) // No classes loaded
    })

    it('should handle select all toggle', async () => {
      const { FamilyService } = await import('@/services/FamilyService')
      const { getArticlesForFamily } = await import(
        '@/services/queries/classArticleQueries'
      )

      vi.mocked(FamilyService.getChildrenClasses).mockResolvedValue(mockClasses)
      vi.mocked(getArticlesForFamily).mockResolvedValue({
        articles: mockArticles,
        classes: mockClasses,
        totalCount: 1,
      })

      render(
        <ClassArticleFilter
          familyId="family-1"
          weekNumber="2025-W47"
        />
      )

      await waitFor(() => {
        const selectAllCheckbox = screen.getAllByRole('checkbox')[0]
        expect(selectAllCheckbox).toBeChecked()

        // Click to deselect all
        fireEvent.click(selectAllCheckbox)

        expect(selectAllCheckbox).not.toBeChecked()
      })
    })
  })

  describe('Article Display', () => {
    it('should display article count', async () => {
      const { FamilyService } = await import('@/services/FamilyService')
      const { getArticlesForFamily } = await import(
        '@/services/queries/classArticleQueries'
      )

      vi.mocked(FamilyService.getChildrenClasses).mockResolvedValue(mockClasses)
      vi.mocked(getArticlesForFamily).mockResolvedValue({
        articles: mockArticles,
        classes: mockClasses,
        totalCount: 1,
      })

      render(
        <ClassArticleFilter
          familyId="family-1"
          weekNumber="2025-W47"
        />
      )

      await waitFor(() => {
        expect(screen.getByText('1 article available')).toBeInTheDocument()
      })
    })

    it('should display no articles message when empty', async () => {
      const { FamilyService } = await import('@/services/FamilyService')
      const { getArticlesForFamily } = await import(
        '@/services/queries/classArticleQueries'
      )

      vi.mocked(FamilyService.getChildrenClasses).mockResolvedValue(mockClasses)
      vi.mocked(getArticlesForFamily).mockResolvedValue({
        articles: [],
        classes: mockClasses,
        totalCount: 0,
      })

      render(
        <ClassArticleFilter
          familyId="family-1"
          weekNumber="2025-W47"
        />
      )

      await waitFor(() => {
        expect(
          screen.getByText('No articles found for selected classes')
        ).toBeInTheDocument()
      })
    })

    it('should call onArticlesLoaded callback', async () => {
      const { FamilyService } = await import('@/services/FamilyService')
      const { getArticlesForFamily } = await import(
        '@/services/queries/classArticleQueries'
      )
      const onArticlesLoaded = vi.fn()

      vi.mocked(FamilyService.getChildrenClasses).mockResolvedValue(mockClasses)
      vi.mocked(getArticlesForFamily).mockResolvedValue({
        articles: mockArticles,
        classes: mockClasses,
        totalCount: 1,
      })

      render(
        <ClassArticleFilter
          familyId="family-1"
          weekNumber="2025-W47"
          onArticlesLoaded={onArticlesLoaded}
        />
      )

      await waitFor(() => {
        expect(onArticlesLoaded).toHaveBeenCalledWith(mockArticles)
      })
    })
  })

  describe('Selected Classes Summary', () => {
    it('should display selected classes tags', async () => {
      const { FamilyService } = await import('@/services/FamilyService')
      const { getArticlesForFamily } = await import(
        '@/services/queries/classArticleQueries'
      )

      vi.mocked(FamilyService.getChildrenClasses).mockResolvedValue(mockClasses)
      vi.mocked(getArticlesForFamily).mockResolvedValue({
        articles: mockArticles,
        classes: mockClasses,
        totalCount: 1,
      })

      render(
        <ClassArticleFilter
          familyId="family-1"
          weekNumber="2025-W47"
        />
      )

      await waitFor(() => {
        expect(screen.getByText('Selected Classes:')).toBeInTheDocument()
        const classElements = screen.getAllByText(/Grade [12]A/)
        expect(classElements.length).toBeGreaterThanOrEqual(2)
      })
    })
  })

  describe('Error Handling', () => {
    it('should display error message on load failure', async () => {
      const { FamilyService } = await import('@/services/FamilyService')

      vi.mocked(FamilyService.getChildrenClasses).mockRejectedValue(
        new Error('Failed to load')
      )

      render(
        <ClassArticleFilter
          familyId="family-1"
          weekNumber="2025-W47"
        />
      )

      await waitFor(() => {
        expect(screen.getByText(/Failed to load/)).toBeInTheDocument()
      })
    })
  })
})
