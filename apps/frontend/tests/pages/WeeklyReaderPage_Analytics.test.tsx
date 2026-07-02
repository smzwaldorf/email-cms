import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, waitFor } from '@testing-library/react'
import { WeeklyReaderPage } from '@/pages/WeeklyReaderPage'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import React from 'react'
import * as useFetchWeeklyHook from '@/hooks/useFetchWeekly'
import * as useFetchArticleHook from '@/hooks/useFetchArticle'
import * as useAnalyticsTrackingHook from '@/hooks/useAnalyticsTracking'
import PermissionService from '@/services/PermissionService'

type ArticleListViewProps = {
  readArticleIds?: unknown
}

type ReaderArticle = {
  id: string
  title: string
  weekNumber: string
  newsletterId?: string
  order: number
  content: string
  createdAt: string
  updatedAt: string
  isPublished: boolean
  shortId: string
}

type NewsletterData = {
  id: string
  weekNumber: string
  releaseDate: string
  articleIds: string[]
  totalArticles: number
  isPublished: boolean
  createdAt: string
  updatedAt: string
}

type FetchWeeklyResult = ReturnType<typeof useFetchWeeklyHook.useFetchWeekly>
type FetchArticleResult = ReturnType<typeof useFetchArticleHook.useFetchArticle>

let lastArticleListViewProps: ArticleListViewProps | null = null

// Mock child components
vi.mock('@/components/ArticleListView', () => ({
  ArticleListView: (props: ArticleListViewProps) => {
    lastArticleListViewProps = props
    return <div>Article List</div>
  }
}))
vi.mock('@/components/ArticleContent', () => ({ ArticleContent: () => <div>Article Content</div> }))
vi.mock('@/components/ArticleEditor', () => ({ ArticleEditor: () => <div>Article Editor</div> }))
vi.mock('@/components/NavigationBar', () => ({ NavigationBar: () => <div>Nav Bar</div> }))
vi.mock('@/components/SideButton', () => ({ SideButton: () => <div>Side Button</div> }))
vi.mock('@/components/UserMenu', () => ({ UserMenu: () => <div>User Menu</div> }))
vi.mock('@/components/LoadingTimeout', () => ({ useLoadingTimeout: () => ({ isTimedOut: false }) }))

// Mock hooks
vi.mock('@/hooks/useFetchWeekly')
vi.mock('@/hooks/useFetchArticle')
vi.mock('@/hooks/useAnalyticsTracking', () => ({
  useAnalyticsTracking: vi.fn()
}))

vi.mock('@/services/PermissionService', () => ({
  default: {
    canEditArticle: vi.fn(),
  }
}))
vi.mock('@/services/ArticleService', () => ({
  default: {
    getArticleById: vi.fn(),
  }
}))

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ user: { id: '00000000-0000-0000-0000-000000000000' }, isAuthenticated: true }),
  AuthProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

