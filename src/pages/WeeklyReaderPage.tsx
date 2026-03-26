/**
 * 頁面 - 週報閱讀器
 * 電子報查看的主要頁面，展示週報和文章內容
 * 包含編輯權限檢查 - 只有admin和該類別的教師可編輯
 */

import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { useNavigation } from '@/context/NavigationContext'
import { useAuth } from '@/context/AuthContext'
import { useFetchWeekly } from '@/hooks/useFetchWeekly'
import { useFetchArticle } from '@/hooks/useFetchArticle'
import { useLoadingTimeout } from '@/components/LoadingTimeout'
import { useAnalyticsTracking } from '@/hooks/useAnalyticsTracking'
import { useReadStatus } from '@/hooks/useReadStatus'
import { ArticleListView } from '@/components/ArticleListView'
import { ArticleContent } from '@/components/ArticleContent'
import { ArticleEditor } from '@/components/ArticleEditor'
import { NavigationBar } from '@/components/NavigationBar'
import { SideButton } from '@/components/SideButton'
import { UserMenu } from '@/components/UserMenu'
import { Article } from '@/types'
import PermissionService from '@/services/PermissionService'
import ArticleService from '@/services/ArticleService'
import { getAdminNewsletterPath } from '@/utils/adminNewsletterRoutes'

import WeekService from '@/services/WeekService'

type WeeklyReaderLocationState = {
  focusArticleId?: string
  startInEditMode?: boolean
}

