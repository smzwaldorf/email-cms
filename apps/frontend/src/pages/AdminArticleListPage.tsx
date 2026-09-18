import { canonicalClassReferences } from '@/utils/classReferences'
import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { adminService, AdminServiceError } from '@/services/adminService'
import type {
  AdminNewsletter,
  AdminArticle,
  NewsletterPublishAudienceSelection,
  NewsletterPublishReadiness,
  NewsletterDeliveryBatchSummary,
  NewsletterDeliveryRecipientSummary,
} from '@/types/admin'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { AdminLayout } from '@/components/admin/AdminLayout'
import { NewsletterForm } from '@/components/admin/NewsletterForm'
import { NewsletterWorkflowSteps, getNewsletterPreviewPath } from '@/components/admin/NewsletterWorkflowSteps'
import { generateWeeklyUrl } from '@/utils/urlUtils'

const EXCLUSION_REASON_LABELS: Record<string, string> = {
  family_inactive: '家庭已停用',
  no_active_enrollment: '沒有在學班級',
  not_subscribed: '未訂閱電子報',
  missing_parent_guardian_email: '缺少家長電子郵件',
}

export function AdminArticleListPage() {
  const { weekNumber, id } = useParams<{ weekNumber?: string; id?: string }>()
  const navigate = useNavigate()
  const location = useLocation()

  const [newsletter, setNewsletter] = useState<AdminNewsletter | null>(null)
  const [articles, setArticles] = useState<AdminArticle[]>([])
  const [availableArticles, setAvailableArticles] = useState<AdminArticle[]>([])
  const [availableClasses, setAvailableClasses] = useState<Array<{ id: string; name: string; legacyIds?: string[] }>>([])
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
  const [expandedBatchId, setExpandedBatchId] = useState<string | null>(null)
  const [loadingRecipientsBatchId, setLoadingRecipientsBatchId] = useState<string | null>(null)
  const [batchRecipientsByBatchId, setBatchRecipientsByBatchId] = useState<Record<string, NewsletterDeliveryRecipientSummary[]>>({})
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
      setAvailableClasses(classes.map((classItem) => ({ id: classItem.id, name: classItem.name, legacyIds: classItem.legacyIds })))
      setAvailableFamilies(families.map((family) => ({ id: family.id, name: family.name })))
      setDeliveryBatches(batches)
      const validBatchIds = new Set(batches.map((batch) => batch.id))
      setBatchRecipientsByBatchId((prev) => Object.fromEntries(
        Object.entries(prev).filter(([batchId]) => validBatchIds.has(batchId)),
      ))
      if (expandedBatchId && !validBatchIds.has(expandedBatchId)) {
        setExpandedBatchId(null)
      }
      setTargetingDrafts(
        articlesData.reduce(
          (acc, article) => {
            acc[article.id] = {
              mode: article.newsletterTargetingMode ?? 'shared',
              classIds: canonicalClassReferences(article.newsletterTargetClassIds, classes),
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

  const formatAudienceModeLabel = (mode: NewsletterPublishAudienceSelection['mode']): string => {
    switch (mode) {
      case 'classes':
        return '指定班級'
      case 'families':
        return '指定家庭'
      case 'family':
        return '單一家庭'
      default:
        return '全部符合資格家庭'
    }
  }

  const handleToggleBatchRecipients = async (batchId: string) => {
    if (expandedBatchId === batchId) {
      setExpandedBatchId(null)
      return
    }

    const cached = batchRecipientsByBatchId[batchId]
    if (cached) {
      setExpandedBatchId(batchId)
      return
    }

    try {
      setLoadingRecipientsBatchId(batchId)
      const recipients = await adminService.fetchNewsletterDeliveryRecipients(batchId)
      setBatchRecipientsByBatchId((prev) => ({ ...prev, [batchId]: recipients }))
      setExpandedBatchId(batchId)
    } catch (err) {
      const message = err instanceof AdminServiceError ? err.message : '載入批次收件者結果失敗'
      setError(message)
    } finally {
      setLoadingRecipientsBatchId(null)
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
      classIds: canonicalClassReferences(article.newsletterTargetClassIds, availableClasses),
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
    const audienceSummary = publishReadiness.audienceSummary
    const confirmationMessage = [
      '確認要發布並啟動投遞嗎？',
      `投遞模式：${formatAudienceModeLabel(publishAudience.mode)}`,
      audienceSummary ? `候選家庭：${audienceSummary.totalCandidates}` : null,
      audienceSummary ? `可投遞家庭：${audienceSummary.eligibleCount}` : null,
      audienceSummary ? `排除家庭：${audienceSummary.ineligibleCount}` : null,
      audienceSummary ? `可寄送家長電子郵件：${audienceSummary.eligibleRecipientCount ?? audienceSummary.eligibleCount}` : null,
      '',
      '前三項以家庭計算；最後一項以 SMZ Auth 授權的家長電子郵件計算。',
      '此操作會同時發布電子報並建立投遞批次。',
    ].filter(Boolean).join('\n')
    if (!window.confirm(confirmationMessage)) return

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
      const resendBatch = await adminService.createNewsletterResendBatch(batchId, publishAudience)
      if (resendBatch.sentRecipients > 0) {
        setSuccessMessage(`已建立補發批次，成功送達 ${resendBatch.sentRecipients} 筆`)
      } else {
        setError(
          `補發批次已建立，但無可送達收件者（失敗 ${resendBatch.failedRecipients} 筆）。請查看收件者結果中的失敗原因。`,
        )
      }
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

  const getArticleStatusLabel = (status: string) => {
    switch (status) {
      case 'published':
        return '已發布'
      case 'draft':
        return '草稿'
      default:
        return status
    }
  }

  const getBatchStateStyle = (state: string) => {
    switch (state) {
      case 'completed':
        return 'bg-waldorf-sage-100 text-waldorf-sage-700'
      case 'failed':
        return 'bg-waldorf-rose-100 text-waldorf-rose-700'
      case 'queued':
      case 'processing':
        return 'bg-waldorf-peach-100 text-waldorf-peach-700'
      default:
        return 'bg-waldorf-cream-200 text-waldorf-clay-600'
    }
  }

  const sectionTitleClass = 'font-display text-xl font-semibold text-waldorf-clay-800'
  const cardClass = 'rounded-2xl border border-waldorf-cream-200 bg-white/90 backdrop-blur-sm shadow-sm'
  const audienceChipClass = (selected: boolean) =>
    `rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
      selected
        ? 'border-waldorf-sage-300 bg-waldorf-sage-100 text-waldorf-sage-700'
        : 'border-waldorf-cream-300 bg-white text-waldorf-clay-600 hover:bg-waldorf-cream-50'
    }`

  if (isLoading) {
    return (
      <AdminLayout activeTab="newsletters" contentVariant="plain" title="電子報編排" description="載入中...">
        <div className={`${cardClass} p-12`}>
          <LoadingSpinner />
        </div>
      </AdminLayout>
    )
  }

  if (!newsletter) {
    return (
      <AdminLayout activeTab="newsletters" contentVariant="plain" title="電子報編排" backLink={{ to: '/admin', label: '返回電子報列表' }}>
        <div className="rounded-xl border border-waldorf-rose-200 bg-waldorf-rose-50 p-6 text-waldorf-rose-700">
          {error || '找不到電子報'}
        </div>
      </AdminLayout>
    )
  }

  const isTemplate = newsletter.isTemplate
  const isDraft = newsletter.status === 'draft'
  const displayName = newsletter.weekNumber || newsletter.title || '特刊電子報'
  const showTitleSubline = Boolean(newsletter.weekNumber && newsletter.title)
  const workflowStep = isDraft ? 'compose' : 'publish'

  return (
    <ErrorBoundary>
      <AdminLayout
        activeTab={isTemplate ? 'templates' : 'newsletters'}
        contentVariant="plain"
        title={isTemplate ? '電子報模板' : '電子報編排'}
        description={
          isTemplate
            ? '調整模板的文章結構；由此模板建立的電子報會沿用這裡的編排。'
            : isDraft
              ? '第二步：加入並排序文章，接著預覽郵件，最後發布寄送。'
              : '這份電子報已發布。可在下方查看投遞批次，或補發給尚未收到的家長。'
        }
        backLink={{
          to: isTemplate ? '/admin/templates' : '/admin',
          label: isTemplate ? '返回模板列表' : '返回電子報列表',
        }}
        headerAction={
          <button
            type="button"
            onClick={() =>
              navigate(
                isTemplate
                  ? `/admin/newsletter/create?template=${newsletter.id}`
                  : `/admin/newsletter/create?sourceNewsletter=${newsletter.id}`
              )
            }
            className="rounded-xl border border-waldorf-peach-300 bg-white px-4 py-2.5 text-sm font-medium text-waldorf-peach-700 shadow-sm transition-colors hover:bg-waldorf-peach-50"
          >
            {isTemplate ? '由模板建立電子報' : '由此期建立模板'}
          </button>
        }
      >
        <div className="space-y-6">
          {!isTemplate && <NewsletterWorkflowSteps current={workflowStep} newsletter={newsletter} />}

          {/* Newsletter identity + primary actions */}
          <section className={`${cardClass} p-6`}>
            <div className="flex flex-wrap items-start justify-between gap-6">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-3">
                  <h2 className="font-display text-3xl font-bold text-waldorf-clay-800 tracking-tight">{displayName}</h2>
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold ${getStatusColor(newsletter.status)}`}>
                    {getStatusLabel(newsletter.status)}
                  </span>
                  {isTemplate && (
                    <span className="rounded-full border border-waldorf-peach-200 bg-waldorf-peach-50 px-3 py-1 text-xs font-semibold text-waldorf-peach-700">
                      模板
                    </span>
                  )}
                </div>
                {showTitleSubline && (
                  <p className="mt-1 text-lg text-waldorf-clay-600">{newsletter.title}</p>
                )}
                <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-waldorf-clay-500">
                  {!isTemplate && (
                    <span className="inline-flex items-center gap-1.5">
                      <svg className="h-4 w-4 text-waldorf-clay-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      發布日期: {new Date(newsletter.releaseDate).toLocaleDateString('zh-TW')}
                    </span>
                  )}
                  <span className="inline-flex items-center gap-1.5">
                    <svg className="h-4 w-4 text-waldorf-clay-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    {articles.length} 篇文章
                  </span>
                  {!isTemplate && (
                    <a
                      href={generateWeeklyUrl(newsletter.weekNumber || newsletter.id)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-waldorf-peach-600 hover:text-waldorf-peach-700"
                    >
                      查看公開頁面
                      <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                    </a>
                  )}
                </div>
              </div>

              {!isTemplate && (
                <div className="flex flex-wrap items-center gap-3">
                  <Link
                    to={getNewsletterPreviewPath(newsletter.id)}
                    className="inline-flex items-center gap-2 rounded-xl border border-waldorf-clay-200 bg-white px-4 py-2.5 text-sm font-medium text-waldorf-clay-700 shadow-sm transition-colors hover:bg-waldorf-cream-50"
                  >
                    <svg className="h-4 w-4 text-waldorf-clay-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                    預覽郵件
                  </Link>
                  {isDraft && (
                    <a
                      href="#publish"
                      className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-waldorf-sage-500 to-waldorf-sage-600 px-4 py-2.5 text-sm font-medium text-white shadow-lg shadow-waldorf-sage-200/50 transition-all hover:from-waldorf-sage-600 hover:to-waldorf-sage-700"
                    >
                      前往發布檢查
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                      </svg>
                    </a>
                  )}
                  {newsletter.status === 'published' && (
                    <button
                      type="button"
                      onClick={handleArchive}
                      disabled={isMutating}
                      className="rounded-xl bg-waldorf-cream-200 px-4 py-2.5 text-sm font-medium text-waldorf-clay-700 transition-colors hover:bg-waldorf-cream-300 disabled:opacity-50"
                    >
                      封存電子報
                    </button>
                  )}
                </div>
              )}
            </div>
          </section>

          {successMessage && (
            <div className="flex items-start gap-3 rounded-xl border border-waldorf-sage-200 bg-waldorf-sage-50 p-4 text-sm font-medium text-waldorf-sage-700 animate-fade-in">
              <svg className="mt-0.5 h-4 w-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {successMessage}
            </div>
          )}

          {error && (
            <div className="flex items-start gap-3 rounded-xl border border-waldorf-rose-200 bg-waldorf-rose-50 p-4 text-sm font-medium text-waldorf-rose-700 animate-fade-in">
              <svg className="mt-0.5 h-4 w-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4v.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {error}
            </div>
          )}

          {/* Newsletter metadata (collapsed by default so the article work stays in focus) */}
          <details className={`group ${cardClass}`}>
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-6 py-4 [&::-webkit-details-marker]:hidden">
              <div>
                <p className={sectionTitleClass}>電子報資訊</p>
                <p className="mt-0.5 text-sm text-waldorf-clay-500">
                  {isTemplate ? '模板名稱與摘要' : '週次、標題、摘要與預計發布日期'}
                </p>
              </div>
              <span className="inline-flex items-center gap-2 text-sm font-medium text-waldorf-peach-600">
                <span className="group-open:hidden">編輯電子報資訊</span>
                <span className="hidden group-open:inline">收合</span>
                <svg className="h-4 w-4 transition-transform group-open:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </span>
            </summary>
            <div className="border-t border-waldorf-cream-200 p-6">
              <NewsletterForm
                mode="edit"
                newsletter={newsletter}
                onCancel={handleBack}
                onSuccess={(updatedNewsletter) => {
                  setNewsletter(updatedNewsletter)
                  setSuccessMessage('電子報資訊已更新')
                  setError(null)
                  if (weekNumber && weekNumber !== updatedNewsletter.weekNumber) {
                    navigate(`/admin/newsletters/id/${encodeURIComponent(updatedNewsletter.id)}`, { replace: true })
                  } else {
                    void loadData()
                  }
                }}
              />
            </div>
          </details>

          {/* Article composition */}
          <section className={`${cardClass} overflow-hidden`} id="articles">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-waldorf-cream-200 px-6 py-4">
              <div>
                <h2 className={sectionTitleClass}>文章編排</h2>
                <p className="mt-0.5 text-sm text-waldorf-clay-500">用上下按鈕調整排序；每篇文章可設定共享或指定班級投遞。</p>
              </div>
              <button
                type="button"
                onClick={handleCreateDraftArticle}
                disabled={isMutating}
                className="inline-flex items-center gap-2 rounded-xl bg-waldorf-sage-500 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-waldorf-sage-600 disabled:opacity-50"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                建立草稿文章
              </button>
            </div>

            <div className="flex flex-wrap items-end gap-3 border-b border-waldorf-cream-200 bg-waldorf-cream-50/60 px-6 py-4">
              <div className="min-w-[260px] flex-1">
                <label htmlFor="available-article" className="mb-1.5 block text-sm font-semibold text-waldorf-clay-700">
                  加入既有文章
                </label>
                <select
                  id="available-article"
                  value={selectedArticleId}
                  onChange={(event) => setSelectedArticleId(event.target.value)}
                  className="w-full rounded-lg border border-waldorf-cream-300 bg-white px-4 py-2.5 text-sm text-waldorf-clay-700 focus:border-waldorf-sage-400 focus:outline-none focus:ring-2 focus:ring-waldorf-sage-200"
                >
                  <option value="">
                    {availableArticles.length === 0 ? '目前沒有可加入的文章' : `選擇文章（${availableArticles.length} 篇可用）`}
                  </option>
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
                className="rounded-lg border border-waldorf-clay-300 bg-white px-4 py-2.5 text-sm font-medium text-waldorf-clay-700 transition-colors hover:bg-waldorf-cream-50 disabled:opacity-50"
              >
                加入文章
              </button>
            </div>

            {articles.length === 0 ? (
              <div className="px-6 py-14 text-center">
                <div className="mx-auto mb-4 inline-flex h-14 w-14 items-center justify-center rounded-full bg-waldorf-cream-100">
                  <svg className="h-7 w-7 text-waldorf-clay-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <p className="font-medium text-waldorf-clay-600">這份電子報目前尚未加入任何文章。</p>
                <p className="mt-1 text-sm text-waldorf-clay-400">從上方選擇既有文章加入，或建立一篇新的草稿文章。</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
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
                      <tr key={article.id} className="align-top transition-colors hover:bg-waldorf-cream-50/40">
                        <td className="px-6 py-4 text-sm text-waldorf-clay-600">
                          <div className="flex items-center gap-2">
                            <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-waldorf-cream-100 text-xs font-semibold text-waldorf-clay-600">
                              {index + 1}
                            </span>
                            <div className="flex flex-col">
                              <button
                                type="button"
                                onClick={(event) => handleMoveArticle(article.id, -1, event)}
                                disabled={index === 0 || isMutating}
                                aria-label="上移"
                                className="rounded px-1 text-xs leading-none text-waldorf-peach-600 hover:bg-waldorf-peach-50 disabled:opacity-30 disabled:hover:bg-transparent"
                              >
                                ↑
                              </button>
                              <button
                                type="button"
                                onClick={(event) => handleMoveArticle(article.id, 1, event)}
                                disabled={index === articles.length - 1 || isMutating}
                                aria-label="下移"
                                className="rounded px-1 text-xs leading-none text-waldorf-peach-600 hover:bg-waldorf-peach-50 disabled:opacity-30 disabled:hover:bg-transparent"
                              >
                                ↓
                              </button>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm font-medium text-waldorf-clay-800">{article.title}</td>
                        <td className="px-6 py-4 text-sm">
                          <span
                            className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                              article.status === 'published'
                                ? 'bg-waldorf-sage-100 text-waldorf-sage-700'
                                : 'bg-waldorf-peach-100 text-waldorf-peach-700'
                            }`}
                          >
                            {getArticleStatusLabel(article.status)}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-waldorf-clay-600">
                          {(() => {
                            const draft = getDraftTargeting(article)
                            return (
                              <div className="space-y-2">
                                <div className="flex items-center gap-3">
                                  <label className="flex items-center gap-1.5 text-xs">
                                    <input
                                      type="radio"
                                      name={`targeting-${article.id}`}
                                      checked={draft.mode === 'shared'}
                                      onChange={() => handleChangeTargetingMode(article.id, 'shared')}
                                      className="accent-waldorf-sage-600"
                                    />
                                    共享
                                  </label>
                                  <label className="flex items-center gap-1.5 text-xs">
                                    <input
                                      type="radio"
                                      name={`targeting-${article.id}`}
                                      checked={draft.mode === 'targeted'}
                                      onChange={() => handleChangeTargetingMode(article.id, 'targeted')}
                                      className="accent-waldorf-sage-600"
                                    />
                                    目標班級
                                  </label>
                                </div>
                                {draft.mode === 'targeted' && (
                                  <div className="space-y-2 rounded-lg border border-waldorf-cream-200 bg-waldorf-cream-50/60 p-2">
                                    <input
                                      type="text"
                                      value={classSearchByArticleId[article.id] || ''}
                                      onChange={(event) => handleClassSearchChange(article.id, event.target.value)}
                                      placeholder="搜尋班級"
                                      className="w-full rounded border border-waldorf-cream-300 bg-white px-2 py-1 text-xs text-waldorf-clay-700"
                                    />
                                    <div className="max-h-28 space-y-1 overflow-y-auto">
                                      {availableClasses
                                        .filter((classItem) =>
                                          classItem.name
                                            .toLowerCase()
                                            .includes((classSearchByArticleId[article.id] || '').trim().toLowerCase())
                                        )
                                        .map((classItem) => (
                                          <label key={classItem.id} className="flex items-center gap-1.5 text-xs">
                                            <input
                                              type="checkbox"
                                              checked={draft.classIds.includes(classItem.id)}
                                              onChange={() => handleToggleTargetClass(article.id, classItem.id)}
                                              disabled={isMutating}
                                              className="accent-waldorf-sage-600"
                                            />
                                            {classItem.name}
                                          </label>
                                        ))}
                                    </div>
                                    {draft.classIds.length > 0 && (
                                      <p className="text-[11px] text-waldorf-clay-500">已選 {draft.classIds.length} 個班級</p>
                                    )}
                                  </div>
                                )}
                                <button
                                  type="button"
                                  onClick={() => handleSaveTargeting(article)}
                                  disabled={isMutating}
                                  className="rounded border border-waldorf-cream-300 bg-white px-2 py-1 text-xs text-waldorf-clay-700 hover:bg-waldorf-cream-50 disabled:opacity-50"
                                >
                                  儲存班級設定
                                </button>
                              </div>
                            )
                          })()}
                        </td>
                        <td className="px-6 py-4 text-sm text-waldorf-clay-500 whitespace-nowrap">
                          {article.editedAt ? new Date(article.editedAt).toLocaleString('zh-TW') : '-'}
                        </td>
                        <td className="px-6 py-4 text-right text-sm whitespace-nowrap">
                          <div className="flex justify-end gap-3">
                            <button
                              type="button"
                              onClick={() => handleEditArticle(article.id)}
                              className="font-medium text-waldorf-peach-600 hover:text-waldorf-peach-700"
                            >
                              編輯
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRemoveArticle(article.id)}
                              className="font-medium text-waldorf-rose-600 hover:text-waldorf-rose-700"
                            >
                              移除
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* Publish & deliver */}
          {!isTemplate && (
            <section className={`${cardClass} p-6 scroll-mt-6`} id="publish">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h2 className={sectionTitleClass}>發布寄送</h2>
                  <p className="mt-0.5 text-sm text-waldorf-clay-500">
                    {isDraft
                      ? '選擇投遞對象並確認檢查結果後，發布電子報並建立寄送批次。'
                      : '這份電子報已發布。下方的投遞對象設定會套用在補發批次。'}
                  </p>
                </div>
                {isDraft && (
                  <button
                    type="button"
                    onClick={handlePublish}
                    disabled={isMutating || !publishReadiness.canPublish}
                    className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-waldorf-sage-500 to-waldorf-sage-600 px-5 py-2.5 text-sm font-medium text-white shadow-lg shadow-waldorf-sage-200/50 transition-all hover:from-waldorf-sage-600 hover:to-waldorf-sage-700 disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none"
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                    </svg>
                    發布並寄送電子報
                  </button>
                )}
              </div>

              <div
                className={`mt-5 flex items-start gap-3 rounded-xl border p-4 text-sm ${
                  publishReadiness.canPublish
                    ? 'border-waldorf-sage-200 bg-waldorf-sage-50 text-waldorf-sage-700'
                    : 'border-waldorf-rose-200 bg-waldorf-rose-50 text-waldorf-rose-700'
                }`}
              >
                <svg className="mt-0.5 h-5 w-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  {publishReadiness.canPublish ? (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  )}
                </svg>
                <div className="min-w-0">
                  <p className="font-semibold">{publishReadiness.canPublish ? '發布檢查通過' : '尚無法發布'}</p>
                  {publishReadiness.canPublish ? (
                    <p className="mt-0.5">內容與投遞對象已通過檢查，可發布並建立寄送批次。</p>
                  ) : (
                    <ul className="mt-1 list-disc space-y-0.5 pl-5">
                      {publishReadiness.issues.map((issue) => (
                        <li key={issue}>{issue}</li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>

              <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                <div>
                  <label className="block text-sm text-waldorf-clay-700">
                    <span className="mb-1.5 block font-semibold">投遞對象</span>
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
                      className="w-full rounded-lg border border-waldorf-cream-300 bg-white px-3 py-2.5 text-sm focus:border-waldorf-sage-400 focus:outline-none focus:ring-2 focus:ring-waldorf-sage-200"
                    >
                      <option value="all">全部符合資格家庭</option>
                      <option value="classes">指定班級</option>
                      <option value="families">指定家庭</option>
                      <option value="family">單一家庭</option>
                    </select>
                  </label>

                  {publishAudience.mode === 'classes' && (
                    <div className="mt-3 flex max-h-40 flex-wrap gap-2 overflow-y-auto rounded-lg border border-waldorf-cream-200 bg-waldorf-cream-50/60 p-3">
                      {availableClasses.map((classItem) => {
                        const selected = (publishAudience.classIds ?? []).includes(classItem.id)
                        return (
                          <button
                            key={classItem.id}
                            type="button"
                            aria-pressed={selected}
                            onClick={() =>
                              setPublishAudience((prev) => {
                                const current = prev.classIds ?? []
                                const next = selected
                                  ? current.filter((id) => id !== classItem.id)
                                  : [...current, classItem.id]
                                return { ...prev, classIds: next }
                              })
                            }
                            className={audienceChipClass(selected)}
                          >
                            {classItem.name}
                          </button>
                        )
                      })}
                    </div>
                  )}
                  {publishAudience.mode === 'families' && (
                    <div className="mt-3 flex max-h-40 flex-wrap gap-2 overflow-y-auto rounded-lg border border-waldorf-cream-200 bg-waldorf-cream-50/60 p-3">
                      {availableFamilies.map((family) => {
                        const selected = (publishAudience.familyIds ?? []).includes(family.id)
                        return (
                          <button
                            key={family.id}
                            type="button"
                            aria-pressed={selected}
                            onClick={() =>
                              setPublishAudience((prev) => {
                                const current = prev.familyIds ?? []
                                const next = selected
                                  ? current.filter((id) => id !== family.id)
                                  : [...current, family.id]
                                return { ...prev, familyIds: next }
                              })
                            }
                            className={audienceChipClass(selected)}
                          >
                            {family.name}
                          </button>
                        )
                      })}
                    </div>
                  )}
                  {publishAudience.mode === 'family' && (
                    <select
                      value={publishAudience.familyId ?? ''}
                      onChange={(event) =>
                        setPublishAudience((prev) => ({
                          ...prev,
                          familyId: event.target.value || undefined,
                        }))
                      }
                      aria-label="選擇家庭"
                      className="mt-3 w-full rounded-lg border border-waldorf-cream-300 bg-white px-3 py-2.5 text-sm focus:border-waldorf-sage-400 focus:outline-none focus:ring-2 focus:ring-waldorf-sage-200"
                    >
                      <option value="">選擇家庭</option>
                      {availableFamilies.map((family) => (
                        <option key={family.id} value={family.id}>
                          {family.name}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                {publishReadiness.audienceSummary && (
                  <div className="rounded-xl border border-waldorf-cream-200 bg-waldorf-cream-50 p-4 text-sm text-waldorf-clay-700">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-waldorf-clay-400">投遞對象摘要</p>
                    <div className="space-y-1">
                      <p>候選家庭：{publishReadiness.audienceSummary.totalCandidates}</p>
                      <p>可投遞家庭：{publishReadiness.audienceSummary.eligibleCount}</p>
                      <p>排除家庭：{publishReadiness.audienceSummary.ineligibleCount}</p>
                      <p className="font-semibold text-waldorf-sage-700">可寄送家長電子郵件：{publishReadiness.audienceSummary.eligibleRecipientCount ?? publishReadiness.audienceSummary.eligibleCount}</p>
                    </div>
                    <p className="mt-2 text-xs text-waldorf-clay-500">前三項以家庭計算；最後一項以 SMZ Auth 授權的家長電子郵件計算。一個家庭可有多位可寄送家長。</p>
                    {Object.entries(publishReadiness.audienceSummary.exclusionReasons ?? {}).length > 0 && (
                      <div className="mt-3 border-t border-waldorf-cream-200 pt-2 text-xs text-waldorf-clay-600">
                        {Object.entries(publishReadiness.audienceSummary.exclusionReasons ?? {}).map(([reason, count]) => (
                          <p key={reason}>{EXCLUSION_REASON_LABELS[reason] ?? '其他排除原因'}（家庭）：{count}</p>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </section>
          )}

          {/* Delivery history */}
          {!isTemplate && (
            <section className={`${cardClass} p-6`}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className={sectionTitleClass}>投遞批次紀錄</h2>
                {deliveryBatches.length > 0 && (
                  <span className="text-sm text-waldorf-clay-500">{deliveryBatches.length} 個批次</span>
                )}
              </div>
              {deliveryBatches.length === 0 ? (
                <p className="mt-3 text-sm text-waldorf-clay-500">尚無投遞批次。</p>
              ) : (
                <div className="mt-4 space-y-3">
                  {deliveryBatches.map((batch) => (
                    <div key={batch.id} className="rounded-xl border border-waldorf-cream-200 p-4 text-sm">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="font-semibold text-waldorf-clay-700">
                          {batch.trigger === 'publish' ? '發布批次' : '補發批次'}
                          <span className="ml-2 font-normal text-waldorf-clay-500">{new Date(batch.createdAt).toLocaleString('zh-TW')}</span>
                        </p>
                        <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${getBatchStateStyle(batch.state)}`}>{batch.state}</span>
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                        <div className="rounded-lg bg-waldorf-sage-50 px-3 py-2">
                          <p className="text-[11px] uppercase tracking-wider text-waldorf-sage-600">送達</p>
                          <p className="text-lg font-semibold text-waldorf-sage-700">{batch.sentRecipients}</p>
                        </div>
                        <div className="rounded-lg bg-waldorf-cream-50 px-3 py-2">
                          <p className="text-[11px] uppercase tracking-wider text-waldorf-clay-500">可投遞</p>
                          <p className="text-lg font-semibold text-waldorf-clay-700">{batch.eligibleRecipients}</p>
                        </div>
                        <div className={`rounded-lg px-3 py-2 ${batch.failedRecipients > 0 ? 'bg-waldorf-rose-50' : 'bg-waldorf-cream-50'}`}>
                          <p className={`text-[11px] uppercase tracking-wider ${batch.failedRecipients > 0 ? 'text-waldorf-rose-600' : 'text-waldorf-clay-500'}`}>失敗</p>
                          <p className={`text-lg font-semibold ${batch.failedRecipients > 0 ? 'text-waldorf-rose-700' : 'text-waldorf-clay-700'}`}>{batch.failedRecipients}</p>
                        </div>
                        <div className="rounded-lg bg-waldorf-cream-50 px-3 py-2">
                          <p className="text-[11px] uppercase tracking-wider text-waldorf-clay-500">排除</p>
                          <p className="text-lg font-semibold text-waldorf-clay-700">{batch.invalidRecipients}</p>
                        </div>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => handleResendBatch(batch.id)}
                          disabled={isMutating}
                          className="rounded-lg border border-waldorf-peach-300 px-3 py-1.5 text-xs font-medium text-waldorf-peach-700 hover:bg-waldorf-peach-50 disabled:opacity-50"
                        >
                          補發此批次（同一份電子報）
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleToggleBatchRecipients(batch.id)}
                          disabled={loadingRecipientsBatchId === batch.id}
                          className="rounded-lg border border-waldorf-clay-300 px-3 py-1.5 text-xs font-medium text-waldorf-clay-700 hover:bg-waldorf-cream-50 disabled:opacity-50"
                        >
                          {expandedBatchId === batch.id ? '隱藏收件者結果' : '查看收件者結果'}
                        </button>
                      </div>
                      {loadingRecipientsBatchId === batch.id && (
                        <p className="mt-2 text-xs text-waldorf-clay-500">載入中...</p>
                      )}
                      {expandedBatchId === batch.id && (
                        <div className="mt-3 max-h-56 overflow-y-auto rounded-lg border border-waldorf-cream-200 bg-waldorf-cream-50 p-2">
                          {(batchRecipientsByBatchId[batch.id] ?? []).length === 0 ? (
                            <p className="text-xs text-waldorf-clay-500">此批次沒有收件者結果。</p>
                          ) : (
                            <ul className="space-y-1 text-xs text-waldorf-clay-700">
                              {(batchRecipientsByBatchId[batch.id] ?? []).map((recipient) => (
                                <li key={recipient.id} className="rounded border border-waldorf-cream-200 bg-white p-2">
                                  <p className="font-medium">
                                    {recipient.parentEmail ?? recipient.parentId ?? recipient.familyId}
                                  </p>
                                  <p className="text-waldorf-clay-500">
                                    資格 {recipient.eligibilityStatus} / 準備 {recipient.preparationStatus} / 發送 {recipient.sendStatus}
                                  </p>
                                  {recipient.failureReason && (
                                    <p className="text-waldorf-rose-700">原因：{recipient.failureReason}</p>
                                  )}
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}
        </div>
      </AdminLayout>
    </ErrorBoundary>
  )
}

export default AdminArticleListPage
