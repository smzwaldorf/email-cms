import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { adminService, AdminServiceError } from '@/services/adminService'
import type { AdminNewsletter, AdminArticle, NewsletterPublishReadiness } from '@/types/admin'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { AdminLayout } from '@/components/admin/AdminLayout'
import { NewsletterForm } from '@/components/admin/NewsletterForm'
import { getAdminArticleEditorPath } from '@/utils/adminNewsletterRoutes'
import { generateWeeklyUrl } from '@/utils/urlUtils'

export function AdminArticleListPage() {
  const { weekNumber, id } = useParams<{ weekNumber?: string; id?: string }>()
  const navigate = useNavigate()

  const [newsletter, setNewsletter] = useState<AdminNewsletter | null>(null)
  const [articles, setArticles] = useState<AdminArticle[]>([])
  const [availableArticles, setAvailableArticles] = useState<AdminArticle[]>([])
  const [selectedArticleId, setSelectedArticleId] = useState('')
  const [publishReadiness, setPublishReadiness] = useState<NewsletterPublishReadiness>({
    canPublish: false,
    issues: [],
  })
  const [isLoading, setIsLoading] = useState(true)
  const [isMutating, setIsMutating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  useEffect(() => {
    void loadData()
  }, [weekNumber, id])

  const loadData = async () => {
    try {
      setIsLoading(true)
      setError(null)

      let newsletterData: AdminNewsletter
      if (weekNumber) {
        newsletterData = await adminService.fetchNewsletterByWeek(weekNumber)
      } else if (id) {
        newsletterData = await adminService.fetchNewsletter(id)
      } else {
        throw new Error('缺少電子報參數')
      }

      const [articlesData, availableArticlesData, readiness] = await Promise.all([
        adminService.fetchArticlesByNewsletterId(newsletterData.id),
        adminService.getAvailableArticlesByNewsletterId(newsletterData.id),
        adminService.getNewsletterPublishReadiness(newsletterData.id),
      ])

      setNewsletter(newsletterData)
      setArticles(articlesData)
      setAvailableArticles(availableArticlesData)
      setPublishReadiness(readiness)
    } catch (err) {
      const message = err instanceof AdminServiceError ? err.message : err instanceof Error ? err.message : 'Failed to load data'
      setError(message)
      console.error('Error loading newsletter data:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const articlePathTarget = useMemo(() => {
    if (!newsletter) return null

    return {
      id: newsletter.id,
      weekNumber: newsletter.weekNumber,
    }
  }, [newsletter])

  const handleEditArticle = (articleId: string) => {
    if (!articlePathTarget) return

    navigate(getAdminArticleEditorPath({
      ...articlePathTarget,
      articleId,
    }), {
      state: { newsletterId: articlePathTarget.id },
    })
  }

  const handleBack = () => {
    navigate('/admin')
  }

  const handleMoveArticle = async (articleId: string, direction: -1 | 1) => {
    if (!newsletter) return

    const currentIndex = articles.findIndex((article) => article.id === articleId)
    const nextIndex = currentIndex + direction
    if (currentIndex === -1 || nextIndex < 0 || nextIndex >= articles.length) return

    const reordered = [...articles]
    ;[reordered[currentIndex], reordered[nextIndex]] = [reordered[nextIndex], reordered[currentIndex]]

    try {
      setIsMutating(true)
      setArticles(reordered.map((article, index) => ({ ...article, order: index + 1 })))
      await adminService.reorderArticlesInNewsletterById(newsletter.id, reordered.map((article) => article.id))
      setSuccessMessage('文章順序已更新')
      await loadData()
    } catch (err) {
      const message = err instanceof AdminServiceError ? err.message : '更新順序失敗'
      setError(message)
      await loadData()
    } finally {
      setIsMutating(false)
    }
  }

  const handleAddExistingArticle = async () => {
    if (!newsletter || !selectedArticleId) return

    try {
      setIsMutating(true)
      setError(null)
      await adminService.addArticleToNewsletterById(selectedArticleId, newsletter.id)
      setSelectedArticleId('')
      setSuccessMessage('文章已加入電子報')
      await loadData()
    } catch (err) {
      const message = err instanceof AdminServiceError ? err.message : '加入文章失敗'
      setError(message)
    } finally {
      setIsMutating(false)
    }
  }

  const handleRemoveArticle = async (articleId: string) => {
    if (!newsletter) return
    if (!window.confirm('確定要將這篇文章從電子報中移除嗎？')) return

    try {
      setIsMutating(true)
      setError(null)
      await adminService.removeArticleFromNewsletterById(articleId, newsletter.id)
      setSuccessMessage('文章已從電子報移除')
      await loadData()
    } catch (err) {
      const message = err instanceof AdminServiceError ? err.message : '移除文章失敗'
      setError(message)
    } finally {
      setIsMutating(false)
    }
  }

  const handleCreateDraftArticle = async () => {
    if (!newsletter || !articlePathTarget) return

    try {
      setIsMutating(true)
      const article = await adminService.createArticleForNewsletter(newsletter.id)
      navigate(getAdminArticleEditorPath({
        ...articlePathTarget,
        articleId: article.id,
      }), {
        state: { newsletterId: newsletter.id },
      })
    } catch (err) {
      const message = err instanceof AdminServiceError ? err.message : '建立文章失敗'
      setError(message)
    } finally {
      setIsMutating(false)
    }
  }

  const handlePublish = async () => {
    if (!newsletter) return

    try {
      setIsMutating(true)
      setError(null)
      const updated = await adminService.publishNewsletter(newsletter.id)
      setNewsletter(updated)
      setSuccessMessage('電子報已發布')
      await loadData()
    } catch (err) {
      const message = err instanceof AdminServiceError ? err.message : '發布失敗'
      setError(message)
    } finally {
      setIsMutating(false)
    }
  }

  const handleArchive = async () => {
    if (!newsletter) return

    try {
      setIsMutating(true)
      setError(null)
      const updated = await adminService.archiveNewsletter(newsletter.id)
      setNewsletter(updated)
      setSuccessMessage('電子報已封存')
      await loadData()
    } catch (err) {
      const message = err instanceof AdminServiceError ? err.message : '封存失敗'
      setError(message)
    } finally {
      setIsMutating(false)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'published':
        return 'bg-waldorf-sage-100 text-waldorf-sage-800'
      case 'draft':
        return 'bg-waldorf-peach-100 text-waldorf-peach-800'
      case 'archived':
        return 'bg-waldorf-cream-200 text-waldorf-clay-700'
      default:
        return 'bg-waldorf-cream-100 text-waldorf-clay-700'
    }
  }

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'published':
        return '已發布'
      case 'draft':
        return '草稿'
      case 'archived':
        return '已封存'
      default:
        return status
    }
  }

  if (isLoading) {
    return (
      <AdminLayout activeTab="newsletters">
        <LoadingSpinner />
      </AdminLayout>
    )
  }

  if (!newsletter) {
    return (
      <AdminLayout activeTab="newsletters">
        <div className="rounded-xl border border-waldorf-rose-200 bg-waldorf-rose-50 p-6 text-waldorf-rose-700">
          {error || '找不到電子報'}
        </div>
      </AdminLayout>
    )
  }

  return (
    <ErrorBoundary>
      <AdminLayout
        activeTab="newsletters"
        headerAction={
          <div className="flex items-center gap-3">
            <button
              onClick={handleCreateDraftArticle}
              className="rounded-lg bg-waldorf-sage-500 px-4 py-2 text-white transition-colors hover:bg-waldorf-sage-600 disabled:opacity-50"
              disabled={isMutating}
            >
              + 建立草稿文章
            </button>
            <button
              onClick={() => navigate(`/admin/newsletter/create?template=${newsletter.id}`)}
              className="rounded-lg border border-waldorf-peach-300 bg-white px-4 py-2 text-waldorf-peach-700 transition-colors hover:bg-waldorf-peach-50"
            >
              用此期作為模板
            </button>
          </div>
        }
      >
        <div className="space-y-6">
          <div className="rounded-xl border border-waldorf-cream-200 bg-white p-6 shadow-sm">
            <button
              onClick={handleBack}
              className="mb-4 flex items-center text-sm font-medium text-waldorf-peach-600 hover:text-waldorf-peach-700"
            >
              <svg className="mr-1 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              返回電子報列表
            </button>

            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h1 className="font-display text-3xl font-bold text-waldorf-clay-800">
                  {newsletter.weekNumber || newsletter.title || '特刊電子報'}
                </h1>
                <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-waldorf-clay-600">
                  <span>發布日期: {new Date(newsletter.releaseDate).toLocaleDateString('zh-TW')}</span>
                  <span className={`rounded-full px-3 py-1 font-medium ${getStatusColor(newsletter.status)}`}>
                    {getStatusLabel(newsletter.status)}
                  </span>
                  <a
                    href={generateWeeklyUrl(newsletter.weekNumber || newsletter.id)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-waldorf-peach-600 hover:text-waldorf-peach-700"
                  >
                    查看公開頁面
                  </a>
                </div>
              </div>

              <div className="flex items-center gap-3">
                {newsletter.status === 'draft' && (
                  <button
                    onClick={handlePublish}
                    disabled={isMutating || !publishReadiness.canPublish}
                    className="rounded-lg bg-waldorf-sage-500 px-4 py-2 text-white transition-colors hover:bg-waldorf-sage-600 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    發布電子報
                  </button>
                )}
                {newsletter.status === 'published' && (
                  <button
                    onClick={handleArchive}
                    disabled={isMutating}
                    className="rounded-lg bg-waldorf-cream-200 px-4 py-2 text-waldorf-clay-700 transition-colors hover:bg-waldorf-cream-300 disabled:opacity-50"
                  >
                    封存電子報
                  </button>
                )}
              </div>
            </div>
          </div>

          {successMessage && (
            <div className="rounded-xl border border-waldorf-sage-200 bg-waldorf-sage-50 p-4 text-sm font-medium text-waldorf-sage-700">
              {successMessage}
            </div>
          )}

          {error && (
            <div className="rounded-xl border border-waldorf-rose-200 bg-waldorf-rose-50 p-4 text-sm font-medium text-waldorf-rose-700">
              {error}
            </div>
          )}

          <NewsletterForm
            mode="edit"
            newsletter={newsletter}
            onCancel={handleBack}
            onSuccess={(updatedNewsletter) => {
              setNewsletter(updatedNewsletter)
              setSuccessMessage('電子報資訊已更新')
              void loadData()
            }}
          />

          <div className="rounded-xl border border-waldorf-cream-200 bg-white p-6 shadow-sm">
            <h2 className="font-display text-2xl font-semibold text-waldorf-clay-800">發布檢查</h2>
            {publishReadiness.canPublish ? (
              <p className="mt-3 text-sm text-waldorf-sage-700">這份電子報已符合發布條件。</p>
            ) : (
              <ul className="mt-3 list-disc pl-6 text-sm text-waldorf-rose-700">
                {publishReadiness.issues.map((issue) => (
                  <li key={issue}>{issue}</li>
                ))}
              </ul>
            )}
          </div>

          <div className="rounded-xl border border-waldorf-cream-200 bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-end gap-3">
              <div className="min-w-[260px] flex-1">
                <label htmlFor="available-article" className="mb-2 block text-sm font-semibold text-waldorf-clay-700">
                  加入既有文章
                </label>
                <select
                  id="available-article"
                  value={selectedArticleId}
                  onChange={(event) => setSelectedArticleId(event.target.value)}
                  className="w-full rounded-lg border border-waldorf-cream-300 bg-white px-4 py-2.5 text-waldorf-clay-700"
                >
                  <option value="">選擇文章</option>
                  {availableArticles.map((article) => (
                    <option key={article.id} value={article.id}>
                      {article.title}
                    </option>
                  ))}
                </select>
              </div>
              <button
                onClick={handleAddExistingArticle}
                disabled={!selectedArticleId || isMutating}
                className="rounded-lg border border-waldorf-clay-300 bg-white px-4 py-2.5 text-waldorf-clay-700 transition-colors hover:bg-waldorf-cream-50 disabled:opacity-50"
              >
                加入文章
              </button>
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-waldorf-cream-200 bg-white shadow-sm">
            <div className="border-b border-waldorf-cream-200 px-6 py-4">
              <h2 className="font-display text-2xl font-semibold text-waldorf-clay-800">文章編排</h2>
              <p className="mt-1 text-sm text-waldorf-clay-500">拖動前先用上下按鈕調整排序，並在需要時編輯或移除文章。</p>
            </div>

            {articles.length === 0 ? (
              <div className="p-8 text-center text-waldorf-clay-500">這份電子報目前尚未加入任何文章。</div>
            ) : (
              <table className="min-w-full divide-y divide-waldorf-cream-200">
                <thead className="bg-waldorf-cream-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-waldorf-clay-500">順序</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-waldorf-clay-500">標題</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-waldorf-clay-500">狀態</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-waldorf-clay-500">最後更新</th>
                    <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-waldorf-clay-500">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-waldorf-cream-100 bg-white">
                  {articles.map((article, index) => (
                    <tr key={article.id}>
                      <td className="px-6 py-4 text-sm text-waldorf-clay-600">
                        <div className="flex items-center gap-2">
                          <span>{index + 1}</span>
                          <div className="flex flex-col">
                            <button
                              onClick={() => handleMoveArticle(article.id, -1)}
                              disabled={index === 0 || isMutating}
                              className="text-xs text-waldorf-peach-600 disabled:opacity-30"
                            >
                              ↑
                            </button>
                            <button
                              onClick={() => handleMoveArticle(article.id, 1)}
                              disabled={index === articles.length - 1 || isMutating}
                              className="text-xs text-waldorf-peach-600 disabled:opacity-30"
                            >
                              ↓
                            </button>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm font-medium text-waldorf-clay-800">{article.title}</td>
                      <td className="px-6 py-4 text-sm text-waldorf-clay-600">{article.status}</td>
                      <td className="px-6 py-4 text-sm text-waldorf-clay-500">
                        {article.editedAt ? new Date(article.editedAt).toLocaleString('zh-TW') : '-'}
                      </td>
                      <td className="px-6 py-4 text-right text-sm">
                        <div className="flex justify-end gap-3">
                          <button
                            onClick={() => handleEditArticle(article.id)}
                            className="text-waldorf-peach-600 hover:text-waldorf-peach-700"
                          >
                            編輯
                          </button>
                          <button
                            onClick={() => handleRemoveArticle(article.id)}
                            className="text-waldorf-rose-600 hover:text-waldorf-rose-700"
                          >
                            移除
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </AdminLayout>
    </ErrorBoundary>
  )
}

export default AdminArticleListPage
