import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, waitFor } from '@testing-library/react'
import { WeeklyReaderPage } from './WeeklyReaderPage'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import * as useFetchWeeklyHook from '@/hooks/useFetchWeekly'
import * as useFetchArticleHook from '@/hooks/useFetchArticle'

// Mock child components to avoid rendering issues
vi.mock('@/components/ArticleListView', () => ({ ArticleListView: () => <div data-testid="article-list">Article List</div> }))
vi.mock('@/components/ArticleContent', () => ({ ArticleContent: () => <div data-testid="article-content">Article Content</div> }))
vi.mock('@/components/ArticleEditor', () => ({ ArticleEditor: () => <div data-testid="article-editor">Article Editor</div> }))
vi.mock('@/components/NavigationBar', () => ({ NavigationBar: () => <div data-testid="nav-bar">Nav Bar</div> }))
vi.mock('@/components/SideButton', () => ({ SideButton: () => <div data-testid="side-btn">Side Button</div> }))
vi.mock('@/components/UserMenu', () => ({ UserMenu: () => <div data-testid="user-menu">User Menu</div> }))
vi.mock('@/components/LoadingTimeout', () => ({ useLoadingTimeout: () => ({ isTimedOut: false }) }))

// Mock dependencies
vi.mock('@/hooks/useFetchWeekly')
vi.mock('@/hooks/useFetchArticle')
vi.mock('@/context/AuthContext', () => ({
  useAuth: vi.fn(),
  AuthProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))
vi.mock('@/context/NavigationContext', () => ({
  useNavigation: vi.fn(),
  NavigationProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

import { useAuth } from '@/context/AuthContext'
import { useNavigation } from '@/context/NavigationContext'

// Mock data
const mockArticles = [
  {
    id: 'article-1',
    title: 'Article 1',
    content: 'Content 1',
    order: 1,
    shortId: 'validId',
    weekNumber: '2025-W47',
    publicUrl: 'http://example.com/article-1',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    isPublished: true,
    viewCount: 0,
  },
  {
    id: 'article-2',
    title: 'Article 2',
    content: 'Content 2',
    order: 2,
    shortId: 'otherId',
    weekNumber: '2025-W47',
    publicUrl: 'http://example.com/article-2',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    isPublished: true,
    viewCount: 0,
  },
]

describe('WeeklyReaderPage Short URL Logic', () => {
  const mockSetCurrentWeek = vi.fn()
  const mockSetArticleList = vi.fn()
  const mockSetCurrentArticle = vi.fn()
  const mockSetNextArticleId = vi.fn()
  
  // Setup mocks before each test
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()

    // Mock useFetchWeekly to return articles
    vi.spyOn(useFetchWeeklyHook, 'useFetchWeekly').mockReturnValue({
      articles: mockArticles as any,
      newsletter: { 
        weekNumber: '2025-W47', 
        isPublished: true, 
        releaseDate: '2025-11-17',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        articleIds: ['article-1', 'article-2'],
        totalArticles: 2
      } as any,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    })

    // Mock useFetchArticle
    vi.spyOn(useFetchArticleHook, 'useFetchArticle').mockReturnValue({
      article: mockArticles[0] as any,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    })

    // Mock useAuth default (authenticated)
    vi.mocked(useAuth).mockReturnValue({
      user: { id: 'user-1', email: 'test@example.com' } as any,
      isAuthenticated: true,
      isLoading: false,
      signIn: vi.fn(),
      signOut: vi.fn(),
    })

    // Mock useNavigation
    vi.mocked(useNavigation).mockReturnValue({
      navigationState: {
        currentWeekNumber: '2025-W47',
        currentArticleId: 'article-1',
        currentArticleOrder: 1,
        totalArticlesInWeek: 2,
        articleList: mockArticles as any,
        isLoading: false,
        error: undefined,
        previousArticleId: undefined,
        nextArticleId: 'article-2',
      },
      setCurrentWeek: mockSetCurrentWeek,
      setCurrentArticle: mockSetCurrentArticle,
      setLoading: vi.fn(),
      setError: vi.fn(),
      setArticleList: mockSetArticleList,
      setPreviousArticleId: vi.fn(),
      setNextArticleId: mockSetNextArticleId,
      refreshArticleList: vi.fn(),
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  const renderPage = (initialEntry: string) => {
    return render(
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>
          <Route path="/week/:weekNumber" element={<WeeklyReaderPage />} />
          <Route path="/week/:weekNumber/:shortId" element={<WeeklyReaderPage />} />
        </Routes>
      </MemoryRouter>
    )
  }

  it('should redirect to clean URL and select article when valid shortId is provided', async () => {
    renderPage('/week/2025-W47/validId')

    await waitFor(() => {
      // Should navigate to clean URL
      expect(mockNavigate).toHaveBeenCalledWith('/week/2025-W47', { replace: true })
    })
  })

  it('should default to first article when invalid shortId is provided', async () => {
    renderPage('/week/2025-W47/invalidId')

    // Should NOT navigate (replace URL) because it falls back to default behavior
    // The default behavior is to just show the list, and the URL remains as is 
    // (or strictly speaking, the component doesn't force a redirect for invalid IDs, it just ignores them)
    // Wait a bit to ensure no navigation happens
    await new Promise(resolve => setTimeout(resolve, 100))
    expect(mockNavigate).not.toHaveBeenCalledWith('/week/2025-W47', { replace: true })
  })

  it('should redirect using cached shortId from localStorage after login', async () => {
    // Simulate state after login redirect
    localStorage.setItem('pending_short_id', 'otherId')
    localStorage.setItem('pending_week_number', '2025-W47')

    renderPage('/week/2025-W47')

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/week/2025-W47', { replace: true })
    })
    
    // Should clear cache
    expect(localStorage.getItem('pending_short_id')).toBeNull()
  })

  it('should ignore cached shortId if week number does not match', async () => {
    localStorage.setItem('pending_short_id', 'validId')
    localStorage.setItem('pending_week_number', '2025-W48') // Mismatch

    renderPage('/week/2025-W47')

    await new Promise(resolve => setTimeout(resolve, 100))
    expect(mockNavigate).not.toHaveBeenCalled()
    
    // Cache should remain (or at least not be consumed by this page)
    expect(localStorage.getItem('pending_short_id')).toBe('validId')
  })

  it('should clear cache after successful redirection', async () => {
    localStorage.setItem('pending_short_id', 'validId')
    localStorage.setItem('pending_week_number', '2025-W47')

    renderPage('/week/2025-W47')

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalled()
    })

    expect(localStorage.getItem('pending_short_id')).toBeNull()
    expect(localStorage.getItem('pending_week_number')).toBeNull()
  })
})
