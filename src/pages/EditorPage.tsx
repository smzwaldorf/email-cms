/**
 * 頁面 - 文章編輯器
 * 編輯者專用的完整編輯介面，支持添加、編輯、刪除和重新排列文章
 * 路由: /editor/:weekNumber
 */

import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Article, NewsletterWeek } from '@/types'
import { fetchWeeklyNewsletter, updateArticle, reorderArticles, deleteArticle, createArticle } from '@/services/mockApi'
import { ArticleEditor } from '@/components/ArticleEditor'
import { ArticleOrderManager } from '@/components/ArticleOrderManager'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import clsx from 'clsx'

export interface EditorPageState {
  articles: Article[]
  weekData: NewsletterWeek | null
  isLoading: boolean
  isSaving: boolean
  error: string | null
  editingArticleId: string | null
  unsavedChanges: boolean
}

export function EditorPage() {
  const { weekNumber } = useParams<{ weekNumber: string }>()
  const navigate = useNavigate()

  const [state, setState] = useState<EditorPageState>({
    articles: [],
    weekData: null,
    isLoading: true,
    isSaving: false,
    error: null,
    editingArticleId: null,
    unsavedChanges: false,
  })

  // 加載週報資料
  useEffect(() => {
    if (!weekNumber) {
      setState(prev => ({ ...prev, error: '週份資訊缺失' }))
      return
    }

    loadWeeklyData(weekNumber)
  }, [weekNumber])

  // 加載週報和文章資料
  const loadWeeklyData = async (week: string) => {
    setState(prev => ({ ...prev, isLoading: true, error: null }))
    try {
      const weekData = await fetchWeeklyNewsletter(week)
      setState(prev => ({
        ...prev,
        weekData,
        articles: weekData.articles || [],
        isLoading: false,
      }))
    } catch (err) {
      setState(prev => ({
        ...prev,
        error: '載入週報資料失敗',
        isLoading: false,
      }))
    }
  }

  // 處理文章保存
  const handleSaveArticle = async (articleId: string, updates: Partial<Article>) => {
    setState(prev => ({ ...prev, isSaving: true }))
    try {
      const updatedArticle = await updateArticle(articleId, updates)
      setState(prev => ({
        ...prev,
        articles: prev.articles.map(a => a.id === articleId ? updatedArticle : a),
        editingArticleId: null,
        isSaving: false,
        unsavedChanges: false,
      }))
    } catch (err) {
      setState(prev => ({
        ...prev,
        error: '保存文章失敗',
        isSaving: false,
      }))
    }
  }

  // 處理文章刪除
  const handleDeleteArticle = async (articleId: string) => {
    if (!window.confirm('確認要刪除此文章嗎？')) {
      return
    }

    setState(prev => ({ ...prev, isSaving: true }))
    try {
      await deleteArticle(articleId)
      setState(prev => ({
        ...prev,
        articles: prev.articles.filter(a => a.id !== articleId),
        editingArticleId: null,
        isSaving: false,
        unsavedChanges: false,
      }))
    } catch (err) {
      setState(prev => ({
        ...prev,
        error: '刪除文章失敗',
        isSaving: false,
      }))
    }
  }

  // 處理文章重新排列
  const handleReorderArticles = async (reorderedArticles: Article[]) => {
    if (!weekNumber) return

    setState(prev => ({ ...prev, isSaving: true }))
    try {
      const articleIds = reorderedArticles.map(a => a.id)
      await reorderArticles(weekNumber, articleIds)

      // 更新 order 屬性
      const updatedArticles = reorderedArticles.map((article, index) => ({
        ...article,
        order: index + 1,
      }))

      setState(prev => ({
        ...prev,
        articles: updatedArticles,
        isSaving: false,
        unsavedChanges: false,
      }))
    } catch (err) {
      setState(prev => ({
        ...prev,
        error: '重新排列文章失敗',
        isSaving: false,
      }))
    }
  }

  // 處理添加新文章
  const handleAddArticle = async () => {
    if (!weekNumber) return

    const newArticle: Partial<Article> = {
      title: '新文章',
      content: '# 開始編輯...',
      author: '',
      summary: '',
      weekNumber,
      order: state.articles.length + 1,
      isPublished: false,
    }

    setState(prev => ({ ...prev, isSaving: true }))
    try {
      const createdArticle = await createArticle(newArticle as Article)
      setState(prev => ({
        ...prev,
        articles: [...prev.articles, createdArticle],
        editingArticleId: createdArticle.id,
        isSaving: false,
      }))
    } catch (err) {
      setState(prev => ({
        ...prev,
        error: '創建文章失敗',
        isSaving: false,
      }))
    }
  }

  // 返回讀者頁面
  const handleBackToReader = () => {
    if (state.unsavedChanges && !window.confirm('你有未保存的更改，確定要離開嗎？')) {
      return
    }
    navigate(`/newsletter/${weekNumber}`)
  }

  if (state.isLoading) {
    return <LoadingSpinner />
  }

  if (state.error && !state.articles.length) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">錯誤</h1>
          <p className="text-gray-600">{state.error}</p>
          <button
            onClick={() => navigate('/newsletter/2025-W43')}
            className="mt-6 px-4 py-2 bg-waldorf-brown text-white rounded-lg hover:bg-opacity-90"
          >
            返回首頁
          </button>
        </div>
      </div>
    )
  }

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-gray-50">
        {/* 標題欄 */}
        <div className="bg-white border-b border-gray-200 sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={handleBackToReader}
                className="text-gray-600 hover:text-gray-900 font-medium"
              >
                ← 返回讀者頁面
              </button>
              <h1 className="text-2xl font-bold text-gray-900">
                編輯週報 {weekNumber}
              </h1>
            </div>
            <div className="flex items-center gap-4">
              {state.error && (
                <div className="text-red-600 text-sm font-medium">
                  {state.error}
                </div>
              )}
              {state.unsavedChanges && (
                <div className="text-amber-600 text-sm font-medium">
                  有未保存的更改
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 主要內容區 */}
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* 左側：文章管理和排序 */}
            <div className="lg:col-span-1">
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-lg font-bold text-gray-900 mb-4">
                  文章清單 ({state.articles.length})
                </h2>

                {state.isSaving && (
                  <div className="mb-4">
                    <LoadingSpinner />
                  </div>
                )}

                {state.articles.length > 0 ? (
                  <ArticleOrderManager
                    articles={state.articles}
                    onReorder={handleReorderArticles}
                    onSelectArticle={(articleId) =>
                      setState(prev => ({ ...prev, editingArticleId: articleId }))
                    }
                    onDeleteArticle={handleDeleteArticle}
                    selectedArticleId={state.editingArticleId || ''}
                    disabled={state.isSaving}
                  />
                ) : (
                  <p className="text-gray-600 text-sm mb-4">
                    此週還沒有文章
                  </p>
                )}

                <button
                  onClick={handleAddArticle}
                  disabled={state.isSaving}
                  className={clsx(
                    'w-full mt-4 px-4 py-2 rounded-lg font-medium transition-colors',
                    state.isSaving
                      ? 'bg-gray-300 text-gray-600 cursor-not-allowed'
                      : 'bg-waldorf-brown text-white hover:bg-opacity-90'
                  )}
                >
                  + 新增文章
                </button>
              </div>
            </div>

            {/* 右側：文章編輯器 */}
            <div className="lg:col-span-2">
              {state.editingArticleId ? (
                <div className="bg-white rounded-lg shadow p-6">
                  {state.articles.find(a => a.id === state.editingArticleId) ? (
                    <ArticleEditor
                      article={state.articles.find(
                        a => a.id === state.editingArticleId
                      )!}
                      onSave={(updates) =>
                        handleSaveArticle(state.editingArticleId!, updates)
                      }
                      onCancel={() =>
                        setState(prev => ({ ...prev, editingArticleId: null }))
                      }
                      isSaving={state.isSaving}
                    />
                  ) : (
                    <p className="text-gray-600">文章不存在</p>
                  )}
                </div>
              ) : (
                <div className="bg-white rounded-lg shadow p-6 text-center">
                  <p className="text-gray-600">
                    {state.articles.length > 0
                      ? '選擇左側的文章開始編輯'
                      : '創建新文章開始編輯'}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </ErrorBoundary>
  )
}
