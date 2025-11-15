/**
 * 頁面 - 週報閱讀器
 * 電子報查看的主要頁面，展示週報和文章內容
 */

import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useNavigation } from '@/context/NavigationContext'
import { useFetchWeekly } from '@/hooks/useFetchWeekly'
import { useFetchArticle } from '@/hooks/useFetchArticle'
import { fetchNextArticleId, fetchPreviousArticleId } from '@/services/mockApi'
import { ArticleListView } from '@/components/ArticleListView'
import { ArticleContent } from '@/components/ArticleContent'
import { NavigationBar } from '@/components/NavigationBar'
import { SideButton } from '@/components/SideButton'

export function WeeklyReaderPage() {
  const { weekNumber: paramWeekNumber } = useParams<{ weekNumber: string }>()
  const weekNumber = paramWeekNumber || '2025-W43'

  const navigation = useNavigation()
  const {
    articles,
    isLoading: isLoadingWeekly,
    error: weeklyError,
  } = useFetchWeekly(weekNumber)

  const currentArticleId = navigation.navigationState.currentArticleId
  const { article, isLoading: isLoadingArticle } = useFetchArticle(
    currentArticleId
  )

  const [isLoadingNavigation, setIsLoadingNavigation] = useState(false)

  // 初始化導航狀態 - 當文章列表加載時或週份改變時
  useEffect(() => {
    if (articles.length > 0) {
      // 檢查是否需要初始化：週份改變或文章清單為空
      const weekChanged = navigation.navigationState.currentWeekNumber !== weekNumber
      const needsInit = navigation.navigationState.articleList.length === 0 || weekChanged

      if (needsInit) {
        const firstArticle = articles[0]
        navigation.setCurrentWeek(weekNumber)
        navigation.setCurrentArticle(firstArticle.id, 1)
        navigation.setArticleList(articles)

        // 更新下一篇
        if (articles.length > 1) {
          navigation.setNextArticleId(articles[1].id)
        } else {
          navigation.setNextArticleId(undefined)
        }
      }
    }
  }, [articles, weekNumber])

  // 處理上一篇導航
  const handlePrevious = async () => {
    if (navigation.navigationState.currentArticleOrder <= 1) return

    setIsLoadingNavigation(true)
    try {
      const previousArticleId = await fetchPreviousArticleId(
        weekNumber,
        navigation.navigationState.currentArticleOrder
      )

      if (previousArticleId) {
        const newOrder = navigation.navigationState.currentArticleOrder - 1
        navigation.setCurrentArticle(previousArticleId, newOrder)

        // 更新下一篇
        if (newOrder < articles.length) {
          navigation.setNextArticleId(articles[newOrder].id)
        } else {
          navigation.setNextArticleId(undefined)
        }
      }
    } finally {
      setIsLoadingNavigation(false)
    }
  }

  // 處理下一篇導航
  const handleNext = async () => {
    if (
      navigation.navigationState.currentArticleOrder >=
      navigation.navigationState.totalArticlesInWeek
    )
      return

    setIsLoadingNavigation(true)
    try {
      const nextArticleId = await fetchNextArticleId(
        weekNumber,
        navigation.navigationState.currentArticleOrder
      )

      if (nextArticleId) {
        const newOrder = navigation.navigationState.currentArticleOrder + 1
        navigation.setCurrentArticle(nextArticleId, newOrder)

        // 更新下一篇
        if (newOrder < articles.length) {
          navigation.setNextArticleId(articles[newOrder].id)
        } else {
          navigation.setNextArticleId(undefined)
        }
      }
    } finally {
      setIsLoadingNavigation(false)
    }
  }

  // 處理文章選擇
  const handleSelectArticle = (articleId: string) => {
    const selectedArticle = articles.find((a) => a.id === articleId)
    if (selectedArticle) {
      navigation.setCurrentArticle(articleId, selectedArticle.order)

      // 更新下一篇
      if (selectedArticle.order < articles.length) {
        navigation.setNextArticleId(
          articles[selectedArticle.order].id
        )
      } else {
        navigation.setNextArticleId(undefined)
      }
    }
  }

  if (weeklyError) {
    return (
      <div className="flex items-center justify-center h-screen bg-waldorf-cream-100">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-waldorf-clay-800 mb-2">
            週報載入失敗
          </h1>
          <p className="text-waldorf-clay-600">{weeklyError.message}</p>
        </div>
      </div>
    )
  }

  const canGoPrevious = navigation.navigationState.currentArticleOrder > 1
  const canGoNext =
    navigation.navigationState.currentArticleOrder <
    navigation.navigationState.totalArticlesInWeek

  return (
    <div className="flex h-screen bg-waldorf-cream-100">
      {/* 左側邊導航按鈕 */}
      <SideButton
        direction="left"
        onClick={handlePrevious}
        disabled={!canGoPrevious || isLoadingNavigation}
        label="上一篇"
      />

      {/* 文章列表面板 - 在行動裝置上隱藏 */}
      <div className="hidden md:flex w-72 bg-waldorf-cream-50 border-r border-waldorf-cream-200 flex-col">
        <ArticleListView
          weekNumber={weekNumber}
          articles={articles}
          selectedArticleId={navigation.navigationState.currentArticleId}
          onSelectArticle={handleSelectArticle}
          isLoading={isLoadingWeekly}
        />
      </div>

      {/* 文章內容面板 */}
      <div className="flex-1 flex flex-col">
        <ArticleContent
          title={article?.title || ''}
          author={article?.author}
          content={article?.content || ''}
          createdAt={article?.createdAt}
          viewCount={article?.viewCount}
          isLoading={isLoadingArticle || isLoadingNavigation}
        />

        {/* 底部導航欄 */}
        <NavigationBar
          navigationState={navigation.navigationState}
          onPrevious={handlePrevious}
          onNext={handleNext}
        />
      </div>

      {/* 右側邊導航按鈕 */}
      <SideButton
        direction="right"
        onClick={handleNext}
        disabled={!canGoNext || isLoadingNavigation}
        label="下一篇"
      />
    </div>
  )
}
