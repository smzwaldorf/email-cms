/**
 * Article Editor Page
 * Admin page for editing articles with Last-Write-Wins conflict resolution
 *
 * Features:
 * - Load article and related data (classes, families)
 * - Edit article using ArticleForm component
 * - Handle save with LWW conflict detection
 * - Navigate back to newsletter view after save
 * - Error handling and loading states
 */

import { useState, useEffect } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import type { AdminArticle } from '@/types/admin'
import { adminService } from '@/services/adminService'
import { useAuth } from '@/context/AuthContext'
import ArticleForm from '@/components/admin/ArticleForm'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { LoadingSpinner } from '@/components/LoadingSpinner'

interface LocationState {
  newsletterId?: string
}

/**
 * Article Editor Page Component
 */
export function ArticleEditorPage() {
  const { weekNumber, articleId } = useParams<{ weekNumber: string; articleId: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const state = location.state as LocationState | null

  const { user } = useAuth()
  const [article, setArticle] = useState<AdminArticle | null>(null)
  const [availableClasses, setAvailableClasses] = useState<Array<{ id: string; name: string }>>([])
  const [availableFamilies, setAvailableFamilies] = useState<Array<{ id: string; name: string }>>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  /**
   * Load article and related data
   */
  useEffect(() => {
    loadArticleData()
  }, [weekNumber, articleId])

  const loadArticleData = async () => {
    if (!weekNumber || !articleId) {
      setError('缺少必要的參數：weekNumber 或 articleId')
      setIsLoading(false)
      return
    }

    try {
      setIsLoading(true)
      setError(null)

      // Load articles for the week and find the one we need
      const articles = await adminService.fetchArticlesByNewsletter(weekNumber)
      const fetchedArticle = articles.find((a) => a.id === articleId)

      if (!fetchedArticle) {
        throw new Error('文章未找到')
      }

      setArticle(fetchedArticle)

      // Load available classes and families
      const [classes, families] = await Promise.all([
        adminService.fetchClasses(),
        adminService.fetchFamilies(),
      ])

      setAvailableClasses(classes.map((c) => ({ id: c.id, name: c.name })))
      setAvailableFamilies(families.map((f) => ({ id: f.id, name: f.name })))
    } catch (err: any) {
      const message = err.message || '無法載入文章'
      setError(message)
      console.error('Failed to load article data:', err)
    } finally {
      setIsLoading(false)
    }
  }

  /**
   * Handle article save
   */
  const handleSave = async (updatedArticle: AdminArticle) => {
    if (!articleId || !article || !user?.id) {
      setError('缺少必要資訊')
      return
    }

    try {
      setError(null)

      // Update article via admin service with LWW conflict resolution
      await adminService.updateArticle(
        articleId,
        updatedArticle,
        article.editedAt || article.updatedAt || new Date().toISOString(),
        user.id
      )

      // Navigate back to newsletter view
      navigate(`/admin`, {
        state: { successMessage: '文章已保存' },
      })
    } catch (err: any) {
      const message = err.message || '保存失敗'
      setError(message)
      console.error('Failed to save article:', err)
    }
  }

  /**
   * Handle cancel
   */
  const handleCancel = () => {
    // Navigate back to newsletter view
    navigate(`/admin`, {
      state: { newsletterId: state?.newsletterId },
    })
  }

  /**
   * Handle error
   */
  const handleError = (error: Error) => {
    setError(error.message)
    console.error('Article form error:', error)
  }

  if (isLoading) {
    return <LoadingSpinner />
  }

  if (!article) {
    return (
      <ErrorBoundary>
        <div className="min-h-screen bg-gray-100 py-8 px-4">
          <div className="max-w-4xl mx-auto">
            <div className="bg-red-50 border border-red-200 rounded-lg p-6">
              <h2 className="text-lg font-semibold text-red-900 mb-2">文章未找到</h2>
              <p className="text-red-700 mb-4">{error || '無法載入文章'}</p>
              <button
                onClick={handleCancel}
                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
              >
                返回
              </button>
            </div>
          </div>
        </div>
      </ErrorBoundary>
    )
  }

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-gray-100 py-8 px-4">
        <div className="max-w-4xl mx-auto">
          {/* Page Header */}
          <div className="mb-8">
            <button
              onClick={handleCancel}
              className="text-blue-500 hover:text-blue-600 text-sm font-medium mb-4"
            >
              ← 返回
            </button>
            <h1 className="text-3xl font-bold text-gray-900">編輯文章</h1>
            <p className="mt-1 text-gray-600">
              週次: {weekNumber} | 文章 ID: {articleId}
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-800 font-medium">錯誤</p>
              <p className="text-red-600 text-sm">{error}</p>
            </div>
          )}

          {/* Article Form */}
          <ArticleForm
            article={article}
            onSave={handleSave}
            onCancel={handleCancel}
            onError={handleError}
            availableClasses={availableClasses}
            availableFamilies={availableFamilies}
          />
        </div>
      </div>
    </ErrorBoundary>
  )
}

export default ArticleEditorPage
