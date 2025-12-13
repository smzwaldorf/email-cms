import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, waitFor } from '@testing-library/react'
import { WeeklyReaderPage } from '@/pages/WeeklyReaderPage'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import * as useFetchWeeklyHook from '@/hooks/useFetchWeekly'
import * as useFetchArticleHook from '@/hooks/useFetchArticle'
import * as useAnalyticsTrackingHook from '@/hooks/useAnalyticsTracking'
import PermissionService from '@/services/PermissionService'
import ArticleService from '@/services/ArticleService'

// Mock child components
vi.mock('@/components/ArticleListView', () => ({ ArticleListView: () => <div>Article List</div> }))
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
  useAuth: () => ({ user: { id: 'user-1' }, isAuthenticated: true }),
  AuthProvider: ({ children }: any) => <div>{children}</div>,
}))

vi.mock('@/context/NavigationContext', () => ({
  useNavigation: () => ({
    navigationState: {
      currentArticleId: 'article-1',
      currentArticleOrder: 1,
      totalArticlesInWeek: 1,
      articleList: [],
    },
    setCurrentWeek: vi.fn(),
    setCurrentArticle: vi.fn(),
    setArticleList: vi.fn(),
    setNextArticleId: vi.fn(),
  }),
  NavigationProvider: ({ children }: any) => <div>{children}</div>,
}))

describe('WeeklyReaderPage Analytics', () => {
    const mockNewsletterId = '11111111-1111-1111-1111-111111111111'
    const mockNewsletterIdW47 = '22222222-2222-2222-2222-222222222222'

    beforeEach(() => {
        vi.clearAllMocks()
        
        // Default mocks
        vi.mocked(PermissionService.canEditArticle).mockResolvedValue(false)
    })

    // Articles now include newsletterId since useFetchArticle returns it
    const mockArticleW48 = {
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

    const mockArticleW47 = {
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
            articles: [mockArticleW47] as any,
            newsletter: null,
            isLoading: false,
            error: null,
            refetch: vi.fn(),
        })

        vi.spyOn(useFetchArticleHook, 'useFetchArticle').mockReturnValue({
            article: articleWithoutNewsletterId as any,
            isLoading: false,
            error: null,
            refetch: vi.fn(),
        })

        render(
            <MemoryRouter initialEntries={['/week/2025-W47']}>
                <Routes>
                    <Route path="/week/:weekNumber" element={<WeeklyReaderPage />} />
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
            articles: [mockArticleW47] as any,
            newsletter: null, // Newsletter from URL not needed anymore
            isLoading: false,
            error: null,
            refetch: vi.fn(),
        })

        vi.spyOn(useFetchArticleHook, 'useFetchArticle').mockReturnValue({
            article: mockArticleW47 as any, // Article with newsletterId
            isLoading: false,
            error: null,
            refetch: vi.fn(),
        })

        render(
            <MemoryRouter initialEntries={['/week/2025-W47']}>
                <Routes>
                    <Route path="/week/:weekNumber" element={<WeeklyReaderPage />} />
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
})