export function WeeklyReaderPage() {
  // Parameters can come from different routes:
  // - /week/:weekNumber - regular newsletters with week_number (e.g., "2025-W47")
  // - /newsletter/:newsletterId - special editions using UUID
  const { weekNumber, newsletterId, shortId } = useParams<{ 
    weekNumber?: string, 
    newsletterId?: string, 
    shortId?: string 
  }>()
  const { articleId } = useParams<{ articleId?: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const locationState = location.state as WeeklyReaderLocationState | null
  const queryParams = new URLSearchParams(location.search)
  const isAdminInlineFromQuery = queryParams.get('admin') === '1'
  const journeyCorrelationId = queryParams.get('jc')

  const { user } = useAuth()
  const navigation = useNavigation()

  // Resolve newsletter ID based on which route was used
  // - /newsletter/:newsletterId - use directly, no conversion needed
  // - /week/:weekNumber - convert week_number to newsletter UUID
  const [resolvedNewsletterId, setResolvedNewsletterId] = useState<string | null>(
    newsletterId || null
  )

  useEffect(() => {
    if (newsletterId) {
      // /newsletter/:newsletterId route - use directly
      setResolvedNewsletterId(newsletterId)
    } else if (articleId) {
      ArticleService.getArticleWithNewsletter(articleId)
        .then((articleWithContext) => {
          if (articleWithContext.newsletter_id) {
            setResolvedNewsletterId(articleWithContext.newsletter_id)
          }
        })
        .catch((err) => {
          console.error('[WeeklyReaderPage] Failed to resolve article route context:', err)
        })
    } else if (weekNumber) {
      // /week/:weekNumber route - look up newsletter UUID from week_number
      WeekService.getWeek(weekNumber)
        .then(newsletter => {
          setResolvedNewsletterId(newsletter.id)
        })
        .catch(err => {
          console.error('[WeeklyReaderPage] Failed to resolve week number:', err)
          // Keep weekNumber as fallback (will likely fail downstream)
          setResolvedNewsletterId(weekNumber)
        })
    }
  }, [weekNumber, newsletterId, articleId])

  // Use resolved newsletter ID
  const currentNewsletterId = resolvedNewsletterId || weekNumber || newsletterId || ''

  const {
    newsletter,
    articles,
    isLoading: isLoadingWeekly,
    error: weeklyError,
    refetch: refetchWeekly,
  } = useFetchWeekly(currentNewsletterId)

  // Check if the navigation state is synchronized with the current newsletter
  // This prevents fetching a stale article ID from a previous newsletter when switching
  const isNavigationSynced = navigation.navigationState.currentNewsletterId === currentNewsletterId
  const currentArticleId = isNavigationSynced 
    ? navigation.navigationState.currentArticleId 
    : '' // Don't fetch stale article when newsletter is changing
  
  const { 
    article, 
    isLoading: isLoadingArticle,
    refetch: refetchArticle
  } = useFetchArticle(
    currentArticleId,
    currentNewsletterId // Pass context for correct newsletter resolution on shared articles
  )

  const touchStartX = useRef<number | null>(null)
  const [dragOffset, setDragOffset] = useState(0)
  const [isAnimating, setIsAnimating] = useState(false)
  const [isEditMode, setIsEditMode] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [canEditArticle, setCanEditArticle] = useState(false)
  const [isCheckingPermission, setIsCheckingPermission] = useState(false)
  const [permissionCheckedArticleId, setPermissionCheckedArticleId] = useState<string | null>(null)
  const [pendingInlineEditArticleId, setPendingInlineEditArticleId] = useState<string | null>(null)
  const [isAdminInlineEntry, setIsAdminInlineEntry] = useState(false)
  const [showBackToAdminAction, setShowBackToAdminAction] = useState(false)
  const shouldShowAdminBackEntry = isAdminInlineEntry || isAdminInlineFromQuery
  const shouldShowReadStatus = newsletter?.isPublished === true

  const shouldSuppressDraftEditAnalytics =
    article?.isPublished === false &&
    (
      isEditMode ||
      (locationState?.startInEditMode === true && locationState?.focusArticleId === article?.id)
    )

  // Tracking Hooks - use article's own newsletter ID for accurate analytics tracking
  // This ensures the correct newsletter ID is logged even when viewing articles from different weeks
  // Skip analytics for draft inline-edit sessions initiated from admin compose flow.
  useAnalyticsTracking({
    articleId: article?.id,
    newsletterId: article?.newsletterId, // Use article's newsletter ID, not the URL week's newsletter
    enabled:
      !!article?.id &&
      !!article?.newsletterId &&
      isNavigationSynced &&
      newsletter?.isPublished === true &&
      !shouldSuppressDraftEditAnalytics,
  });

  const { readArticleIds, markAsRead } = useReadStatus(currentNewsletterId);

  // Mark current article as read when loaded
  useEffect(() => {
    if (shouldShowReadStatus && article?.id) {
      markAsRead(article.id);
    }
  }, [article?.id, markAsRead, shouldShowReadStatus]);

  // Detect loading timeouts (show error if loading > 3 seconds)
  const { isTimedOut: isLoadingTimedOut } = useLoadingTimeout(
    isLoadingWeekly && articles.length === 0,
    3000 // 3 second timeout
  )

  // 初始化導航狀態 - 當文章列表加載時或週份改變時
  useEffect(() => {
    if (articles.length > 0) {
      // 檢查是否需要初始化：週份改變或文章清單為空
      const weekChanged = navigation.navigationState.currentNewsletterId !== currentNewsletterId
      const currentList = navigation.navigationState.articleList
      const isFirstLoad = currentList.length === 0
      
      // Check if list content changed (different length or different first item)
      // This is to detect if we need to update the list in context
      const listChanged = currentList.length !== articles.length || 
                         (currentList.length > 0 && currentList[0].id !== articles[0].id) ||
                         // Check if any title changed (e.g. after edit)
                         (currentList.length === articles.length && 
                          JSON.stringify(currentList.map(a => a.title)) !== JSON.stringify(articles.map(a => a.title)))

      const targetShortId = shortId

      if (targetShortId) {
        // Handle short URL redirection
        const targetArticle = articles.find(a => a.shortId === targetShortId)

        if (targetArticle) {
          navigation.setCurrentNewsletter(currentNewsletterId)
          navigation.setArticleList(articles)
          navigation.setCurrentArticle(targetArticle.id, targetArticle.order ?? 1)
          
          // Update next article
          const targetOrder = targetArticle.order ?? 1
          if (targetOrder < articles.length) {
            navigation.setNextArticleId(articles[targetOrder]?.id)
          } else {
            navigation.setNextArticleId(undefined)
          }

          // Replace URL to clean version
          // Use /week/:week_number for regular newsletters, /newsletter/:uuid for special editions
          const redirectPath = targetArticle.weekNumber 
            ? `/week/${targetArticle.weekNumber}` 
            : `/newsletter/${currentNewsletterId}`
          const redirectWithCorrelation = journeyCorrelationId
            ? `${redirectPath}?jc=${encodeURIComponent(journeyCorrelationId)}`
            : redirectPath
          navigate(redirectWithCorrelation, { replace: true })
          return
        }
      }

      if (articleId) {
        const targetArticle = articles.find((item) => item.id === articleId)
        if (targetArticle) {
          const targetOrder = targetArticle.order ?? 1
          navigation.setCurrentNewsletter(currentNewsletterId)
          navigation.setArticleList(articles)
          navigation.setCurrentArticle(targetArticle.id, targetOrder)
          if (targetOrder < articles.length) {
            navigation.setNextArticleId(articles[targetOrder]?.id)
          } else {
            navigation.setNextArticleId(undefined)
          }

          const redirectPath = targetArticle.weekNumber
            ? `/week/${targetArticle.weekNumber}`
            : `/newsletter/${currentNewsletterId}`
          const redirectWithCorrelation = journeyCorrelationId
            ? `${redirectPath}?jc=${encodeURIComponent(journeyCorrelationId)}`
            : redirectPath
          navigate(redirectWithCorrelation, { replace: true })
          return
        }
      }

      // Verify articles belong to the current newsletter using newsletterId
      // This handles both regular newsletters (with week_number) and special editions (UUID only)
      const firstArticleNewsletterId = articles[0].newsletterId
      const isCorrectNewsletter = firstArticleNewsletterId === currentNewsletterId || 
        // Fallback: if newsletterId not set but weekNumber matches, still valid
        articles[0].weekNumber === currentNewsletterId

      if ((weekChanged || isFirstLoad) && isCorrectNewsletter) {
        const firstArticle = articles[0]
        navigation.setCurrentNewsletter(currentNewsletterId)
        navigation.setCurrentArticle(firstArticle.id, 1)
        navigation.setArticleList(articles)

        // 更新下一篇
        if (articles.length > 1) {
          navigation.setNextArticleId(articles[1].id)
        } else {
          navigation.setNextArticleId(undefined)
        }
      } else if (listChanged && isCorrectNewsletter) {
        // Only update the list, preserve current selection
        navigation.setArticleList(articles)
      }
    }
  }, [articles, articleId, currentNewsletterId, journeyCorrelationId, navigation, shortId, navigate])

  useEffect(() => {
    if (locationState?.focusArticleId) {
      setPendingInlineEditArticleId(locationState.focusArticleId)
    }
  }, [locationState?.focusArticleId])

  useEffect(() => {
    if (
      isAdminInlineFromQuery ||
      (locationState?.startInEditMode && locationState?.focusArticleId)
    ) {
      setIsAdminInlineEntry(true)
    }
  }, [isAdminInlineFromQuery, locationState?.focusArticleId, locationState?.startInEditMode])

  useEffect(() => {
    if (!pendingInlineEditArticleId || articles.length === 0) return

    const targetArticle = articles.find((item) => item.id === pendingInlineEditArticleId)
    if (!targetArticle) {
      setPendingInlineEditArticleId(null)
      return
    }

    const targetOrder = targetArticle.order ?? 1
    if (navigation.navigationState.currentArticleId !== targetArticle.id) {
      navigation.setCurrentArticle(targetArticle.id, targetOrder)
      if (targetOrder < articles.length) {
        navigation.setNextArticleId(articles[targetOrder]?.id)
      } else {
        navigation.setNextArticleId(undefined)
      }
    }
  }, [articles, pendingInlineEditArticleId, navigation])

  // 檢查編輯權限 - 當文章或使用者改變時
  useEffect(() => {
    const checkEditPermission = async () => {
      if (!user?.id || !article) {
        setCanEditArticle(false)
        setPermissionCheckedArticleId(null)
        return
      }

      setIsCheckingPermission(true)
      setPermissionCheckedArticleId(null)
      try {
        const articleRow = await ArticleService.getArticleById(article.id)
        const hasPermission = await PermissionService.canEditArticle(user.id, articleRow)
        setCanEditArticle(hasPermission)
      } catch (error) {
        console.error('Failed to check edit permission:', error)
        setCanEditArticle(false)
      } finally {
        setIsCheckingPermission(false)
        setPermissionCheckedArticleId(article.id)
      }
    }

    checkEditPermission()
  }, [article?.id, user?.id])

  useEffect(() => {
    if (!pendingInlineEditArticleId) return
    if (article?.id !== pendingInlineEditArticleId) return
    if (permissionCheckedArticleId !== article.id) return

    if (locationState?.startInEditMode && canEditArticle) {
      setIsEditMode(true)
    }
    setPendingInlineEditArticleId(null)
    navigate(`${location.pathname}${location.search}`, { replace: true, state: null })
  }, [
    article?.id,
    canEditArticle,
    location.pathname,
    location.search,
    locationState?.startInEditMode,
    navigate,
    pendingInlineEditArticleId,
    permissionCheckedArticleId,
  ])

  // 處理上一篇導航
  const handlePrevious = () => {
    if (isEditMode) return // Disable navigation while editing

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
    if (isEditMode) return // Disable navigation while editing

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
    if (isEditMode) return // Disable navigation while editing

    const selectedArticle = articles.find((a) => a.id === articleId)
    if (selectedArticle) {
      const selectedOrder = selectedArticle.order ?? 1
      navigation.setCurrentArticle(articleId, selectedOrder)

      // 更新下一篇
      if (selectedOrder < articles.length) {
        navigation.setNextArticleId(
          articles[selectedOrder]?.id
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
        summary: updates.summary,
        content: updates.content,
        author: updates.author,
        isPublished: updates.isPublished,
      }

      // Update article with permission check
      await ArticleService.updateArticle(article.id, updateDTO, user.id)

      // 更新成功，退出編輯模式並刷新文章
      setIsEditMode(false)
      if (shouldShowAdminBackEntry) {
        setShowBackToAdminAction(true)
      }
      // 觸發重新獲取文章資料
      await Promise.all([
        refetchWeekly(),
        refetchArticle()
      ])
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

  const handleBackToAdminPanel = () => {
    const adminTargetId = newsletter?.id || newsletterId || currentNewsletterId
    if (!adminTargetId) return

    navigate(
      getAdminNewsletterPath({
        id: adminTargetId,
        weekNumber: weekNumber ?? null,
      }),
      {
        state: { successMessage: '文章已保存' },
      }
    )
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

  // Handle loading timeout (show error if loading > 3 seconds)
  if (isLoadingTimedOut && !weeklyError) {
    return (
      <div className="flex items-center justify-center h-screen bg-waldorf-cream-100">
        <div className="text-center max-w-md">
          <h1 className="text-2xl font-bold text-waldorf-clay-800 mb-4">
            加載超時
          </h1>
          <p className="text-waldorf-clay-600 mb-6">
            頁面加載時間過長。請重新載入頁面。
          </p>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-2 bg-waldorf-sage-600 text-white rounded-md hover:bg-waldorf-sage-700 focus:outline-none focus:ring-2 focus:ring-waldorf-sage-500 transition-colors"
          >
            重新載入頁面
          </button>
        </div>
      </div>
    )
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
        {!isEditMode && (
          <SideButton
            direction="left"
            onClick={handlePrevious}
            disabled={!canGoPrevious}
            label="上一篇"
          />
        )}

        {/* 文章列表面板 */}
        <div className="w-72 bg-waldorf-cream-50 border-r border-waldorf-cream-200 flex flex-col">
          <ArticleListView
            weekNumber={currentNewsletterId}
            articles={articles}
            selectedArticleId={navigation.navigationState.currentArticleId}
            onSelectArticle={handleSelectArticle}
            isLoading={isLoadingWeekly}
            disabled={isEditMode}
            readArticleIds={shouldShowReadStatus ? readArticleIds : undefined}
            headerAction={
              shouldShowAdminBackEntry ? (
                <button
                  onClick={handleBackToAdminPanel}
                  className="rounded-md border border-waldorf-cream-300 bg-white px-2.5 py-1.5 text-xs font-medium text-waldorf-clay-700 transition-colors hover:bg-waldorf-cream-50 focus:outline-none focus:ring-2 focus:ring-waldorf-sage-500"
                >
                  返回後台
                </button>
              ) : undefined
            }
          />
        </div>

        {/* 文章內容面板 */}
        <div className="flex-1 flex flex-col">
          {/* Header: 編輯按鈕 + 使用者菜單 */}
          {!isEditMode && article && (
            <div className="px-6 py-2 bg-waldorf-cream-50 border-b border-waldorf-cream-200 flex justify-between items-center">
              {canEditArticle && !isCheckingPermission && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setIsEditMode(true)}
                    className="px-4 py-2 text-sm bg-waldorf-sage-600 text-white rounded-md hover:bg-waldorf-sage-700 focus:outline-none focus:ring-2 focus:ring-waldorf-sage-500 transition-colors"
                  >
                    編輯文章
                  </button>
                  {showBackToAdminAction && (
                    <button
                      onClick={handleBackToAdminPanel}
                      className="px-4 py-2 text-sm bg-white text-waldorf-clay-700 border border-waldorf-cream-300 rounded-md hover:bg-waldorf-cream-50 focus:outline-none focus:ring-2 focus:ring-waldorf-sage-500 transition-colors"
                    >
                      返回管理後台
                    </button>
                  )}
                </div>
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
        {!isEditMode && (
          <NavigationBar
            navigationState={navigation.navigationState}
            onPrevious={handlePrevious}
            onNext={handleNext}
            onEdit={canEditArticle ? () => setIsEditMode(true) : undefined}
          />
        )}
        </div>

        {/* 右側邊導航按鈕 */}
        {!isEditMode && (
          <SideButton
            direction="right"
            onClick={handleNext}
            disabled={!canGoNext}
            label="下一篇"
          />
        )}
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
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsEditMode(true)}
                  className="px-4 py-2 text-sm bg-waldorf-sage-600 text-white rounded-md hover:bg-waldorf-sage-700 focus:outline-none focus:ring-2 focus:ring-waldorf-sage-500 transition-colors"
                >
                  編輯
                </button>
                {showBackToAdminAction && (
                  <button
                    onClick={handleBackToAdminPanel}
                    className="px-4 py-2 text-sm bg-white text-waldorf-clay-700 border border-waldorf-cream-300 rounded-md hover:bg-waldorf-cream-50 focus:outline-none focus:ring-2 focus:ring-waldorf-sage-500 transition-colors"
                  >
                    返回管理後台
                  </button>
                )}
              </div>
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
        {!isEditMode && (
          <NavigationBar
            navigationState={navigation.navigationState}
            onPrevious={handlePrevious}
            onNext={handleNext}
            onEdit={canEditArticle ? () => setIsEditMode(true) : undefined}
          />
        )}

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
