import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { adminService, AdminServiceError } from '@/services/adminService'
import type {
  AdminNewsletter,
  AdminArticle,
  NewsletterPublishAudienceSelection,
  NewsletterPublishReadiness,
  NewsletterDeliveryBatchSummary,
} from '@/types/admin'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { AdminLayout } from '@/components/admin/AdminLayout'
import { NewsletterForm } from '@/components/admin/NewsletterForm'
import { generateWeeklyUrl } from '@/utils/urlUtils'

export function AdminArticleListPage() {
  const { weekNumber, id } = useParams<{ weekNumber?: string; id?: string }>()
  const navigate = useNavigate()
  const location = useLocation()

  const [newsletter, setNewsletter] = useState<AdminNewsletter | null>(null)
  const [articles, setArticles] = useState<AdminArticle[]>([])
  const [availableArticles, setAvailableArticles] = useState<AdminArticle[]>([])
  const [availableClasses, setAvailableClasses] = useState<Array<{ id: string; name: string }>>([])
  const [selectedArticleId, setSelectedArticleId] = useState('')
  const [targetingDrafts, setTargetingDrafts] = useState<
    Record<string, { mode: 'shared' | 'targeted'; classIds: string[] }>
  >({})
  const [classSearchByArticleId, setClassSearchByArticleId] = useState<Record<string, string>>({})
  const [publishReadiness, setPublishReadiness] = useState<NewsletterPublishReadiness>({
    canPublish: false,
    issues: [],
  })
  const [publishAudience, setPublishAudience] = useState<NewsletterPublishAudienceSelection>({ mode: 'all' })
  const [availableFamilies, setAvailableFamilies] = useState<Array<{ id: string; name: string }>>([])
  const [deliveryBatches, setDeliveryBatches] = useState<NewsletterDeliveryBatchSummary[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isMutating, setIsMutating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  useEffect(() => {
    void loadData()
  }, [
    weekNumber,
    id,
    publishAudience.mode,
    (publishAudience.classIds ?? []).join(','),
    (publishAudience.familyIds ?? []).join(','),
    publishAudience.familyId ?? '',
  ])

  useEffect(() => {
    const state = location.state as { successMessage?: string } | null
    if (state?.successMessage) {
      setSuccessMessage(state.successMessage)
    }
  }, [location.state])

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

      const [articlesData, availableArticlesData, classes, families] = await Promise.all([
        adminService.fetchArticlesByNewsletterId(newsletterData.id),
        adminService.getAvailableArticlesByNewsletterId(newsletterData.id),
        adminService.fetchClasses(),
        adminService.fetchFamilies(),
      ])
      const [readiness, batches] = await Promise.all([
        adminService.getNewsletterPublishReadiness(newsletterData.id, publishAudience),
        adminService.fetchNewsletterDeliveryBatches(newsletterData.id),
      ])

      setNewsletter(newsletterData)
      setArticles(articlesData)
      setAvailableArticles(availableArticlesData)
      setPublishReadiness(readiness)
      setAvailableClasses(classes.map((classItem) => ({ id: classItem.id, name: classItem.name })))
      setAvailableFamilies(families.map((family) => ({ id: family.id, name: family.name })))
      setDeliveryBatches(batches)
      setTargetingDrafts(
        articlesData.reduce(
          (acc, article) => {
            acc[article.id] = {
              mode: article.newsletterTargetingMode ?? 'shared',
              classIds: article.newsletterTargetClassIds ?? [],
            }
            return acc
          },
          {} as Record<string, { mode: 'shared' | 'targeted'; classIds: string[] }>
        )
      )
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

    navigate(`${generateWeeklyUrl(articlePathTarget.weekNumber || articlePathTarget.id)}?admin=1`, {
      state: {
        focusArticleId: articleId,
        startInEditMode: true,
      },
    })
  }

  const handleBack = () => {
    if (newsletter?.isTemplate) {
      navigate('/admin/templates')
      return
    }
    navigate('/admin')
  }

  const handleMoveArticle = async (
    articleId: string,
    direction: -1 | 1,
    event?: React.MouseEvent<HTMLButtonElement>
  ) => {
    event?.preventDefault()
    if (!newsletter) return

    const currentIndex = articles.findIndex((article) => article.id === articleId)
    const nextIndex = currentIndex + direction
    if (currentIndex === -1 || nextIndex < 0 || nextIndex >= articles.length) return

    const previousArticles = [...articles]
    const reordered = [...articles]
    ;[reordered[currentIndex], reordered[nextIndex]] = [reordered[nextIndex], reordered[currentIndex]]
    const reorderedWithOrder = reordered.map((article, index) => ({ ...article, order: index + 1 }))

    try {
      setIsMutating(true)
      setError(null)
      setArticles(reorderedWithOrder)
      await adminService.reorderArticlesInNewsletterById(newsletter.id, reordered.map((article) => article.id))
      setSuccessMessage('文章順序已更新')
    } catch (err) {
      const message = err instanceof AdminServiceError ? err.message : '更新順序失敗'
      setError(message)
      setArticles(previousArticles)
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
    if (!window.confirm('確定要將這篇文章從本期電子報中移除嗎？（不會刪除文章本身）')) return

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
      navigate(`${generateWeeklyUrl(articlePathTarget.weekNumber || articlePathTarget.id)}?admin=1`, {
        state: {
          focusArticleId: article.id,
          startInEditMode: true,
        },
      })
    } catch (err) {
      const message = err instanceof AdminServiceError ? err.message : '建立文章失敗'
      setError(message)
    } finally {
      setIsMutating(false)
    }
  }

  const getDraftTargeting = (article: AdminArticle) => {
    return targetingDrafts[article.id] || {
      mode: article.newsletterTargetingMode ?? 'shared',
      classIds: article.newsletterTargetClassIds ?? [],
    }
  }

  const handleChangeTargetingMode = (articleId: string, mode: 'shared' | 'targeted') => {
    setTargetingDrafts((prev) => ({
      ...prev,
      [articleId]: {
        mode,
        classIds: mode === 'shared' ? [] : prev[articleId]?.classIds || [],
      },
    }))
  }

  const handleToggleTargetClass = (articleId: string, classId: string) => {
    setTargetingDrafts((prev) => {
      const current = prev[articleId] || { mode: 'shared' as const, classIds: [] }
      const hasClass = current.classIds.includes(classId)
      const nextClassIds = hasClass
        ? current.classIds.filter((id) => id !== classId)
        : [...current.classIds, classId]
      return {
        ...prev,
        [articleId]: {
          ...current,
          classIds: nextClassIds,
        },
      }
    })
  }

  const handleClassSearchChange = (articleId: string, query: string) => {
    setClassSearchByArticleId((prev) => ({
      ...prev,
      [articleId]: query,
    }))
  }

  const handleSaveTargeting = async (article: AdminArticle) => {
    if (!newsletter) return
    const draft = getDraftTargeting(article)

    if (draft.mode === 'targeted' && draft.classIds.length === 0) {
      setError('目標投遞模式至少需選擇一個班級，或改為共享文章。')
      return
    }

    try {
      setIsMutating(true)
      setError(null)
      await adminService.updateArticleTargetingInNewsletterById(
        newsletter.id,
        article.id,
        draft.mode,
        draft.classIds
      )
      setArticles((prev) =>
        prev.map((item) =>
          item.id === article.id
            ? {
                ...item,
                newsletterTargetingMode: draft.mode,
                newsletterTargetClassIds: draft.classIds,
              }
            : item
        )
      )
      setSuccessMessage('文章班級投遞設定已更新')
    } catch (err) {
      const message = err instanceof AdminServiceError ? err.message : '更新班級投遞失敗'
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
      const updated = await adminService.publishNewsletterWithDelivery(newsletter.id, publishAudience)
      setNewsletter(updated)
      setSuccessMessage('電子報已發布並啟動投遞批次')
      await loadData()
    } catch (err) {
      const message = err instanceof AdminServiceError ? err.message : '發布失敗'
      setError(message)
    } finally {
      setIsMutating(false)
    }
  }

  const handleResendBatch = async (batchId: string) => {
    if (!newsletter) return

    try {
      setIsMutating(true)
      setError(null)
      await adminService.createNewsletterResendBatch(batchId, publishAudience)
      setSuccessMessage('已建立補發批次')
      await loadData()
    } catch (err) {
      const message = err instanceof AdminServiceError ? err.message : '建立補發批次失敗'
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
        activeTab={newsletter.isTemplate ? 'templates' : 'newsletters'}
        headerAction={
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleCreateDraftArticle}
              className="rounded-lg bg-waldorf-sage-500 px-4 py-2 text-white transition-colors hover:bg-waldorf-sage-600 disabled:opacity-50"
              disabled={isMutating}
            >
              + 建立草稿文章
            </button>
            <button
              type="button"
              onClick={() =>
                navigate(
                  newsletter.isTemplate
                    ? `/admin/newsletter/create?template=${newsletter.id}`
                    : `/admin/newsletter/create?sourceNewsletter=${newsletter.id}`
                )
              }
              className="rounded-lg border border-waldorf-peach-300 bg-white px-4 py-2 text-waldorf-peach-700 transition-colors hover:bg-waldorf-peach-50"
            >
              {newsletter.isTemplate ? '由模板建立電子報' : '由此期建立模板'}
            </button>
          </div>
        }
      >
        <div className="space-y-6">
          <div className="rounded-xl border border-waldorf-cream-200 bg-white p-6 shadow-sm">
            <button
              type="button"
              onClick={handleBack}
              className="mb-4 flex items-center text-sm font-medium text-waldorf-peach-600 hover:text-waldorf-peach-700"
            >
              <svg className="mr-1 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              {newsletter.isTemplate ? '返回模板列表' : '返回電子報列表'}
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
                  {!newsletter.isTemplate && (
                    <a
                      href={generateWeeklyUrl(newsletter.weekNumber || newsletter.id)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-waldorf-peach-600 hover:text-waldorf-peach-700"
                    >
                      查看公開頁面
                    </a>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-3">
                {newsletter.status === 'draft' && !newsletter.isTemplate && (
                  <button
                    type="button"
                    onClick={handlePublish}
                    disabled={isMutating || !publishReadiness.canPublish}
                    className="rounded-lg bg-waldorf-sage-500 px-4 py-2 text-white transition-colors hover:bg-waldorf-sage-600 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    發布電子報
                  </button>
                )}
                {newsletter.status === 'published' && !newsletter.isTemplate && (
                  <button
                    type="button"
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
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <label className="text-sm text-waldorf-clay-700">
                <span className="mb-1 block font-semibold">投遞對象</span>
                <select
                  value={publishAudience.mode}
                  onChange={(event) =>
                    setPublishAudience({
                      mode: event.target.value as NewsletterPublishAudienceSelection['mode'],
                      classIds: [],
                      familyIds: [],
                      familyId: undefined,
                    })
                  }
                  className="w-full rounded-lg border border-waldorf-cream-300 bg-white px-3 py-2"
                >
                  <option value="all">全部符合資格家庭</option>
                  <option value="classes">指定班級</option>
                  <option value="families">指定家庭</option>
                  <option value="family">單一家庭</option>
                </select>
              </label>
              {publishReadiness.audienceSummary && (
                <div className="rounded-lg border border-waldorf-cream-200 bg-waldorf-cream-50 p-3 text-sm text-waldorf-clay-700">
                  <p>候選：{publishReadiness.audienceSummary.totalCandidates}</p>
                  <p>可投遞：{publishReadiness.audienceSummary.eligibleCount}</p>
                  <p>排除：{publishReadiness.audienceSummary.ineligibleCount}</p>
                </div>
              )}
            </div>
            {publishAudience.mode === 'classes' && (
              <div className="mt-3 flex max-h-36 flex-wrap gap-2 overflow-y-auto rounded border border-waldorf-cream-200 p-2">
                {availableClasses.map((classItem) => {
                  const selected = (publishAudience.classIds ?? []).includes(classItem.id)
                  return (
                    <button
                      key={classItem.id}
                      type="button"
                      onClick={() =>
                        setPublishAudience((prev) => {
                          const current = prev.classIds ?? []
                          const next = selected
                            ? current.filter((id) => id !== classItem.id)
                            : [...current, classItem.id]
                          return { ...prev, classIds: next }
                        })
                      }
                      className={`rounded-full border px-3 py-1 text-xs ${
                        selected
                          ? 'border-waldorf-sage-300 bg-waldorf-sage-100 text-waldorf-sage-700'
                          : 'border-waldorf-cream-300 bg-white text-waldorf-clay-600'
                      }`}
                    >
                      {classItem.name}
                    </button>
                  )
                })}
              </div>
            )}
            {publishAudience.mode === 'families' && (
              <div className="mt-3 flex max-h-36 flex-wrap gap-2 overflow-y-auto rounded border border-waldorf-cream-200 p-2">
                {availableFamilies.map((family) => {
                  const selected = (publishAudience.familyIds ?? []).includes(family.id)
                  return (
                    <button
                      key={family.id}
                      type="button"
                      onClick={() =>
                        setPublishAudience((prev) => {
                          const current = prev.familyIds ?? []
                          const next = selected
                            ? current.filter((id) => id !== family.id)
                            : [...current, family.id]
                          return { ...prev, familyIds: next }
                        })
                      }
                      className={`rounded-full border px-3 py-1 text-xs ${
                        selected
                          ? 'border-waldorf-sage-300 bg-waldorf-sage-100 text-waldorf-sage-700'
                          : 'border-waldorf-cream-300 bg-white text-waldorf-clay-600'
                      }`}
                    >
                      {family.name}
                    </button>
                  )
                })}
              </div>
            )}
            {publishAudience.mode === 'family' && (
              <div className="mt-3">
                <select
                  value={publishAudience.familyId ?? ''}
                  onChange={(event) =>
                    setPublishAudience((prev) => ({
                      ...prev,
                      familyId: event.target.value || undefined,
                    }))
                  }
                  className="w-full rounded-lg border border-waldorf-cream-300 bg-white px-3 py-2"
                >
                  <option value="">選擇家庭</option>
                  {availableFamilies.map((family) => (
                    <option key={family.id} value={family.id}>
                      {family.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div className="rounded-xl border border-waldorf-cream-200 bg-white p-6 shadow-sm">
            <h2 className="font-display text-2xl font-semibold text-waldorf-clay-800">投遞批次紀錄</h2>
            {deliveryBatches.length === 0 ? (
              <p className="mt-3 text-sm text-waldorf-clay-500">尚無投遞批次。</p>
            ) : (
              <div className="mt-4 space-y-3">
                {deliveryBatches.map((batch) => (
                  <div key={batch.id} className="rounded-lg border border-waldorf-cream-200 p-3 text-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-medium text-waldorf-clay-700">
                        {batch.trigger === 'publish' ? '發布批次' : '補發批次'} · {new Date(batch.createdAt).toLocaleString('zh-TW')}
                      </p>
                      <p className="text-waldorf-clay-500">{batch.state}</p>
                    </div>
                    <p className="mt-1 text-waldorf-clay-600">
                      送達 {batch.sentRecipients} / 可投遞 {batch.eligibleRecipients}，失敗 {batch.failedRecipients}，排除 {batch.invalidRecipients}
                    </p>
                    <button
                      type="button"
                      onClick={() => handleResendBatch(batch.id)}
                      disabled={isMutating}
                      className="mt-2 rounded border border-waldorf-peach-300 px-3 py-1 text-xs text-waldorf-peach-700 hover:bg-waldorf-peach-50 disabled:opacity-50"
                    >
                      補發此批次（同一份電子報）
                    </button>
                  </div>
                ))}
              </div>
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
                type="button"
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
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-waldorf-clay-500">班級投遞</th>
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
                              type="button"
                              onClick={(event) => handleMoveArticle(article.id, -1, event)}
                              disabled={index === 0 || isMutating}
                              className="text-xs text-waldorf-peach-600 disabled:opacity-30"
                            >
                              ↑
                            </button>
                            <button
                              type="button"
                              onClick={(event) => handleMoveArticle(article.id, 1, event)}
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
                      <td className="px-6 py-4 text-sm text-waldorf-clay-600">
                        {(() => {
                          const draft = getDraftTargeting(article)
                          return (
                            <div className="space-y-2">
                              <div className="flex items-center gap-3">
                                <label className="flex items-center gap-1 text-xs">
                                  <input
                                    type="radio"
                                    name={`targeting-${article.id}`}
                                    checked={draft.mode === 'shared'}
                                    onChange={() => handleChangeTargetingMode(article.id, 'shared')}
                                  />
                                  共享
                                </label>
                                <label className="flex items-center gap-1 text-xs">
                                  <input
                                    type="radio"
                                    name={`targeting-${article.id}`}
                                    checked={draft.mode === 'targeted'}
                                    onChange={() => handleChangeTargetingMode(article.id, 'targeted')}
                                  />
                                  目標班級
                                </label>
                              </div>
                              {draft.mode === 'targeted' && (
                                <div className="space-y-2 rounded border border-waldorf-cream-200 p-2">
                                  <input
                                    type="text"
                                    value={classSearchByArticleId[article.id] || ''}
                                    onChange={(event) => handleClassSearchChange(article.id, event.target.value)}
                                    placeholder="搜尋班級"
                                    className="w-full rounded border border-waldorf-cream-300 px-2 py-1 text-xs text-waldorf-clay-700"
                                  />
                                  <div className="max-h-28 space-y-1 overflow-y-auto">
                                    {availableClasses
                                      .filter((classItem) =>
                                        classItem.name
                                          .toLowerCase()
                                          .includes((classSearchByArticleId[article.id] || '').trim().toLowerCase())
                                      )
                                      .map((classItem) => (
                                        <label key={classItem.id} className="flex items-center gap-1 text-xs">
                                          <input
                                            type="checkbox"
                                            checked={draft.classIds.includes(classItem.id)}
                                            onChange={() => handleToggleTargetClass(article.id, classItem.id)}
                                            disabled={isMutating}
                                          />
                                          {classItem.name}
                                        </label>
                                      ))}
                                  </div>
                                </div>
                              )}
                              <button
                                type="button"
                                onClick={() => handleSaveTargeting(article)}
                                disabled={isMutating}
                                className="rounded border border-waldorf-cream-300 px-2 py-1 text-xs text-waldorf-clay-700 hover:bg-waldorf-cream-50 disabled:opacity-50"
                              >
                                儲存班級設定
                              </button>
                            </div>
                          )
                        })()}
                      </td>
                      <td className="px-6 py-4 text-sm text-waldorf-clay-500">
                        {article.editedAt ? new Date(article.editedAt).toLocaleString('zh-TW') : '-'}
                      </td>
                      <td className="px-6 py-4 text-right text-sm">
                        <div className="flex justify-end gap-3">
                          <button
                            type="button"
                            onClick={() => handleEditArticle(article.id)}
                            className="text-waldorf-peach-600 hover:text-waldorf-peach-700"
                          >
                            編輯
                          </button>
                          <button
                            type="button"
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
