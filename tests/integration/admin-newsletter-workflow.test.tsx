import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { AdminArticleListPage } from '@/pages/AdminArticleListPage'
import type { AdminNewsletter } from '@/types/admin'

vi.mock('@/services/adminService', () => ({
  adminService: {
    fetchNewsletterByWeek: vi.fn(),
    fetchNewsletter: vi.fn(),
    fetchArticlesByNewsletterId: vi.fn(),
    getAvailableArticlesByNewsletterId: vi.fn(),
    getNewsletterPublishReadiness: vi.fn(),
    reorderArticlesInNewsletterById: vi.fn(),
    addArticleToNewsletterById: vi.fn(),
    removeArticleFromNewsletterById: vi.fn(),
    createArticleForNewsletter: vi.fn(),
    publishNewsletter: vi.fn(),
    archiveNewsletter: vi.fn(),
  },
  AdminServiceError: class extends Error {},
}))

vi.mock('@/components/admin/AdminLayout', () => ({
  AdminLayout: ({ children, headerAction }: { children: React.ReactNode; headerAction?: React.ReactNode }) => (
    <div>
      <div>{headerAction}</div>
      {children}
    </div>
  ),
}))

vi.mock('@/components/ErrorBoundary', () => ({
  ErrorBoundary: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

vi.mock('@/components/LoadingSpinner', () => ({
  LoadingSpinner: () => <div>Loading...</div>,
}))

vi.mock('@/components/admin/NewsletterForm', () => ({
  NewsletterForm: () => <div data-testid="newsletter-form">Newsletter Form</div>,
}))

import { adminService } from '@/services/adminService'

const MockArticleEditorRoute = () => {
  const location = useLocation()
  const navigate = useNavigate()

  return (
    <div>
      <p>Article Editor Route</p>
      <p data-testid="editor-path">{location.pathname}</p>
      <button onClick={() => navigate(`/admin/newsletters/2025-W48`, { state: { successMessage: '文章已保存' } })}>
        Return to Newsletter
      </button>
    </div>
  )
}

const draftNewsletter = {
  id: 'newsletter-1',
  weekNumber: '2025-W48',
  title: 'Week 48',
  description: 'Description',
  releaseDate: '2025-11-30',
  status: 'draft' as const,
  articleCount: 2,
  createdAt: '2025-11-01',
  updatedAt: '2025-11-01',
  publishedAt: null,
  isPublished: false,
  isTemplate: false,
}

const publishedNewsletter = {
  ...draftNewsletter,
  status: 'published' as const,
  isPublished: true,
  publishedAt: '2025-11-30T10:00:00Z',
}

const archivedNewsletter = {
  ...publishedNewsletter,
  status: 'archived' as const,
}

const specialEditionPublishedNewsletter = {
  id: 'special-newsletter-1',
  weekNumber: null,
  title: 'Special Edition',
  description: 'Special issue',
  releaseDate: '2025-12-10',
  status: 'published' as const,
  articleCount: 1,
  createdAt: '2025-12-01',
  updatedAt: '2025-12-01',
  publishedAt: '2025-12-10T08:00:00Z',
  isPublished: true,
  isTemplate: false,
}

const mockArticles = [
  {
    id: 'article-1',
    title: 'Article One',
    content: '<p>One</p>',
    summary: null,
    weekNumber: '2025-W48',
    order: 1,
    status: 'draft' as const,
    createdAt: '2025-11-01',
    updatedAt: '2025-11-01',
    editedAt: '2025-11-01T10:00:00Z',
  },
  {
    id: 'article-2',
    title: 'Article Two',
    content: '<p>Two</p>',
    summary: null,
    weekNumber: '2025-W48',
    order: 2,
    status: 'draft' as const,
    createdAt: '2025-11-01',
    updatedAt: '2025-11-01',
    editedAt: '2025-11-01T11:00:00Z',
  },
]

describe('Admin newsletter workflow page', () => {
  let currentWeekNewsletter: AdminNewsletter = { ...draftNewsletter }

  beforeEach(() => {
    vi.clearAllMocks()
    currentWeekNewsletter = { ...draftNewsletter }
    vi.mocked(adminService.fetchNewsletterByWeek).mockImplementation(async () => currentWeekNewsletter)
    vi.mocked(adminService.fetchNewsletter).mockImplementation(async () => specialEditionPublishedNewsletter as any)
    vi.mocked(adminService.fetchArticlesByNewsletterId).mockResolvedValue(mockArticles as any)
    vi.mocked(adminService.getAvailableArticlesByNewsletterId).mockResolvedValue([
      {
        id: 'article-3',
        title: 'Article Three',
        content: '<p>Three</p>',
        summary: null,
        weekNumber: '',
        order: 0,
        status: 'draft',
        createdAt: '2025-11-01',
        updatedAt: '2025-11-01',
      },
    ] as any)
    vi.mocked(adminService.getNewsletterPublishReadiness).mockResolvedValue({
      canPublish: true,
      issues: [],
    })
    vi.mocked(adminService.reorderArticlesInNewsletterById).mockResolvedValue()
    vi.mocked(adminService.addArticleToNewsletterById).mockResolvedValue({
      id: 'link-1',
      newsletter_id: 'newsletter-1',
      article_id: 'article-3',
      article_order: 3,
    })
    vi.mocked(adminService.publishNewsletter).mockImplementation(async () => {
      currentWeekNewsletter = { ...publishedNewsletter }
      return currentWeekNewsletter as any
    })
    vi.mocked(adminService.archiveNewsletter).mockImplementation(async () => {
      currentWeekNewsletter = { ...archivedNewsletter }
      return currentWeekNewsletter as any
    })
  })

  const renderPage = (entry = '/admin/newsletters/2025-W48') =>
    render(
      <MemoryRouter initialEntries={[entry]}>
        <Routes>
          <Route path="/admin/newsletters/:weekNumber" element={<AdminArticleListPage />} />
          <Route path="/admin/newsletters/id/:id" element={<AdminArticleListPage />} />
          <Route path="/admin/articles/:weekNumber/:articleId" element={<MockArticleEditorRoute />} />
          <Route path="/admin/articles/id/:id/:articleId" element={<MockArticleEditorRoute />} />
        </Routes>
      </MemoryRouter>
    )

  it('renders newsletter metadata and ordered articles', async () => {
    renderPage()

    expect(await screen.findByText('2025-W48')).toBeInTheDocument()
    expect(screen.getByTestId('newsletter-form')).toBeInTheDocument()
    expect(screen.getByText('Article One')).toBeInTheDocument()
    expect(screen.getByText('Article Two')).toBeInTheDocument()
  })

  it('reorders articles from the newsletter composition view', async () => {
    renderPage()

    await screen.findByText('Article One')
    fireEvent.click(screen.getAllByText('↓')[0])

    await waitFor(() => {
      expect(adminService.reorderArticlesInNewsletterById).toHaveBeenCalledWith('newsletter-1', ['article-2', 'article-1'])
    })
  })

  it('adds an existing article from newsletter context', async () => {
    renderPage()

    await screen.findByText('Article One')
    fireEvent.change(screen.getByLabelText('加入既有文章'), { target: { value: 'article-3' } })
    fireEvent.click(screen.getByText('加入文章'))

    await waitFor(() => {
      expect(adminService.addArticleToNewsletterById).toHaveBeenCalledWith('article-3', 'newsletter-1')
    })
  })

  it('updates lifecycle actions from publish to archive in the same workflow', async () => {
    renderPage()

    fireEvent.click(await screen.findByRole('button', { name: '發布電子報' }))

    await waitFor(() => {
      expect(adminService.publishNewsletter).toHaveBeenCalledWith('newsletter-1')
      expect(screen.getByRole('button', { name: '封存電子報' })).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: '發布電子報' })).not.toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: '封存電子報' }))

    await waitFor(() => {
      expect(adminService.archiveNewsletter).toHaveBeenCalledWith('newsletter-1')
      expect(screen.getByText('已封存')).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: '封存電子報' })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: '發布電子報' })).not.toBeInTheDocument()
    })
  })

  it('loads and manages special-edition newsletters via id routes', async () => {
    let currentSpecialNewsletter: AdminNewsletter = { ...specialEditionPublishedNewsletter }
    vi.mocked(adminService.fetchNewsletter).mockImplementation(async () => currentSpecialNewsletter as any)
    vi.mocked(adminService.archiveNewsletter).mockImplementation(async () => {
      currentSpecialNewsletter = { ...currentSpecialNewsletter, status: 'archived' as const }
      return currentSpecialNewsletter as any
    })

    renderPage('/admin/newsletters/id/special-newsletter-1')

    expect(await screen.findByText('Special Edition')).toBeInTheDocument()
    expect(adminService.fetchNewsletter).toHaveBeenCalledWith('special-newsletter-1')
    expect(adminService.fetchNewsletterByWeek).not.toHaveBeenCalled()

    const publicLink = screen.getByRole('link', { name: '查看公開頁面' })
    expect(publicLink).toHaveAttribute('href', '/newsletter/special-newsletter-1')

    fireEvent.click(screen.getByRole('button', { name: '封存電子報' }))

    await waitFor(() => {
      expect(adminService.archiveNewsletter).toHaveBeenCalledWith('special-newsletter-1')
      expect(screen.getByText('已封存')).toBeInTheDocument()
    })
  })

  it('keeps newsletter context across composition and editor transitions', async () => {
    renderPage()

    fireEvent.click((await screen.findAllByRole('button', { name: '編輯' }))[0])

    expect(await screen.findByText('Article Editor Route')).toBeInTheDocument()
    expect(screen.getByTestId('editor-path')).toHaveTextContent('/admin/articles/2025-W48/article-1')

    fireEvent.click(screen.getByRole('button', { name: 'Return to Newsletter' }))

    expect(await screen.findByText('2025-W48')).toBeInTheDocument()
    expect(screen.getByText('文章已保存')).toBeInTheDocument()
  })
})