vi.mock('@/context/NavigationContext', () => ({
  useNavigation: () => ({
    navigationState: {
      currentNewsletterId: '11111111-1111-1111-1111-111111111111',
      currentArticleId: 'article-1',
      currentArticleOrder: 1,
      totalArticlesInWeek: 1,
      articleList: [],
    },
    setCurrentNewsletter: vi.fn(),
    setCurrentArticle: vi.fn(),
    setArticleList: vi.fn(),
    setNextArticleId: vi.fn(),
  }),
  NavigationProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

describe('WeeklyReaderPage Analytics', () => {
    const mockNewsletterId = '11111111-1111-1111-1111-111111111111'
    const mockNewsletterIdW47 = '11111111-1111-1111-1111-111111111111'

    beforeEach(() => {
        vi.clearAllMocks()
        lastArticleListViewProps = null
        
        // Default mocks
        vi.mocked(PermissionService.canEditArticle).mockResolvedValue(false)
    })

    // Articles now include newsletterId since useFetchArticle returns it
    const mockArticleW48: ReaderArticle = {
        id: 'article-w48',
        title: 'Article W48',
        weekNumber: '2025-W48',
        newsletterId: mockNewsletterId, // Newsletter UUID from junction table
        order: 1,
        content: '',
        createdAt: '',
        updatedAt: '',
        isPublished: true,
        shortId: '123'
    }

    const mockArticleW47: ReaderArticle = {
        id: 'article-w47',
        title: 'Article W47',
        weekNumber: '2025-W47',
        newsletterId: mockNewsletterIdW47, // Newsletter UUID from junction table
        order: 1,
        content: '',
        createdAt: '',
        updatedAt: '',
        isPublished: true,
        shortId: '456'
    }

    it('should DISABLE analytics tracking when article newsletterId is not loaded', async () => {
        // Setup: Article without newsletterId
        const articleWithoutNewsletterId = { ...mockArticleW48, newsletterId: undefined }

        vi.spyOn(useFetchWeeklyHook, 'useFetchWeekly').mockReturnValue({
            articles: [mockArticleW47] as FetchWeeklyResult['articles'],
            newsletter: null,
            isLoading: false,
            error: null,
            refetch: vi.fn(),
        } as FetchWeeklyResult)

        vi.spyOn(useFetchArticleHook, 'useFetchArticle').mockReturnValue({
            article: articleWithoutNewsletterId as FetchArticleResult['article'],
            isLoading: false,
            error: null,
            refetch: vi.fn(),
        } as FetchArticleResult)

        render(
            <MemoryRouter initialEntries={['/newsletter/11111111-1111-1111-1111-111111111111']}>
                <Routes>
                    <Route path="/newsletter/:newsletterId" element={<WeeklyReaderPage />} />
                </Routes>
            </MemoryRouter>
        )

        await waitFor(() => {
            // Check the most recent call to useAnalyticsTracking
            const calls = vi.mocked(useAnalyticsTrackingHook.useAnalyticsTracking).mock.calls
            const lastCall = calls[calls.length - 1]
            const props = lastCall[0]

            // Expect enabled to be false because article.newsletterId is undefined
            expect(props).toEqual(expect.objectContaining({
                enabled: false,
                articleId: 'article-w48'
            }))
        })
    })

    it('should ENABLE analytics tracking when article has newsletterId', async () => {
        // Setup: Consistent data scenario with article having newsletterId
        vi.spyOn(useFetchWeeklyHook, 'useFetchWeekly').mockReturnValue({
            articles: [mockArticleW47] as FetchWeeklyResult['articles'],
            newsletter: {
                id: mockNewsletterIdW47,
                weekNumber: '2025-W47',
                releaseDate: '2025-11-30',
                articleIds: ['article-w47'],
                totalArticles: 1,
                isPublished: true,
                createdAt: '',
                updatedAt: '',
            } as NewsletterData,
            isLoading: false,
            error: null,
            refetch: vi.fn(),
        } as FetchWeeklyResult)

        vi.spyOn(useFetchArticleHook, 'useFetchArticle').mockReturnValue({
            article: mockArticleW47 as FetchArticleResult['article'], // Article with newsletterId
            isLoading: false,
            error: null,
            refetch: vi.fn(),
        } as FetchArticleResult)

        render(
            <MemoryRouter initialEntries={['/newsletter/11111111-1111-1111-1111-111111111111']}>
                <Routes>
                    <Route path="/newsletter/:newsletterId" element={<WeeklyReaderPage />} />
                </Routes>
            </MemoryRouter>
        )

        await waitFor(() => {
            const calls = vi.mocked(useAnalyticsTrackingHook.useAnalyticsTracking).mock.calls
            const lastCall = calls[calls.length - 1]
            const props = lastCall[0]

            expect(props).toEqual(expect.objectContaining({
                enabled: true,
                newsletterId: mockNewsletterIdW47, // Uses article's newsletterId
                articleId: 'article-w47'
            }))
        })
    })

    it('should DISABLE analytics tracking for admin-initiated draft inline edit flow', async () => {
        const draftArticle = { ...mockArticleW47, isPublished: false }
        vi.mocked(PermissionService.canEditArticle).mockResolvedValue(true)

        vi.spyOn(useFetchWeeklyHook, 'useFetchWeekly').mockReturnValue({
            articles: [draftArticle] as FetchWeeklyResult['articles'],
            newsletter: null,
            isLoading: false,
            error: null,
            refetch: vi.fn(),
        } as FetchWeeklyResult)

        vi.spyOn(useFetchArticleHook, 'useFetchArticle').mockReturnValue({
            article: draftArticle as FetchArticleResult['article'],
            isLoading: false,
            error: null,
            refetch: vi.fn(),
        } as FetchArticleResult)

        render(
            <MemoryRouter
                initialEntries={[
                    {
                        pathname: '/newsletter/11111111-1111-1111-1111-111111111111',
                        state: { focusArticleId: 'article-w47', startInEditMode: true },
                    },
                ]}
            >
                <Routes>
                    <Route path="/newsletter/:newsletterId" element={<WeeklyReaderPage />} />
                </Routes>
            </MemoryRouter>
        )

        await waitFor(() => {
            const calls = vi.mocked(useAnalyticsTrackingHook.useAnalyticsTracking).mock.calls
            const lastCall = calls[calls.length - 1]
            const props = lastCall[0]

            expect(props).toEqual(expect.objectContaining({
                enabled: false,
                newsletterId: mockNewsletterIdW47,
                articleId: 'article-w47'
            }))
        })

    })

    it('should DISABLE analytics tracking when newsletter is draft', async () => {
        vi.spyOn(useFetchWeeklyHook, 'useFetchWeekly').mockReturnValue({
            articles: [mockArticleW47] as FetchWeeklyResult['articles'],
            newsletter: {
                id: mockNewsletterIdW47,
                weekNumber: '2025-W47',
                releaseDate: '2025-11-30',
                articleIds: ['article-w47'],
                totalArticles: 1,
                isPublished: false,
                createdAt: '',
                updatedAt: '',
            } as NewsletterData,
            isLoading: false,
            error: null,
            refetch: vi.fn(),
        } as FetchWeeklyResult)

        vi.spyOn(useFetchArticleHook, 'useFetchArticle').mockReturnValue({
            article: mockArticleW47 as FetchArticleResult['article'],
            isLoading: false,
            error: null,
            refetch: vi.fn(),
        } as FetchArticleResult)

        render(
            <MemoryRouter initialEntries={['/newsletter/11111111-1111-1111-1111-111111111111']}>
                <Routes>
                    <Route path="/newsletter/:newsletterId" element={<WeeklyReaderPage />} />
                </Routes>
            </MemoryRouter>
        )

        await waitFor(() => {
            const calls = vi.mocked(useAnalyticsTrackingHook.useAnalyticsTracking).mock.calls
            const lastCall = calls[calls.length - 1]
            const props = lastCall[0]

            expect(props).toEqual(expect.objectContaining({
                enabled: false,
                newsletterId: mockNewsletterIdW47,
                articleId: 'article-w47'
            }))
        })

        expect(lastArticleListViewProps?.readArticleIds).toBeUndefined()
    })
})
