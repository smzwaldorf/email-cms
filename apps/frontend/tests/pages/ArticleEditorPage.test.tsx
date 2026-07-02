import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { ArticleEditorPage } from '@/pages/ArticleEditorPage'

const mockNavigate = vi.fn()
type MockArticleFormArticle = {
  id: string
  title: string
  newsletterTargetingMode?: string
  newsletterTargetClassIds?: string[]
}
type ArticleFormProps = {
  article: MockArticleFormArticle
  onSave?: (article: MockArticleFormArticle) => void
}
type FetchArticlesResult = Awaited<ReturnType<typeof adminService.fetchArticlesByNewsletter>>
type FetchClassesResult = Awaited<ReturnType<typeof adminService.fetchClasses>>
type FetchFamiliesResult = Awaited<ReturnType<typeof adminService.fetchFamilies>>
type FetchNewsletterByWeekResult = Awaited<ReturnType<typeof adminService.fetchNewsletterByWeek>>
type UpdateArticleResult = Awaited<ReturnType<typeof adminService.updateArticle>>

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'admin-user-1' } }),
}))

vi.mock('@/components/admin/ArticleForm', () => ({
  __esModule: true,
  default: ({
    article,
    onSave,
  }: ArticleFormProps) => (
    <div>
      <button
        type="button"
        onClick={() =>
          onSave?.({
            ...article,
            title: 'Updated from article editor page',
            newsletterTargetingMode: 'targeted',
            newsletterTargetClassIds: ['A1'],
          })
        }
      >
        Save Mock
      </button>
    </div>
  ),
}))

vi.mock('@/services/adminService', () => ({
  adminService: {
    fetchArticlesByNewsletter: vi.fn(),
    fetchArticlesByNewsletterId: vi.fn(),
    fetchClasses: vi.fn(),
    fetchFamilies: vi.fn(),
    fetchNewsletterByWeek: vi.fn(),
    updateArticle: vi.fn(),
    updateArticleTargetingInNewsletterById: vi.fn(),
  },
}))

import { adminService } from '@/services/adminService'

describe('ArticleEditorPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(adminService.fetchArticlesByNewsletter).mockResolvedValue([
      {
        id: 'article-1',
        title: 'Article 1',
        content: '<p>content</p>',
        author: 'Author',
        summary: null,
        weekNumber: '2025-W49',
        order: 1,
        classIds: [],
        familyIds: [],
        status: 'draft',
        createdAt: '2025-01-01T00:00:00Z',
        updatedAt: '2025-01-01T00:00:00Z',
        editedAt: '2025-01-01T00:00:00Z',
      },
    ] as FetchArticlesResult)
    vi.mocked(adminService.fetchClasses).mockResolvedValue([] as FetchClassesResult)
    vi.mocked(adminService.fetchFamilies).mockResolvedValue([] as FetchFamiliesResult)
    vi.mocked(adminService.fetchNewsletterByWeek).mockResolvedValue({
      id: 'newsletter-1',
      weekNumber: '2025-W49',
      title: 'W49',
      description: null,
      releaseDate: '2025-12-01',
      status: 'draft',
      articleCount: 1,
      createdAt: '2025-01-01T00:00:00Z',
      updatedAt: '2025-01-01T00:00:00Z',
      publishedAt: null,
      isPublished: false,
      isTemplate: false,
    } as FetchNewsletterByWeekResult)
    vi.mocked(adminService.updateArticle).mockResolvedValue({
      id: 'article-1',
    } as UpdateArticleResult)
    vi.mocked(adminService.updateArticleTargetingInNewsletterById).mockResolvedValue()
  })

  it('persists newsletter targeting on week-based editor route', async () => {
    render(
      <MemoryRouter initialEntries={['/admin/articles/2025-W49/article-1']}>
        <Routes>
          <Route path="/admin/articles/:weekNumber/:articleId" element={<ArticleEditorPage />} />
        </Routes>
      </MemoryRouter>
    )

    fireEvent.click(await screen.findByRole('button', { name: 'Save Mock' }))

    await waitFor(() => {
      expect(adminService.fetchNewsletterByWeek).toHaveBeenCalledWith('2025-W49')
      expect(adminService.updateArticleTargetingInNewsletterById).toHaveBeenCalledWith(
        'newsletter-1',
        'article-1',
        'targeted',
        ['A1']
      )
      expect(mockNavigate).toHaveBeenCalledWith('/admin/newsletters/2025-W49', {
        state: { successMessage: '文章已保存' },
      })
    })
  })
})
