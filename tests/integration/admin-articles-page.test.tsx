import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { AdminArticlesPage } from '@/pages/AdminArticlesPage'

vi.mock('@/services/adminService', () => ({
  adminService: {
    fetchNewsletters: vi.fn(),
    fetchNewsletterTemplates: vi.fn(),
    fetchAllArticles: vi.fn(),
    fetchArticlesByNewsletterId: vi.fn(),
    fetchArticleNewsletterMemberships: vi.fn(),
  },
  AdminServiceError: class extends Error {},
}))

vi.mock('@/components/admin/AdminLayout', () => ({
  AdminLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

vi.mock('@/components/ErrorBoundary', () => ({
  ErrorBoundary: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

vi.mock('@/components/LoadingSpinner', () => ({
  LoadingSpinner: () => <div>Loading...</div>,
}))

import { adminService } from '@/services/adminService'

describe('AdminArticlesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(adminService.fetchNewsletters).mockResolvedValue([
      {
        id: 'newsletter-1',
        weekNumber: '2025-W48',
        title: 'Week 48',
        description: null,
        releaseDate: '2025-11-30',
        status: 'draft',
        isTemplate: false,
        articleCount: 2,
        createdAt: '2025-11-01',
        updatedAt: '2025-11-01',
        publishedAt: null,
        isPublished: false,
      },
    ] as any)
    vi.mocked(adminService.fetchNewsletterTemplates).mockResolvedValue([
      {
        id: 'template-newsletter-1',
        weekNumber: null,
        title: 'Template #1',
        description: null,
        releaseDate: '2025-12-01',
        status: 'draft',
        isTemplate: true,
        articleCount: 1,
        createdAt: '2025-11-01',
        updatedAt: '2025-11-01',
        publishedAt: null,
        isPublished: false,
      },
    ] as any)
    vi.mocked(adminService.fetchAllArticles).mockResolvedValue([
      {
        id: 'article-1',
        title: 'All Article',
        content: '<p>All</p>',
        weekNumber: '2025-W48',
        order: 1,
        status: 'draft',
        createdAt: '2025-11-01',
        updatedAt: '2025-11-01',
      },
      {
        id: 'article-template-1',
        title: 'Template Article',
        content: '<p>Template</p>',
        weekNumber: '',
        order: 0,
        status: 'draft',
        createdAt: '2025-11-01',
        updatedAt: '2025-11-01',
      },
    ] as any)
    vi.mocked(adminService.fetchArticlesByNewsletterId).mockImplementation(async (newsletterId: string) => {
      if (newsletterId === 'template-newsletter-1') {
        return [
          {
            id: 'article-template-1',
            title: 'Template Article',
            content: '<p>Template</p>',
            weekNumber: '',
            order: 0,
            status: 'draft',
            createdAt: '2025-11-01',
            updatedAt: '2025-11-01',
          },
        ] as any
      }

      return [
        {
          id: 'article-2',
          title: 'Filtered Article',
          content: '<p>Filtered</p>',
          weekNumber: '2025-W48',
          order: 1,
          status: 'draft',
          createdAt: '2025-11-02',
          updatedAt: '2025-11-02',
        },
      ] as any
    })
    vi.mocked(adminService.fetchArticleNewsletterMemberships).mockImplementation(async (articleIds: string[]) => {
      if (articleIds.includes('article-2')) {
        return {
          'article-2': [{ newsletterId: 'newsletter-1', label: '2025-W48', isTemplate: false }],
        }
      }
      return {
        'article-1': [{ newsletterId: 'newsletter-1', label: '2025-W48', isTemplate: false }],
        'article-template-1': [{ newsletterId: 'template-newsletter-1', label: 'Template #1', isTemplate: true }],
      }
    })
  })

  it('lists all articles by default', async () => {
    render(
      <MemoryRouter>
        <AdminArticlesPage />
      </MemoryRouter>
    )

    expect(await screen.findByText('All Article')).toBeInTheDocument()
    expect(screen.queryByText('Template Article')).not.toBeInTheDocument()
    expect(adminService.fetchAllArticles).toHaveBeenCalled()
    expect(screen.getByRole('button', { name: '2025-W48' })).toBeInTheDocument()
  })

  it('filters article list by selected newsletter', async () => {
    render(
      <MemoryRouter>
        <AdminArticlesPage />
      </MemoryRouter>
    )

    await screen.findByText('All Article')
    fireEvent.change(screen.getByLabelText('依電子報篩選'), {
      target: { value: 'newsletter-1' },
    })

    await waitFor(() => {
      expect(adminService.fetchArticlesByNewsletterId).toHaveBeenCalledWith('newsletter-1')
      expect(screen.getByText('Filtered Article')).toBeInTheDocument()
    })
  })

  it('clicking newsletter tag applies newsletter filter', async () => {
    render(
      <MemoryRouter>
        <AdminArticlesPage />
      </MemoryRouter>
    )

    await screen.findByText('All Article')
    fireEvent.click(screen.getByRole('button', { name: '2025-W48' }))

    await waitFor(() => {
      expect(adminService.fetchArticlesByNewsletterId).toHaveBeenCalledWith('newsletter-1')
      expect(screen.getByText('Filtered Article')).toBeInTheDocument()
    })
  })

  it('shows template-only list when clicking template articles list button', async () => {
    render(
      <MemoryRouter>
        <AdminArticlesPage />
      </MemoryRouter>
    )

    await screen.findByText('All Article')
    fireEvent.click(screen.getByRole('button', { name: '模板文章列表' }))

    await waitFor(() => {
      expect(screen.getByText('Template Article')).toBeInTheDocument()
      expect(screen.queryByText('All Article')).not.toBeInTheDocument()
    })
  })

  it('selector switches to template newsletters in template mode', async () => {
    render(
      <MemoryRouter>
        <AdminArticlesPage />
      </MemoryRouter>
    )

    await screen.findByText('All Article')
    fireEvent.click(screen.getByRole('button', { name: '模板文章列表' }))

    await waitFor(() => {
      expect(screen.getByRole('option', { name: '全部模板電子報' })).toBeInTheDocument()
      expect(screen.getByRole('option', { name: 'Template #1' })).toBeInTheDocument()
      expect(screen.queryByRole('option', { name: '2025-W48' })).not.toBeInTheDocument()
    })
  })

  it('toggle button returns to normal article list', async () => {
    render(
      <MemoryRouter>
        <AdminArticlesPage />
      </MemoryRouter>
    )

    await screen.findByText('All Article')
    fireEvent.click(screen.getByRole('button', { name: '模板文章列表' }))

    await waitFor(() => {
      expect(screen.getByText('Template Article')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: '返回一般文章列表' })).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: '返回一般文章列表' }))

    await waitFor(() => {
      expect(screen.getByText('All Article')).toBeInTheDocument()
      expect(screen.queryByText('Template Article')).not.toBeInTheDocument()
      expect(screen.getByRole('button', { name: '模板文章列表' })).toBeInTheDocument()
    })
  })

  it('keeps selected newsletter articles visible even if reused in templates', async () => {
    vi.mocked(adminService.fetchArticlesByNewsletterId).mockResolvedValueOnce([
      {
        id: 'article-shared-1',
        title: 'Reused Article',
        content: '<p>Reused</p>',
        weekNumber: '2025-W48',
        order: 1,
        status: 'draft',
        createdAt: '2025-11-02',
        updatedAt: '2025-11-02',
      },
    ] as any)
    vi.mocked(adminService.fetchArticleNewsletterMemberships).mockResolvedValueOnce({
      'article-shared-1': [
        { newsletterId: 'newsletter-1', label: '2025-W48', isTemplate: false },
        { newsletterId: 'template-newsletter-1', label: 'Template #1', isTemplate: true },
      ],
    })

    render(
      <MemoryRouter>
        <AdminArticlesPage />
      </MemoryRouter>
    )

    await screen.findByText('All Article')
    fireEvent.change(screen.getByLabelText('依電子報篩選'), {
      target: { value: 'newsletter-1' },
    })

    await waitFor(() => {
      expect(adminService.fetchArticlesByNewsletterId).toHaveBeenCalledWith('newsletter-1')
      expect(screen.getByText('Reused Article')).toBeInTheDocument()
    })
  })
})
