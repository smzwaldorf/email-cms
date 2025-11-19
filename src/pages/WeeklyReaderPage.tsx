/**
 * 頁面 - 週報閱讀器
 * 電子報查看的主要頁面，展示週報和文章內容
 * 包含編輯權限檢查 - 只有admin和該類別的教師可編輯
 */

import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useNavigation } from '@/context/NavigationContext'
import { useAuth } from '@/context/AuthContext'
import { useFetchWeekly } from '@/hooks/useFetchWeekly'
import { useFetchArticle } from '@/hooks/useFetchArticle'
import { ArticleListView } from '@/components/ArticleListView'
import { ArticleContent } from '@/components/ArticleContent'
import { ArticleEditor } from '@/components/ArticleEditor'
import { NavigationBar } from '@/components/NavigationBar'
import { SideButton } from '@/components/SideButton'
import { UserMenu } from '@/components/UserMenu'
import { Article } from '@/types'
import PermissionService from '@/services/PermissionService'
import ArticleService from '@/services/ArticleService'

export function WeeklyReaderPage() {
  const { weekNumber: paramWeekNumber } = useParams<{ weekNumber: string }>()
  const weekNumber = paramWeekNumber || '2025-W43'

  const { user } = useAuth()
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

  const touchStartX = useRef<number | null>(null)
  const [dragOffset, setDragOffset] = useState(0)
  const [isAnimating, setIsAnimating] = useState(false)
  const [isEditMode, setIsEditMode] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [canEditArticle, setCanEditArticle] = useState(false)
  const [isCheckingPermission, setIsCheckingPermission] = useState(false)

  // 初始化導航狀態 - 當文章列表加載時或週份改變時
  useEffect(() => {
    if (articles.length > 0) {
      // 檢查是否需要初始化：週份改變或文章清單為空或文章清單內容改變（例如切換使用者）
      const weekChanged = navigation.navigationState.currentWeekNumber !== weekNumber
      const currentList = navigation.navigationState.articleList
      
      // Check if list content changed (different length or different first item)
      const listChanged = currentList.length !== articles.length || 
                         (currentList.length > 0 && currentList[0].id !== articles[0].id)

      const needsInit = currentList.length === 0 || weekChanged || listChanged

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
  }, [articles, weekNumber, navigation])

  // 檢查編輯權限 - 當文章或使用者改變時
  useEffect(() => {
    const checkEditPermission = async () => {
      if (!user?.id || !article) {
        setCanEditArticle(false)
        return
      }

      setIsCheckingPermission(true)
      try {
        const articleRow = await ArticleService.getArticleById(article.id)
        const hasPermission = await PermissionService.canEditArticle(user.id, articleRow)
        setCanEditArticle(hasPermission)
      } catch (error) {
        console.error('Failed to check edit permission:', error)
        setCanEditArticle(false)
      } finally {
        setIsCheckingPermission(false)
      }
    }

    checkEditPermission()
  }, [article?.id, user?.id])

  // 處理上一篇導航
  const handlePrevious = () => {
    const currentOrder = navigation.navigationState.currentArticleOrder
    if (currentOrder <= 1) return

    const newOrder = currentOrder - 1
    // 數組索引是 order - 1，所以上一篇的索引是 newOrder - 1
    const previousArticle = articles[newOrder - 1]

    if (previousArticle) {
      navigation.setCurrentArticle(previousArticle.id, newOrder)

      // 更新下一篇 (當前篇變成了下一篇)
      const currentArticle = articles[currentOrder - 1]
      if (currentArticle) {
        navigation.setNextArticleId(currentArticle.id)
      }
    }
  }

  // 處理下一篇導航
  const handleNext = () => {
    const currentOrder = navigation.navigationState.currentArticleOrder
    if (currentOrder >= articles.length) return

    const newOrder = currentOrder + 1
    // 數組索引是 order - 1，所以下一篇的索引是 newOrder - 1
    const nextArticle = articles[newOrder - 1]

    if (nextArticle) {
      navigation.setCurrentArticle(nextArticle.id, newOrder)

      // 更新再下一篇
      const nextNextArticle = articles[newOrder] // newOrder is index + 1, so this is index + 1
      if (nextNextArticle) {
        navigation.setNextArticleId(nextNextArticle.id)
      } else {
        navigation.setNextArticleId(undefined)
      }
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
    // 切換文章時退出編輯模式
    setIsEditMode(false)
  }

  // 處理儲存文章
  const handleSaveArticle = async (updates: Partial<Article>) => {
    if (!article || !user?.id) return

    setIsSaving(true)
    try {
      // Convert Article type to UpdateArticleDTO for ArticleService
      const updateDTO: Parameters<typeof ArticleService.updateArticle>[1] = {
        title: updates.title,
        content: updates.content,
        author: updates.author,
        isPublished: updates.isPublished,
      }

      // Update article with permission check
      await ArticleService.updateArticle(article.id, updateDTO, user.id)

      // 更新成功，退出編輯模式並刷新文章
      setIsEditMode(false)
      // 觸發重新獲取文章資料
      window.location.reload()
    } catch (error) {
      console.error('Save error:', error)
      const errorMessage = error instanceof Error ? error.message : '儲存時發生錯誤'
      alert(`儲存失敗: ${errorMessage}`)
    } finally {
      setIsSaving(false)
    }
  }

  // 處理取消編輯
  const handleCancelEdit = () => {
    setIsEditMode(false)
  }

  // 處理觸摸開始 - 記錄起始位置並開始拖曳
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX
    setIsAnimating(false)
  }

  // 處理觸摸移動 - 提供即時拖曳反饋
  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return

    const touchCurrentX = e.touches[0].clientX
    const offset = touchCurrentX - touchStartX.current
    setDragOffset(offset)
  }

  // 處理觸摸結束 - 檢測滑動方向並執行導航或復位
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return

    const touchEndX = e.changedTouches[0].clientX
    const distance = touchStartX.current - touchEndX
    const minSwipeDistance = 30 // 最小滑動距離

    setIsAnimating(true)

    // 向右滑動（距離為負） - 上一篇
    if (distance < -minSwipeDistance && canGoPrevious) {
      setDragOffset(0)
      handlePrevious()
    }
    // 向左滑動（距離為正） - 下一篇
    else if (distance > minSwipeDistance && canGoNext) {
      setDragOffset(0)
      handleNext()
    }
    // 復位到原位
    else {
      setDragOffset(0)
    }

    touchStartX.current = null
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
    <div className="relative h-screen overflow-hidden bg-waldorf-cream-100">
      {/* 桌面版：側邊欄 + 內容區 */}
      <div className="hidden md:flex h-full">
        {/* 左側邊導航按鈕 */}
        <SideButton
          direction="left"
          onClick={handlePrevious}
          disabled={!canGoPrevious}
          label="上一篇"
        />

        {/* 文章列表面板 */}
        <div className="w-72 bg-waldorf-cream-50 border-r border-waldorf-cream-200 flex flex-col">
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
          {/* Header: 編輯按鈕 + 使用者菜單 */}
          {!isEditMode && article && (
            <div className="px-6 py-2 bg-waldorf-cream-50 border-b border-waldorf-cream-200 flex justify-between items-center">
              {canEditArticle && !isCheckingPermission && (
                <button
                  onClick={() => setIsEditMode(true)}
                  className="px-4 py-2 text-sm bg-waldorf-sage-600 text-white rounded-md hover:bg-waldorf-sage-700 focus:outline-none focus:ring-2 focus:ring-waldorf-sage-500 transition-colors"
                >
                  編輯文章
                </button>
              )}
              {isCheckingPermission && (
                <div className="text-sm text-waldorf-clay-600">
                  檢查權限中...
                </div>
              )}
              {!canEditArticle && !isCheckingPermission && <div />}
              <UserMenu />
            </div>
          )}

          {/* 文章內容或編輯器 */}
          {isEditMode && article ? (
            <ArticleEditor
              article={article}
              onSave={handleSaveArticle}
              onCancel={handleCancelEdit}
              isSaving={isSaving}
            />
          ) : (
            <ArticleContent
              title={article?.title || ''}
              author={article?.author}
              content={article?.content || ''}
              createdAt={article?.createdAt}
              viewCount={article?.viewCount}
              isLoading={isLoadingArticle}
            />
          )}

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
          disabled={!canGoNext}
          label="下一篇"
        />
      </div>

      {/* 行動版：頁面式滑動 */}
      <div
        className="md:hidden h-full flex flex-col overflow-hidden"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Header: 編輯按鈕 + 使用者菜單 - 行動版 */}
        {!isEditMode && article && (
          <div className="px-4 py-2 bg-waldorf-cream-50 border-b border-waldorf-cream-200 flex justify-between items-center">
            {canEditArticle && !isCheckingPermission && (
              <button
                onClick={() => setIsEditMode(true)}
                className="px-4 py-2 text-sm bg-waldorf-sage-600 text-white rounded-md hover:bg-waldorf-sage-700 focus:outline-none focus:ring-2 focus:ring-waldorf-sage-500 transition-colors"
              >
                編輯
              </button>
            )}
            {isCheckingPermission && (
              <div className="text-sm text-waldorf-clay-600">
                檢查權限中...
              </div>
            )}
            {!canEditArticle && !isCheckingPermission && <div />}
            <UserMenu />
          </div>
        )}

        {/* 頁面容器 */}
        <div
          className={`flex-1 overflow-hidden relative ${
            isAnimating ? 'transition-transform duration-300 ease-out' : ''
          }`}
          style={{
            transform: `translateX(${dragOffset}px)`,
          }}
        >
          {/* 文章內容或編輯器 */}
          {isEditMode && article ? (
            <ArticleEditor
              article={article}
              onSave={handleSaveArticle}
              onCancel={handleCancelEdit}
              isSaving={isSaving}
            />
          ) : (
            <ArticleContent
              title={article?.title || ''}
              author={article?.author}
              content={article?.content || ''}
              createdAt={article?.createdAt}
              viewCount={article?.viewCount}
              isLoading={isLoadingArticle}
            />
          )}
        </div>

        {/* 底部導航欄 */}
        <NavigationBar
          navigationState={navigation.navigationState}
          onPrevious={handlePrevious}
          onNext={handleNext}
        />

        {/* 邊緣導航按鈕 - 行動版 */}
        {!isEditMode && (
          <>
            <div className="absolute top-1/2 left-4 -translate-y-1/2">
              <SideButton
                direction="left"
                onClick={handlePrevious}
                disabled={!canGoPrevious}
                label="上一篇"
              />
            </div>
            <div className="absolute top-1/2 right-4 -translate-y-1/2">
              <SideButton
                direction="right"
                onClick={handleNext}
                disabled={!canGoNext}
                label="下一篇"
              />
            </div>
          </>
        )}
      </div>
    </div>
  )
}
