import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { AdminArticlesPage } from '@/pages/AdminArticlesPage'
import type {
  AdminArticle,
  AdminNewsletter,
  ArticleCategory,
  ArticleRevision,
  ArticleTag,
  Class,
} from '@/types/admin'

vi.mock('@/services/adminService', () => ({
  adminService: {
    fetchNewsletters: vi.fn(),
    fetchNewsletterTemplates: vi.fn(),
    fetchAllArticles: vi.fn(),
    fetchArticlesByNewsletterId: vi.fn(),
    fetchArticleNewsletterMemberships: vi.fn(),
    fetchArticleCategories: vi.fn(),
    fetchArticleTags: vi.fn(),
    fetchClasses: vi.fn(),
    fetchArticleTaxonomyAssignments: vi.fn(),
    updateArticleTaxonomyAssignments: vi.fn(),
    fetchArticleVersionHistory: vi.fn(),
    restoreArticleVersion: vi.fn(),
    createArticleCategory: vi.fn(),
    createArticleTag: vi.fn(),
    updateArticleCategory: vi.fn(),
    updateArticleTag: vi.fn(),
    activateArticleCategory: vi.fn(),
    deactivateArticleCategory: vi.fn(),
    activateArticleTag: vi.fn(),
    deactivateArticleTag: vi.fn(),
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

type TaxonomyAssignments = Record<string, { categoryIds: string[]; tagIds: string[] }>

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
    ] as AdminNewsletter[])
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
    ] as AdminNewsletter[])
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
    ] as AdminArticle[])
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
        ] as AdminArticle[]
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
      ] as AdminArticle[]
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
    vi.mocked(adminService.fetchArticleCategories).mockResolvedValue([
      {
        id: 'category-1',
        name: '校務公告',
        description: '',
        isActive: true,
        createdAt: '2025-11-01',
        updatedAt: '2025-11-01',
        deactivatedAt: null,
      },
    ] as ArticleCategory[])
    vi.mocked(adminService.fetchArticleTags).mockResolvedValue([
      {
        id: 'tag-1',
        name: '重要',
        description: '',
        isActive: true,
        createdAt: '2025-11-01',
        updatedAt: '2025-11-01',
        deactivatedAt: null,
      },
    ] as ArticleTag[])
    vi.mocked(adminService.fetchClasses).mockResolvedValue([
      {
        id: 'class-1',
        code: 'G1A',
        name: '一年甲班',
        description: '',
        gradeYear: 1,
        isActive: true,
        deactivatedAt: null,
        studentIds: [],
        teacherIds: [],
        createdAt: '2025-11-01',
        updatedAt: '2025-11-01',
      },
    ] as Class[])
    vi.mocked(adminService.fetchArticleTaxonomyAssignments).mockResolvedValue({
      'article-1': { categoryIds: ['category-1'], tagIds: ['tag-1'] },
      'article-template-1': { categoryIds: [], tagIds: [] },
    } as TaxonomyAssignments)
    vi.mocked(adminService.updateArticleTaxonomyAssignments).mockResolvedValue(undefined)
    vi.mocked(adminService.fetchArticleVersionHistory).mockResolvedValue([
      {
        id: 'revision-1',
        articleId: 'article-1',
        action: 'update',
        changedBy: 'editor-1',
        changedAt: '2025-11-03T10:00:00Z',
        canRestore: true,
        changeSummary: '更新內容（2 項欄位變更）',
        fieldDiffs: [
          { field: 'title', label: '標題', before: '舊標題', after: '新標題' },
          { field: 'status', label: '狀態', before: 'draft', after: 'published' },
        ],
      },
    ] as ArticleRevision[])
    vi.mocked(adminService.restoreArticleVersion).mockResolvedValue({
      id: 'article-1',
      title: 'All Article Restored',
      content: '<p>All</p>',
      weekNumber: '2025-W48',
      order: 1,
      status: 'draft',
      createdAt: '2025-11-01',
      updatedAt: '2025-11-04',
    } as AdminArticle)
    vi.mocked(adminService.createArticleCategory).mockResolvedValue({
      id: 'category-new',
      name: '新分類',
      description: '',
      isActive: true,
      createdAt: '2025-11-01',
      updatedAt: '2025-11-01',
      deactivatedAt: null,
    } as ArticleCategory)
    vi.mocked(adminService.createArticleTag).mockResolvedValue({
      id: 'tag-new',
      name: '新標籤',
      description: '',
      isActive: true,
      createdAt: '2025-11-01',
      updatedAt: '2025-11-01',
      deactivatedAt: null,
    } as ArticleTag)
    vi.mocked(adminService.updateArticleCategory).mockResolvedValue({} as ArticleCategory)
    vi.mocked(adminService.updateArticleTag).mockResolvedValue({} as ArticleTag)
    vi.mocked(adminService.activateArticleCategory).mockResolvedValue({} as ArticleCategory)
    vi.mocked(adminService.deactivateArticleCategory).mockResolvedValue({} as ArticleCategory)
    vi.mocked(adminService.activateArticleTag).mockResolvedValue({} as ArticleTag)
    vi.mocked(adminService.deactivateArticleTag).mockResolvedValue({} as ArticleTag)
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
    ] as AdminArticle[])
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

  it('creates a new category from taxonomy panel', async () => {
    render(
      <MemoryRouter>
        <AdminArticlesPage />
      </MemoryRouter>
    )

    await screen.findByText('All Article')
    fireEvent.change(screen.getByPlaceholderText('新增分類名稱'), {
      target: { value: '新分類' },
    })
    fireEvent.click(screen.getByRole('button', { name: '新增分類' }))

    await waitFor(() => {
      expect(adminService.createArticleCategory).toHaveBeenCalledWith('新分類', '')
    })
  })

  it('saves taxonomy assignments for an article', async () => {
    vi.mocked(adminService.fetchArticleTaxonomyAssignments).mockResolvedValueOnce({
      'article-1': { categoryIds: [], tagIds: [] },
      'article-template-1': { categoryIds: [], tagIds: [] },
    } as TaxonomyAssignments)

    render(
      <MemoryRouter>
        <AdminArticlesPage />
      </MemoryRouter>
    )

    await screen.findByText('All Article')
    fireEvent.click(screen.getByRole('button', { name: '編輯分類/標籤' }))
    fireEvent.click(screen.getByLabelText('校務公告'))
    fireEvent.click(screen.getByLabelText('重要'))
    fireEvent.click(screen.getByRole('button', { name: '儲存指派' }))

    await waitFor(() => {
      expect(adminService.updateArticleTaxonomyAssignments).toHaveBeenCalledWith('article-1', {
        categoryIds: ['category-1'],
        tagIds: ['tag-1'],
      })
    })
  })

  it('loads article revision history and restores a selected version', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)

    render(
      <MemoryRouter>
        <AdminArticlesPage />
      </MemoryRouter>
    )

    await screen.findByText('All Article')
    fireEvent.click(screen.getByRole('button', { name: '版本紀錄' }))

    await waitFor(() => {
      expect(adminService.fetchArticleVersionHistory).toHaveBeenCalledWith('article-1')
      expect(screen.getByText('更新內容（2 項欄位變更）')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: '還原此版本' }))

    await waitFor(() => {
      expect(confirmSpy).toHaveBeenCalled()
      expect(adminService.restoreArticleVersion).toHaveBeenCalledWith('article-1', 'revision-1')
      expect(screen.getByText('All Article Restored')).toBeInTheDocument()
    })

    confirmSpy.mockRestore()
  })

  it('shows taxonomy empty states when no categories and tags exist', async () => {
    vi.mocked(adminService.fetchArticleCategories).mockResolvedValueOnce([])
    vi.mocked(adminService.fetchArticleTags).mockResolvedValueOnce([])

    render(
      <MemoryRouter>
        <AdminArticlesPage />
      </MemoryRouter>
    )

    expect(await screen.findByText('尚無分類，請先建立分類。')).toBeInTheDocument()
    expect(screen.getByText('尚無標籤，請先建立標籤。')).toBeInTheDocument()
  })

  it('applies combined status/class/tag/search filters', async () => {
    vi.mocked(adminService.fetchAllArticles).mockResolvedValueOnce([
      {
        id: 'article-a',
        title: 'School Event Draft',
        content: '<p>Draft</p>',
        weekNumber: '2025-W48',
        order: 1,
        status: 'draft',
        classIds: ['class-1'],
        createdAt: '2025-11-01',
        updatedAt: '2025-11-01',
      },
      {
        id: 'article-b',
        title: 'School Event Published',
        content: '<p>Published</p>',
        weekNumber: '2025-W48',
        order: 2,
        status: 'published',
        classIds: ['class-1'],
        createdAt: '2025-11-01',
        updatedAt: '2025-11-02',
      },
      {
        id: 'article-c',
        title: 'General Notice',
        content: '<p>General</p>',
        weekNumber: '2025-W48',
        order: 3,
        status: 'published',
        classIds: ['class-2'],
        createdAt: '2025-11-01',
        updatedAt: '2025-11-03',
      },
    ] as AdminArticle[])
    vi.mocked(adminService.fetchClasses).mockResolvedValueOnce([
      {
        id: 'class-1',
        code: 'G1A',
        name: '一年甲班',
        description: '',
        gradeYear: 1,
        isActive: true,
        deactivatedAt: null,
        studentIds: [],
        teacherIds: [],
        createdAt: '2025-11-01',
        updatedAt: '2025-11-01',
      },
      {
        id: 'class-2',
        code: 'G1B',
        name: '一年乙班',
        description: '',
        gradeYear: 1,
        isActive: true,
        deactivatedAt: null,
        studentIds: [],
        teacherIds: [],
        createdAt: '2025-11-01',
        updatedAt: '2025-11-01',
      },
    ] as Class[])
    vi.mocked(adminService.fetchArticleNewsletterMemberships).mockResolvedValueOnce({
      'article-a': [{ newsletterId: 'newsletter-1', label: '2025-W48', isTemplate: false }],
      'article-b': [{ newsletterId: 'newsletter-1', label: '2025-W48', isTemplate: false }],
      'article-c': [{ newsletterId: 'newsletter-1', label: '2025-W48', isTemplate: false }],
    })
    vi.mocked(adminService.fetchArticleTaxonomyAssignments).mockResolvedValueOnce({
      'article-a': { categoryIds: ['category-1'], tagIds: ['tag-1'] },
      'article-b': { categoryIds: ['category-1'], tagIds: ['tag-1'] },
      'article-c': { categoryIds: ['category-1'], tagIds: [] },
    })

    render(
      <MemoryRouter>
        <AdminArticlesPage />
      </MemoryRouter>
    )

    await screen.findByText('School Event Draft')

    fireEvent.change(screen.getByLabelText('搜尋文章'), {
      target: { value: 'School' },
    })
    fireEvent.change(screen.getByLabelText('依狀態篩選'), {
      target: { value: 'published' },
    })
    fireEvent.change(screen.getByLabelText('依班級篩選'), {
      target: { value: 'class-1' },
    })
    fireEvent.change(screen.getByLabelText('依標籤篩選'), {
      target: { value: 'tag-1' },
    })

    await waitFor(() => {
      expect(screen.getByText('School Event Published')).toBeInTheDocument()
      expect(screen.queryByText('School Event Draft')).not.toBeInTheDocument()
      expect(screen.queryByText('General Notice')).not.toBeInTheDocument()
    })
  })

  it('restores filter state from URL query params', async () => {
    render(
      <MemoryRouter initialEntries={['/admin/articles?q=All&status=draft&tagId=tag-1&sort=title_asc']}>
        <AdminArticlesPage />
      </MemoryRouter>
    )

    await screen.findByText('All Article')

    expect((screen.getByLabelText('搜尋文章') as HTMLInputElement).value).toBe('All')
    expect((screen.getByLabelText('依狀態篩選') as HTMLSelectElement).value).toBe('draft')
    expect((screen.getByLabelText('依標籤篩選') as HTMLSelectElement).value).toBe('tag-1')
    expect((screen.getByLabelText('排序文章') as HTMLSelectElement).value).toBe('title_asc')
  })

  it('supports sorting article list by title', async () => {
    vi.mocked(adminService.fetchAllArticles).mockResolvedValueOnce([
      {
        id: 'article-z',
        title: 'Zulu',
        content: '<p>Zulu</p>',
        weekNumber: '2025-W48',
        order: 1,
        status: 'draft',
        classIds: [],
        createdAt: '2025-11-01',
        updatedAt: '2025-11-01',
      },
      {
        id: 'article-a',
        title: 'Alpha',
        content: '<p>Alpha</p>',
        weekNumber: '2025-W48',
        order: 2,
        status: 'draft',
        classIds: [],
        createdAt: '2025-11-01',
        updatedAt: '2025-11-02',
      },
    ] as AdminArticle[])
    vi.mocked(adminService.fetchArticleNewsletterMemberships).mockResolvedValueOnce({
      'article-z': [{ newsletterId: 'newsletter-1', label: '2025-W48', isTemplate: false }],
      'article-a': [{ newsletterId: 'newsletter-1', label: '2025-W48', isTemplate: false }],
    })
    vi.mocked(adminService.fetchArticleTaxonomyAssignments).mockResolvedValueOnce({
      'article-z': { categoryIds: [], tagIds: [] },
      'article-a': { categoryIds: [], tagIds: [] },
    })

    render(
      <MemoryRouter>
        <AdminArticlesPage />
      </MemoryRouter>
    )

    await screen.findByText('Zulu')
    fireEvent.change(screen.getByLabelText('排序文章'), {
      target: { value: 'title_asc' },
    })

    await waitFor(() => {
      const rows = screen.getAllByTestId(/article-row-/)
      expect(rows[0]).toHaveAttribute('data-testid', 'article-row-article-a')
      expect(rows[1]).toHaveAttribute('data-testid', 'article-row-article-z')
    })
  })
})
