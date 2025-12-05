import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { WeeklyReaderPage } from '@/pages/WeeklyReaderPage'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import * as useFetchWeeklyHook from '@/hooks/useFetchWeekly'
import * as useFetchArticleHook from '@/hooks/useFetchArticle'
import PermissionService from '@/services/PermissionService'
import ArticleService from '@/services/ArticleService'

// Mock child components to verify props
vi.mock('@/components/ArticleListView', () => ({ 
  ArticleListView: (props: any) => <div data-testid="article-list" data-disabled={props.disabled ? 'true' : 'false'}>Article List</div> 
}))
vi.mock('@/components/ArticleContent', () => ({ ArticleContent: () => <div data-testid="article-content">Article Content</div> }))
vi.mock('@/components/ArticleEditor', () => ({ ArticleEditor: () => <div data-testid="article-editor">Article Editor</div> }))
vi.mock('@/components/NavigationBar', () => ({ 
  NavigationBar: (props: any) => <div data-testid="nav-bar" data-disabled={props.disabled ? 'true' : 'false'}>Nav Bar</div> 
}))
vi.mock('@/components/SideButton', () => ({ 
  SideButton: (props: any) => <div data-testid="side-btn" data-disabled={props.disabled ? 'true' : 'false'}>Side Button</div> 
}))
vi.mock('@/components/UserMenu', () => ({ UserMenu: () => <div data-testid="user-menu">User Menu</div> }))
vi.mock('@/components/LoadingTimeout', () => ({ useLoadingTimeout: () => ({ isTimedOut: false }) }))

// Mock dependencies
vi.mock('@/hooks/useFetchWeekly')
vi.mock('@/hooks/useFetchArticle')
vi.mock('@/services/PermissionService', () => ({
  default: {
    canEditArticle: vi.fn(),
    canViewArticle: vi.fn(),
  }
}))
vi.mock('@/services/ArticleService', () => ({
  default: {
    getArticleById: vi.fn(),
    updateArticle: vi.fn(),
  }
}))

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
    weekNumber: '2025-W47',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    isPublished: true,
  },
  {
    id: 'article-2',
    title: 'Article 2',
    content: 'Content 2',
    order: 2,
    weekNumber: '2025-W47',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    isPublished: true,
  },
]

describe('WeeklyReaderPage Navigation', () => {
  const mockSetCurrentWeek = vi.fn()
  const mockSetArticleList = vi.fn()
  const mockSetCurrentArticle = vi.fn()
  const mockSetNextArticleId = vi.fn()
  
  beforeEach(() => {
    vi.clearAllMocks()

    // Mock useFetchWeekly
    vi.spyOn(useFetchWeeklyHook, 'useFetchWeekly').mockReturnValue({
      articles: mockArticles as any,
      newsletter: { totalArticles: 2 } as any,
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

    // Mock useAuth
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

    // Mock PermissionService
    vi.mocked(PermissionService.canEditArticle).mockResolvedValue(true)
    vi.mocked(ArticleService.getArticleById).mockResolvedValue(mockArticles[0] as any)
  })

  const renderPage = () => {
    return render(
      <MemoryRouter initialEntries={['/week/2025-W47']}>
        <Routes>
          <Route path="/week/:weekNumber" element={<WeeklyReaderPage />} />
        </Routes>
      </MemoryRouter>
    )
  }

  it('should hide navigation when entering edit mode', async () => {
    renderPage()

    // Wait for permission check
    await waitFor(() => {
      expect(screen.getByText('編輯文章')).toBeInTheDocument()
    })

    // Click edit button
    fireEvent.click(screen.getByText('編輯文章'))

    // Verify ArticleListView is disabled
    const articleList = screen.getByTestId('article-list')
    expect(articleList).toHaveAttribute('data-disabled', 'true')

    // Verify NavigationBar is hidden
    expect(screen.queryByTestId('nav-bar')).not.toBeInTheDocument()

    // Verify SideButtons are hidden (desktop)
    expect(screen.queryByTestId('side-btn')).not.toBeInTheDocument()
  })

  it('should enable navigation when not in edit mode', async () => {
    renderPage()

    // Wait for permission check
    await waitFor(() => {
      expect(screen.getByText('編輯文章')).toBeInTheDocument()
    })

    // Verify ArticleListView is NOT disabled
    const articleList = screen.getByTestId('article-list')
    expect(articleList).toHaveAttribute('data-disabled', 'false')

    // Verify NavigationBar is NOT disabled
    const navBars = screen.getAllByTestId('nav-bar')
    navBars.forEach(navBar => {
      expect(navBar).toHaveAttribute('data-disabled', 'false')
    })
  })
})
