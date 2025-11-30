/**
 * 導航狀態 Context - 管理電子報和文章導航狀態
 */

import { createContext, useContext, useState, useCallback, ReactNode, useEffect } from 'react'
import { NavigationState, Article } from '@/types'

interface NavigationContextType {
  navigationState: NavigationState
  setCurrentWeek: (weekNumber: string) => void
  setCurrentArticle: (articleId: string, order: number) => void
  setLoading: (isLoading: boolean) => void
  setError: (error: { code: string; message: string } | undefined) => void
  setArticleList: (articles: Article[]) => void
  setPreviousArticleId: (articleId: string | undefined) => void
  setNextArticleId: (articleId: string | undefined) => void
  refreshArticleList: (articles: Article[]) => void
}

const NavigationContext = createContext<NavigationContextType | undefined>(undefined)

// 預設值
const defaultNavigationState: NavigationState = {
  currentWeekNumber: '2025-W43',
  currentArticleId: 'article-001',
  currentArticleOrder: 1,
  totalArticlesInWeek: 0,
  articleList: [],
  isLoading: false,
  error: undefined,
  previousArticleId: undefined,
  nextArticleId: undefined,
}

import { useAuth } from './AuthContext'

// ... (keep existing imports)

export function NavigationProvider({ children }: { children: ReactNode }) {
  const [navigationState, setNavigationState] = useState<NavigationState>(defaultNavigationState)
  const { isAuthenticated } = useAuth()

  // Reset navigation state when user logs out
  useEffect(() => {
    if (!isAuthenticated) {
      setNavigationState(defaultNavigationState)
    }
  }, [isAuthenticated])

  // ... (keep existing methods)

  const setCurrentWeek = useCallback((weekNumber: string) => {
    setNavigationState((prev) => ({
      ...prev,
      currentWeekNumber: weekNumber,
      currentArticleOrder: 1,
      currentArticleId: prev.articleList[0]?.id || '',
    }))
  }, [])

  const setCurrentArticle = useCallback((articleId: string, order: number) => {
    setNavigationState((prev) => ({
      ...prev,
      currentArticleId: articleId,
      currentArticleOrder: order,
    }))
  }, [])

  const setLoading = useCallback((isLoading: boolean) => {
    setNavigationState((prev) => ({
      ...prev,
      isLoading,
    }))
  }, [])

  const setError = useCallback((error: { code: string; message: string } | undefined) => {
    setNavigationState((prev) => ({
      ...prev,
      error,
    }))
  }, [])

  const setArticleList = useCallback((articles: Article[]) => {
    setNavigationState((prev) => ({
      ...prev,
      articleList: articles,
      totalArticlesInWeek: articles.length,
    }))
  }, [])

  const setPreviousArticleId = useCallback((articleId: string | undefined) => {
    setNavigationState((prev) => ({
      ...prev,
      previousArticleId: articleId,
    }))
  }, [])

  const setNextArticleId = useCallback((articleId: string | undefined) => {
    setNavigationState((prev) => ({
      ...prev,
      nextArticleId: articleId,
    }))
  }, [])

  const refreshArticleList = useCallback((articles: Article[]) => {
    setNavigationState((prev) => ({
      ...prev,
      articleList: articles,
      totalArticlesInWeek: articles.length,
    }))
  }, [])

  return (
    <NavigationContext.Provider
      value={{
        navigationState,
        setCurrentWeek,
        setCurrentArticle,
        setLoading,
        setError,
        setArticleList,
        setPreviousArticleId,
        setNextArticleId,
        refreshArticleList,
      }}
    >
      {children}
    </NavigationContext.Provider>
  )
}

/**
 * 使用導航 Context 的 Hook
 */
export function useNavigation(): NavigationContextType {
  const context = useContext(NavigationContext)
  if (!context) {
    throw new Error('useNavigation must be used within NavigationProvider')
  }
  return context
}
