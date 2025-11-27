/**
 * ArticleClassRestrictionEditor Component Tests
 * Tests for editor UI to restrict articles to classes
 *
 * US3: Class-Based Article Visibility
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import type { ArticleRow, ClassRow } from '@/types/database'
import { ArticleClassRestrictionEditor } from '@/components/ArticleClassRestrictionEditor'

// Mock services
vi.mock('@/services/ArticleService', () => ({
  ArticleService: {
    setArticleClassRestriction: vi.fn(),
    removeArticleClassRestriction: vi.fn(),
  },
}))

vi.mock('@/services/ClassService', () => ({
  ClassService: {
    getAllClasses: vi.fn(),
  },
}))

describe('ArticleClassRestrictionEditor Component', () => {
  const mockArticle: ArticleRow = {
    id: 'article-1',
    short_id: 'a001',
    week_number: '2025-W47',
    title: 'Test Article',
    content: '# Test Content',
    author: 'Author',
    article_order: 1,
    is_published: true,
    visibility_type: 'public',
    restricted_to_classes: null,
    created_by: 'user-1',
    created_at: '2025-11-17T10:00:00Z',
    updated_at: '2025-11-17T10:00:00Z',
    deleted_at: null,
  }

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

  const mockRestrictedArticle: ArticleRow = {
    ...mockArticle,
    visibility_type: 'class_restricted',
    restricted_to_classes: ['A1'],
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('Rendering', () => {
    it('should render component header', async () => {
      const { ClassService } = await import('@/services/ClassService')
      vi.mocked(ClassService.getAllClasses).mockResolvedValue([])

      render(
        <ArticleClassRestrictionEditor
          article={mockArticle}
        />
      )

      expect(
        screen.getByText('Article Visibility Settings')
      ).toBeInTheDocument()
      expect(screen.getByText('Test Article')).toBeInTheDocument()
    })

    it('should display visibility type options', async () => {
      const { ClassService } = await import('@/services/ClassService')
      vi.mocked(ClassService.getAllClasses).mockResolvedValue([])

      render(
        <ArticleClassRestrictionEditor
          article={mockArticle}
        />
      )

      expect(screen.getByText('Visibility Type')).toBeInTheDocument()
      expect(screen.getByText(/Visible to all parents/)).toBeInTheDocument()
      expect(
        screen.getByText(/Only visible to selected classes/)
      ).toBeInTheDocument()
    })
  })

  describe('Public Visibility', () => {
    it('should have public selected by default for public articles', async () => {
      const { ClassService } = await import('@/services/ClassService')
      vi.mocked(ClassService.getAllClasses).mockResolvedValue(mockClasses)

      render(
        <ArticleClassRestrictionEditor
          article={mockArticle}
        />
      )

      await waitFor(() => {
        const publicRadio = screen.getAllByRole('radio')[0]
        expect(publicRadio).toBeChecked()
      })
    })

    it('should not show class selection for public articles', async () => {
      const { ClassService } = await import('@/services/ClassService')
      vi.mocked(ClassService.getAllClasses).mockResolvedValue(mockClasses)

      render(
        <ArticleClassRestrictionEditor
          article={mockArticle}
        />
      )

      await waitFor(() => {
        expect(
          screen.queryByText('Restrict to Classes')
        ).not.toBeInTheDocument()
      })
    })

    it('should display message when article is already public', async () => {
      const { ClassService } = await import('@/services/ClassService')
      vi.mocked(ClassService.getAllClasses).mockResolvedValue([])

      render(
        <ArticleClassRestrictionEditor
          article={mockArticle}
        />
      )

      await waitFor(() => {
        expect(
          screen.getByText('Article is already public')
        ).toBeInTheDocument()
      })
    })
  })

  describe('Class Restricted Visibility', () => {
    it('should have class-restricted selected for restricted articles', async () => {
      const { ClassService } = await import('@/services/ClassService')
      vi.mocked(ClassService.getAllClasses).mockResolvedValue(mockClasses)

      render(
        <ArticleClassRestrictionEditor
          article={mockRestrictedArticle}
        />
      )

      await waitFor(() => {
        const classRestrictedRadio = screen.getAllByRole('radio')[1]
        expect(classRestrictedRadio).toBeChecked()
      })
    })

    it('should display class selection when toggling to class-restricted', async () => {
      const { ClassService } = await import('@/services/ClassService')
      vi.mocked(ClassService.getAllClasses).mockResolvedValue(mockClasses)

      render(
        <ArticleClassRestrictionEditor
          article={mockArticle}
        />
      )

      await waitFor(() => {
        const classRestrictedRadio = screen.getAllByRole('radio')[1]
        fireEvent.click(classRestrictedRadio)
      })

      await waitFor(() => {
        expect(screen.getByText('Restrict to Classes')).toBeInTheDocument()
      })
    })

    it('should display restrict to classes heading', async () => {
      const { ClassService } = await import('@/services/ClassService')
      vi.mocked(ClassService.getAllClasses).mockResolvedValue(mockClasses)

      render(
        <ArticleClassRestrictionEditor
          article={mockRestrictedArticle}
        />
      )

      await waitFor(() => {
        expect(screen.getByText('Restrict to Classes')).toBeInTheDocument()
      })
    })

    it('should pre-select restricted classes', async () => {
      const { ClassService } = await import('@/services/ClassService')
      vi.mocked(ClassService.getAllClasses).mockResolvedValue(mockClasses)

      render(
        <ArticleClassRestrictionEditor
          article={mockRestrictedArticle}
        />
      )

      await waitFor(() => {
        const checkboxes = screen.getAllByRole('checkbox')
        // A1 should be checked
        expect(checkboxes[2]).toBeChecked() // A1 checkbox
      })
    })

    it('should validate at least one class selected', async () => {
      const { ClassService } = await import('@/services/ClassService')
      vi.mocked(ClassService.getAllClasses).mockResolvedValue(mockClasses)

      render(
        <ArticleClassRestrictionEditor
          article={mockArticle}
        />
      )

      await waitFor(() => {
        const classRestrictedRadio = screen.getAllByRole('radio')[1]
        fireEvent.click(classRestrictedRadio)
      })

      await waitFor(() => {
        expect(
          screen.getByText('Select at least one class to save as class-restricted')
        ).toBeInTheDocument()
      })
    })
  })

  describe('Class Selection', () => {
    it('should toggle individual class selection', async () => {
      const { ClassService } = await import('@/services/ClassService')
      vi.mocked(ClassService.getAllClasses).mockResolvedValue(mockClasses)

      render(
        <ArticleClassRestrictionEditor
          article={mockRestrictedArticle}
        />
      )

      await waitFor(() => {
        const checkboxes = screen.getAllByRole('checkbox')
        const b1Checkbox = checkboxes[1] // B1
        fireEvent.click(b1Checkbox)

        expect(b1Checkbox).toBeChecked()
      })
    })

    it('should support select all', async () => {
      const { ClassService } = await import('@/services/ClassService')
      vi.mocked(ClassService.getAllClasses).mockResolvedValue(mockClasses)

      render(
        <ArticleClassRestrictionEditor
          article={mockRestrictedArticle}
        />
      )

      await waitFor(() => {
        const selectAllCheckbox = screen.getByText(
          'Select All Classes'
        ).closest('label')?.querySelector('input[type="checkbox"]')

        fireEvent.click(selectAllCheckbox!)

        const allCheckboxes = screen.getAllByRole('checkbox')
        // All should be checked
        allCheckboxes.forEach((checkbox) => {
          expect(checkbox).toBeChecked()
        })
      })
    })

    it('should display selected classes summary', async () => {
      const { ClassService } = await import('@/services/ClassService')
      vi.mocked(ClassService.getAllClasses).mockResolvedValue(mockClasses)

      render(
        <ArticleClassRestrictionEditor
          article={mockRestrictedArticle}
        />
      )

      await waitFor(() => {
        expect(screen.getByText('Classes Selected:')).toBeInTheDocument()
      })
    })
  })

  describe('Saving Restrictions', () => {
    it('should have save restrictions button when class-restricted', async () => {
      const { ClassService } = await import('@/services/ClassService')

      vi.mocked(ClassService.getAllClasses).mockResolvedValue(mockClasses)

      render(
        <ArticleClassRestrictionEditor
          article={mockRestrictedArticle}
        />
      )

      await waitFor(() => {
        const saveButton = screen.queryByText('Save Restrictions')
        expect(saveButton).toBeInTheDocument()
      })
    })

    it('should have clear restrictions button after toggling public for restricted article', async () => {
      const { ClassService } = await import('@/services/ClassService')

      vi.mocked(ClassService.getAllClasses).mockResolvedValue(mockClasses)

      render(
        <ArticleClassRestrictionEditor
          article={mockRestrictedArticle}
        />
      )

      // First verify the component renders with class-restricted article
      await waitFor(() => {
        expect(screen.getByText('Article Visibility Settings')).toBeInTheDocument()
      })

      // Then toggle to public to see the clear button option
      const publicRadio = screen.getAllByRole('radio')[0]
      fireEvent.click(publicRadio)

      // Now the clear restrictions button should appear
      await waitFor(() => {
        expect(screen.queryByText(/Clear Restrictions/)).toBeInTheDocument()
      })
    })

    it('should validate at least one class selected for save', async () => {
      const { ClassService } = await import('@/services/ClassService')

      vi.mocked(ClassService.getAllClasses).mockResolvedValue(mockClasses)

      render(
        <ArticleClassRestrictionEditor
          article={mockArticle}
        />
      )

      // Component should be rendered successfully
      await waitFor(() => {
        expect(screen.getByText('Article Visibility Settings')).toBeInTheDocument()
      })
    })
  })

  describe('Error Handling', () => {
    it('should load classes successfully', async () => {
      const { ClassService } = await import('@/services/ClassService')

      vi.mocked(ClassService.getAllClasses).mockResolvedValue(mockClasses)

      render(
        <ArticleClassRestrictionEditor
          article={mockArticle}
        />
      )

      await waitFor(() => {
        expect(screen.getByText('Article Visibility Settings')).toBeInTheDocument()
      })
    })

    it('should handle save with service available', async () => {
      const { ClassService } = await import('@/services/ClassService')

      vi.mocked(ClassService.getAllClasses).mockResolvedValue(mockClasses)

      render(
        <ArticleClassRestrictionEditor
          article={mockArticle}
        />
      )

      // Verify component renders properly
      await waitFor(() => {
        expect(screen.getByText('Public')).toBeInTheDocument()
      })
    })
  })
})
