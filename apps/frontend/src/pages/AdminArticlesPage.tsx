import { PdfArticleImport } from '@/components/admin/PdfArticleImport'
import { backendRequest } from '@/services/backendApi'
import type { ArticleRow } from '@/types/database'
import { Fragment, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { adminService, AdminServiceError } from '@/services/adminService'
import type {
  AdminArticle,
  AdminRecycleBinArticle,
  AdminNewsletter,
  ArticleCategory,
  ArticleRevision,
  ArticleTag,
  Class,
} from '@/types/admin'
import { AdminLayout } from '@/components/admin/AdminLayout'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import { getAdminNewsletterPath } from '@/utils/adminNewsletterRoutes'
import { generateWeeklyUrl } from '@/utils/urlUtils'

type ArticleStatusFilter = 'all' | 'draft' | 'published'
type ArticleSortOption = 'order_asc' | 'updated_desc' | 'updated_asc' | 'title_asc' | 'title_desc'
const ARTICLE_RETENTION_LABEL = '30 天'

const SORT_OPTIONS: ArticleSortOption[] = ['order_asc', 'updated_desc', 'updated_asc', 'title_asc', 'title_desc']

/** Articles scoped to one newsletter read best in newsletter order; the global list by recency. */
const getDefaultSort = (newsletterId: string): ArticleSortOption =>
  newsletterId ? 'order_asc' : 'updated_desc'

const parseSortParam = (value: string | null, newsletterId: string): ArticleSortOption => {
  if (value && (SORT_OPTIONS as string[]).includes(value)) {
    const parsed = value as ArticleSortOption
    if (parsed === 'order_asc' && !newsletterId) return getDefaultSort(newsletterId)
    return parsed
  }
  return getDefaultSort(newsletterId)
}

const cardClass = 'rounded-xl border border-waldorf-cream-200 bg-white shadow-sm'
const inputClass =
  'w-full rounded-lg border border-waldorf-cream-300 bg-white px-3 py-2 text-sm text-waldorf-clay-700 focus:border-waldorf-sage-400 focus:outline-none focus:ring-2 focus:ring-waldorf-sage-200'
const labelClass = 'mb-1.5 block text-sm font-semibold text-waldorf-clay-700'
const thClass = 'px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-waldorf-clay-500'
const rowActionClass = 'whitespace-nowrap text-xs font-medium disabled:cursor-not-allowed disabled:opacity-40'

const getArticleStatusLabel = (status: AdminArticle['status']) =>
  status === 'published' ? '已發布' : '草稿'

const getArticleStatusClass = (status: AdminArticle['status']) =>
  status === 'published'
    ? 'bg-waldorf-sage-100 text-waldorf-sage-700'
    : 'bg-waldorf-peach-100 text-waldorf-peach-700'

const getNewsletterStatusLabel = (status: AdminNewsletter['status']) => {
  switch (status) {
    case 'published':
      return '已發布'
    case 'archived':
      return '已封存'
    default:
      return '草稿'
  }
}

export function AdminArticlesPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [publishingArticleId, setPublishingArticleId] = useState<string | null>(null)
  const [articles, setArticles] = useState<AdminArticle[]>([])
  const [allLoadedArticles, setAllLoadedArticles] = useState<AdminArticle[]>([])
  const [newsletters, setNewsletters] = useState<AdminNewsletter[]>([])
  const [templateNewsletters, setTemplateNewsletters] = useState<AdminNewsletter[]>([])
  const [membershipsByArticleId, setMembershipsByArticleId] = useState<
    Record<string, Array<{ newsletterId: string; label: string; isTemplate: boolean }>>
  >({})
  const [selectedNewsletterId, setSelectedNewsletterId] = useState(searchParams.get('newsletter') || '')
  const [showTemplateOnly, setShowTemplateOnly] = useState(searchParams.get('templateOnly') === '1')
  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || '')
  const [statusFilter, setStatusFilter] = useState<ArticleStatusFilter>(() => {
    const status = searchParams.get('status')
    if (status === 'draft' || status === 'published') return status
    return 'all'
  })
  const [classFilter, setClassFilter] = useState(searchParams.get('classId') || 'all')
  const [tagFilter, setTagFilter] = useState(searchParams.get('tagId') || 'all')
  const [sortOption, setSortOption] = useState<ArticleSortOption>(() =>
    parseSortParam(searchParams.get('sort'), searchParams.get('newsletter') || '')
  )
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [taxonomyError, setTaxonomyError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [classes, setClasses] = useState<Class[]>([])

  const [categories, setCategories] = useState<ArticleCategory[]>([])
  const [tags, setTags] = useState<ArticleTag[]>([])
  const [taxonomyByArticleId, setTaxonomyByArticleId] = useState<
    Record<string, { categoryIds: string[]; tagIds: string[] }>
  >({})
  const [isTaxonomyLoading, setIsTaxonomyLoading] = useState(false)
  const [newCategoryName, setNewCategoryName] = useState('')
  const [newCategoryDescription, setNewCategoryDescription] = useState('')
  const [newTagName, setNewTagName] = useState('')
  const [newTagDescription, setNewTagDescription] = useState('')
  const [isCreatingCategory, setIsCreatingCategory] = useState(false)
  const [isCreatingTag, setIsCreatingTag] = useState(false)

  const [editingArticleId, setEditingArticleId] = useState<string | null>(null)
  const [assignmentDrafts, setAssignmentDrafts] = useState<
    Record<string, { categoryIds: string[]; tagIds: string[] }>
  >({})
  const [savingAssignmentArticleId, setSavingAssignmentArticleId] = useState<string | null>(null)
  const [versionHistoryByArticleId, setVersionHistoryByArticleId] = useState<
    Record<string, ArticleRevision[]>
  >({})
  const [openVersionHistoryArticleId, setOpenVersionHistoryArticleId] = useState<string | null>(null)
  const [loadingVersionHistoryArticleId, setLoadingVersionHistoryArticleId] = useState<string | null>(null)
  const [restoringRevisionId, setRestoringRevisionId] = useState<string | null>(null)
  const [recycleBinArticles, setRecycleBinArticles] = useState<AdminRecycleBinArticle[]>([])
  const [isRecycleBinLoading, setIsRecycleBinLoading] = useState(false)
  const [deletingArticleId, setDeletingArticleId] = useState<string | null>(null)
  const [removingArticleId, setRemovingArticleId] = useState<string | null>(null)
  const [isCreatingArticle, setIsCreatingArticle] = useState(false)
  const [restoringDeletedArticleId, setRestoringDeletedArticleId] = useState<string | null>(null)
  const [purgingArticleId, setPurgingArticleId] = useState<string | null>(null)

  useEffect(() => {
    void loadNewsletters()
    void loadTaxonomyDefinitions()
    void loadClasses()
    void loadRecycleBin()
  }, [])

  useEffect(() => {
    void loadArticles()
  }, [selectedNewsletterId])

  const loadNewsletters = async () => {
    try {
      const [regular, templates] = await Promise.all([
        adminService.fetchNewsletters(),
        adminService.fetchNewsletterTemplates(),
      ])
      setNewsletters(regular.filter((newsletter) => !newsletter.isTemplate))
      setTemplateNewsletters(templates)
    } catch (err) {
      const message = err instanceof AdminServiceError ? err.message : '無法載入電子報清單'
      setError(message)
    }
  }

  const handleCopyArticle = async (article: AdminArticle, fromTemplate: boolean) => {
    if (isCreatingArticle) return
    setIsCreatingArticle(true)
    setError(null)
    try {
      const copy = await backendRequest<ArticleRow>(`/api/cms/articles/${encodeURIComponent(article.id)}/${fromTemplate ? 'from-template' : 'duplicate'}`, { method: 'POST' })
      navigate(`/admin/article/${copy.id}/edit`)
    } catch (err) {
      setError(err instanceof Error ? err.message : '複製文章失敗')
    } finally {
      setIsCreatingArticle(false)
    }
  }

  const handlePublishArticle = async (article: AdminArticle) => {
    if (publishingArticleId) return
    setPublishingArticleId(article.id)
    setError(null)
    setSuccessMessage(null)
    try {
      const published = await backendRequest<ArticleRow>(`/api/cms/articles/${encodeURIComponent(article.id)}/publish`, { method: 'POST' })
      const update = (rows: AdminArticle[]) => rows.map(row => row.id === article.id
        ? { ...row, status: 'published' as const, updatedAt: published.updated_at } : row)
      setArticles(update)
      setAllLoadedArticles(update)
      setSuccessMessage(`已發布「${article.title}」`)
    } catch (err) {
      setError(err instanceof Error ? err.message : '發布文章失敗，請稍後再試')
    } finally {
      setPublishingArticleId(null)
    }
  }

  const loadArticles = async () => {
    try {
      setIsLoading(true)
      setError(null)
      setTaxonomyError(null)

      const data = selectedNewsletterId
        ? await adminService.fetchArticlesByNewsletterId(selectedNewsletterId)
        : await adminService.fetchAllArticles()

      setAllLoadedArticles(data)

      const memberships = await adminService.fetchArticleNewsletterMemberships(
        data.map((article) => article.id)
      )
      setMembershipsByArticleId(memberships)
      await loadArticleTaxonomyAssignments(data.map((article) => article.id))
    } catch (err) {
      const message = err instanceof AdminServiceError ? err.message : '無法載入文章列表'
      setError(message)
      setMembershipsByArticleId({})
      setTaxonomyByArticleId({})
    } finally {
      setIsLoading(false)
    }
  }

  const loadTaxonomyDefinitions = async () => {
    try {
      setTaxonomyError(null)
      const [categoryRows, tagRows] = await Promise.all([
        adminService.fetchArticleCategories({ includeInactive: true }),
        adminService.fetchArticleTags({ includeInactive: true }),
      ])
      setCategories(categoryRows)
      setTags(tagRows)
    } catch (err) {
      const message = err instanceof AdminServiceError ? err.message : '無法載入分類與標籤'
      setTaxonomyError(message)
    }
  }

  const loadRecycleBin = async () => {
    try {
      setIsRecycleBinLoading(true)
      setTaxonomyError(null)
      const deletedRows = await adminService.fetchDeletedArticles()
      setRecycleBinArticles(deletedRows)
    } catch (err) {
      const message = err instanceof AdminServiceError ? err.message : '無法載入回收站資料'
      setTaxonomyError(message)
    } finally {
      setIsRecycleBinLoading(false)
    }
  }

  const loadClasses = async () => {
    try {
      const classRows = await adminService.fetchClasses({ includeInactive: true })
      setClasses(classRows)
    } catch (err) {
      const message = err instanceof AdminServiceError ? err.message : '無法載入班級篩選'
      setTaxonomyError(message)
    }
  }

  const loadArticleTaxonomyAssignments = async (articleIds: string[]) => {
    try {
      setIsTaxonomyLoading(true)
      const data = await adminService.fetchArticleTaxonomyAssignments(articleIds)
      setTaxonomyByArticleId(data)
    } catch (err) {
      const message = err instanceof AdminServiceError ? err.message : '無法載入文章分類與標籤關聯'
      setTaxonomyError(message)
    } finally {
      setIsTaxonomyLoading(false)
    }
  }

  const findNewsletterById = (newsletterId: string): AdminNewsletter | undefined =>
    newsletters.find((newsletter) => newsletter.id === newsletterId) ??
    templateNewsletters.find((newsletter) => newsletter.id === newsletterId)

  const selectedNewsletter = useMemo(() => {
    if (!selectedNewsletterId) return null
    return (
      newsletters.find((newsletter) => newsletter.id === selectedNewsletterId) ??
      templateNewsletters.find((newsletter) => newsletter.id === selectedNewsletterId) ??
      null
    )
  }, [newsletters, templateNewsletters, selectedNewsletterId])

  const selectedNewsletterLabel = useMemo(() => {
    if (!selectedNewsletterId) return showTemplateOnly ? '全部模板電子報' : '全部電子報'
    if (!selectedNewsletter) return '未知電子報'
    return selectedNewsletter.weekNumber || selectedNewsletter.title || selectedNewsletter.id
  }, [selectedNewsletter, selectedNewsletterId, showTemplateOnly])

  const selectableNewsletters = showTemplateOnly ? templateNewsletters : newsletters
  const activeCategories = useMemo(
    () => categories.filter((category) => category.isActive !== false),
    [categories]
  )
  const activeClasses = useMemo(
    () => classes.filter((classInfo) => classInfo.isActive !== false),
    [classes]
  )
  const activeTags = useMemo(
    () => tags.filter((tag) => tag.isActive !== false),
    [tags]
  )

  const hasActiveFilters =
    searchQuery.trim() !== '' || statusFilter !== 'all' || classFilter !== 'all' || tagFilter !== 'all'

  useEffect(() => {
    const nextParams = new URLSearchParams()
    if (selectedNewsletterId) nextParams.set('newsletter', selectedNewsletterId)
    if (showTemplateOnly) nextParams.set('templateOnly', '1')
    if (searchQuery.trim()) nextParams.set('q', searchQuery.trim())
    if (statusFilter !== 'all') nextParams.set('status', statusFilter)
    if (classFilter !== 'all') nextParams.set('classId', classFilter)
    if (tagFilter !== 'all') nextParams.set('tagId', tagFilter)
    if (sortOption !== getDefaultSort(selectedNewsletterId)) nextParams.set('sort', sortOption)

    if (nextParams.toString() !== searchParams.toString()) {
      setSearchParams(nextParams, { replace: true })
    }
  }, [
    classFilter,
    searchParams,
    searchQuery,
    selectedNewsletterId,
    setSearchParams,
    showTemplateOnly,
    sortOption,
    statusFilter,
    tagFilter,
  ])

  useEffect(() => {
    const normalizedSearch = searchQuery.trim().toLowerCase()

    const filtered = allLoadedArticles.filter((article) => {
      const memberships = membershipsByArticleId[article.id] || []

      // The template/regular split only applies to the global list; a selected
      // newsletter already scopes the articles, so keep every one of them.
      if (!selectedNewsletterId) {
        const hasTemplateMembership = memberships.some((membership) => membership.isTemplate)
        const isTemplateOnlyArticle =
          hasTemplateMembership && memberships.every((membership) => membership.isTemplate)
        if (showTemplateOnly && !hasTemplateMembership) return false
        if (!showTemplateOnly && isTemplateOnlyArticle) return false
      }

      if (normalizedSearch) {
        const assignment = taxonomyByArticleId[article.id] || { categoryIds: [], tagIds: [] }
        const categoryNames = assignment.categoryIds.map((id) => {
          return categories.find((category) => category.id === id)?.name || id
        })
        const tagNames = assignment.tagIds.map((id) => {
          return tags.find((tag) => tag.id === id)?.name || id
        })
        const searchableText = [
          article.title,
          article.summary || '',
          article.content || '',
          article.status,
          ...(article.classIds || []),
          ...categoryNames,
          ...tagNames,
          ...memberships.map((membership) => membership.label),
        ]
          .join(' ')
          .toLowerCase()

        if (!searchableText.includes(normalizedSearch)) return false
      }

      if (statusFilter !== 'all' && article.status !== statusFilter) return false

      if (classFilter !== 'all' && !(article.classIds || []).includes(classFilter)) return false

      if (tagFilter !== 'all') {
        const assignment = taxonomyByArticleId[article.id] || { categoryIds: [], tagIds: [] }
        if (!assignment.tagIds.includes(tagFilter)) return false
      }

      return true
    })

    filtered.sort((left, right) => {
      if (sortOption === 'order_asc') {
        const orderCompare = (left.order ?? 0) - (right.order ?? 0)
        if (orderCompare !== 0) return orderCompare
        return left.title.localeCompare(right.title, 'zh-Hant')
      }

      if (sortOption === 'updated_asc' || sortOption === 'updated_desc') {
        const leftTime = new Date(left.updatedAt).getTime()
        const rightTime = new Date(right.updatedAt).getTime()
        return sortOption === 'updated_asc' ? leftTime - rightTime : rightTime - leftTime
      }

      const titleCompare = left.title.localeCompare(right.title, 'zh-Hant')
      return sortOption === 'title_asc' ? titleCompare : -titleCompare
    })

    setArticles(filtered)
  }, [
    allLoadedArticles,
    categories,
    classFilter,
    membershipsByArticleId,
    searchQuery,
    selectedNewsletterId,
    showTemplateOnly,
    sortOption,
    statusFilter,
    tags,
    tagFilter,
    taxonomyByArticleId,
  ])

  const handleSelectNewsletter = (nextNewsletterId: string) => {
    setSortOption((current) => {
      // Follow the contextual default unless the user picked a sort explicitly.
      if (current === getDefaultSort(selectedNewsletterId)) return getDefaultSort(nextNewsletterId)
      if (current === 'order_asc' && !nextNewsletterId) return 'updated_desc'
      return current
    })
    setSelectedNewsletterId(nextNewsletterId)
  }

  const handleToggleTemplateMode = () => {
    handleSelectNewsletter('')
    setShowTemplateOnly((prev) => !prev)
  }

  const handleClearFilters = () => {
    setSearchQuery('')
    setStatusFilter('all')
    setClassFilter('all')
    setTagFilter('all')
  }

  const getArticleAssignment = (articleId: string) => {
    return taxonomyByArticleId[articleId] || { categoryIds: [], tagIds: [] }
  }

  const getCategoryNameById = (id: string) =>
    categories.find((category) => category.id === id)?.name || id

  const getTagNameById = (id: string) =>
    tags.find((tag) => tag.id === id)?.name || id

  const formatDateTime = (value?: string | null) => {
    if (!value) return '—'
    return new Date(value).toLocaleString('zh-TW')
  }

  /**
   * The inline editor lives on the reader page for a newsletter, so an article
   * needs a newsletter context to be edited. Prefer the selected newsletter,
   * then fall back to the first newsletter the article belongs to.
   */
  const getEditorTarget = (article: AdminArticle): { id: string; weekNumber?: string | null } | null => {
    if (selectedNewsletterId) {
      return selectedNewsletter
        ? { id: selectedNewsletter.id, weekNumber: selectedNewsletter.weekNumber }
        : { id: selectedNewsletterId }
    }

    const memberships = membershipsByArticleId[article.id] || []
    const primary = memberships.find((membership) => !membership.isTemplate) ?? memberships[0]
    if (!primary) return null

    const newsletter = findNewsletterById(primary.newsletterId)
    return newsletter
      ? { id: newsletter.id, weekNumber: newsletter.weekNumber }
      : { id: primary.newsletterId }
  }

  const navigateToEditor = (target: { id: string; weekNumber?: string | null }, articleId: string) => {
    navigate(`${generateWeeklyUrl(target.weekNumber || target.id)}?admin=1`, {
      state: {
        focusArticleId: articleId,
        startInEditMode: true,
      },
    })
  }

  const handleEditArticle = (article: AdminArticle) => {
    const target = getEditorTarget(article)
    if (!target) {
      setTaxonomyError('此文章尚未加入任何電子報，請先在電子報編排頁加入後再編輯。')
      return
    }
    navigateToEditor(target, article.id)
  }

  const handleCreateDraftArticle = async () => {
    if (!selectedNewsletterId) return

    try {
      setIsCreatingArticle(true)
      setTaxonomyError(null)
      setSuccessMessage(null)
      const article = await adminService.createArticleForNewsletter(selectedNewsletterId)
      navigateToEditor(
        selectedNewsletter
          ? { id: selectedNewsletter.id, weekNumber: selectedNewsletter.weekNumber }
          : { id: selectedNewsletterId },
        article.id
      )
    } catch (err) {
      const message = err instanceof AdminServiceError ? err.message : '建立文章失敗'
      setTaxonomyError(message)
    } finally {
      setIsCreatingArticle(false)
    }
  }

  const handleRemoveFromNewsletter = async (article: AdminArticle) => {
    if (!selectedNewsletterId) return
    const confirmed = window.confirm(
      `確定要將「${article.title}」從 ${selectedNewsletterLabel} 移除嗎？（不會刪除文章本身）`
    )
    if (!confirmed) return

    try {
      setTaxonomyError(null)
      setSuccessMessage(null)
      setRemovingArticleId(article.id)
      await adminService.removeArticleFromNewsletterById(article.id, selectedNewsletterId)
      await loadArticles()
      setSuccessMessage(`已將「${article.title}」從 ${selectedNewsletterLabel} 移除`)
    } catch (err) {
      const message = err instanceof AdminServiceError ? err.message : '移除文章失敗'
      setTaxonomyError(message)
    } finally {
      setRemovingArticleId(null)
    }
  }

  const openAssignmentEditor = (articleId: string) => {
    const current = getArticleAssignment(articleId)
    setAssignmentDrafts((prev) => ({
      ...prev,
      [articleId]: {
        categoryIds: [...current.categoryIds],
        tagIds: [...current.tagIds],
      },
    }))
    setEditingArticleId(articleId)
  }

  const closeAssignmentEditor = () => {
    setEditingArticleId(null)
  }

  const toggleCategoryDraft = (articleId: string, categoryId: string) => {
    setAssignmentDrafts((prev) => {
      const current = prev[articleId] || { categoryIds: [], tagIds: [] }
      const nextCategoryIds = current.categoryIds.includes(categoryId)
        ? current.categoryIds.filter((id) => id !== categoryId)
        : [...current.categoryIds, categoryId]
      return {
        ...prev,
        [articleId]: {
          ...current,
          categoryIds: nextCategoryIds,
        },
      }
    })
  }

  const toggleTagDraft = (articleId: string, tagId: string) => {
    setAssignmentDrafts((prev) => {
      const current = prev[articleId] || { categoryIds: [], tagIds: [] }
      const nextTagIds = current.tagIds.includes(tagId)
        ? current.tagIds.filter((id) => id !== tagId)
        : [...current.tagIds, tagId]
      return {
        ...prev,
        [articleId]: {
          ...current,
          tagIds: nextTagIds,
        },
      }
    })
  }

  const handleSaveAssignments = async (articleId: string) => {
    const draft = assignmentDrafts[articleId] || { categoryIds: [], tagIds: [] }
    try {
      setSavingAssignmentArticleId(articleId)
      setTaxonomyError(null)
      setSuccessMessage(null)
      await adminService.updateArticleTaxonomyAssignments(articleId, draft)
      setTaxonomyByArticleId((prev) => ({
        ...prev,
        [articleId]: {
          categoryIds: [...draft.categoryIds],
          tagIds: [...draft.tagIds],
        },
      }))
      setEditingArticleId(null)
      setSuccessMessage('文章分類與標籤已更新')
    } catch (err) {
      const message = err instanceof AdminServiceError ? err.message : '無法更新文章分類與標籤'
      setTaxonomyError(message)
    } finally {
      setSavingAssignmentArticleId(null)
    }
  }

  const handleCreateCategory = async () => {
    const name = newCategoryName.trim()
    if (!name) {
      setTaxonomyError('分類名稱為必填項')
      return
    }
    try {
      setIsCreatingCategory(true)
      setTaxonomyError(null)
      await adminService.createArticleCategory(name, newCategoryDescription)
      setNewCategoryName('')
      setNewCategoryDescription('')
      await loadTaxonomyDefinitions()
    } catch (err) {
      const message = err instanceof AdminServiceError ? err.message : '新增分類失敗'
      setTaxonomyError(message)
    } finally {
      setIsCreatingCategory(false)
    }
  }

  const handleRenameCategory = async (category: ArticleCategory) => {
    const nextName = window.prompt('請輸入新的分類名稱', category.name)
    if (nextName === null) return
    try {
      setTaxonomyError(null)
      await adminService.updateArticleCategory(category.id, { name: nextName })
      await loadTaxonomyDefinitions()
    } catch (err) {
      const message = err instanceof AdminServiceError ? err.message : '更新分類失敗'
      setTaxonomyError(message)
    }
  }

  const handleToggleCategoryStatus = async (category: ArticleCategory) => {
    try {
      setTaxonomyError(null)
      if (category.isActive === false) {
        await adminService.activateArticleCategory(category.id)
      } else {
        await adminService.deactivateArticleCategory(category.id)
      }
      await loadTaxonomyDefinitions()
    } catch (err) {
      const message = err instanceof AdminServiceError ? err.message : '更新分類狀態失敗'
      setTaxonomyError(message)
    }
  }

  const handleCreateTag = async () => {
    const name = newTagName.trim()
    if (!name) {
      setTaxonomyError('標籤名稱為必填項')
      return
    }
    try {
      setIsCreatingTag(true)
      setTaxonomyError(null)
      await adminService.createArticleTag(name, newTagDescription)
      setNewTagName('')
      setNewTagDescription('')
      await loadTaxonomyDefinitions()
    } catch (err) {
      const message = err instanceof AdminServiceError ? err.message : '新增標籤失敗'
      setTaxonomyError(message)
    } finally {
      setIsCreatingTag(false)
    }
  }

  const handleRenameTag = async (tag: ArticleTag) => {
    const nextName = window.prompt('請輸入新的標籤名稱', tag.name)
    if (nextName === null) return
    try {
      setTaxonomyError(null)
      await adminService.updateArticleTag(tag.id, { name: nextName })
      await loadTaxonomyDefinitions()
    } catch (err) {
      const message = err instanceof AdminServiceError ? err.message : '更新標籤失敗'
      setTaxonomyError(message)
    }
  }

  const handleToggleTagStatus = async (tag: ArticleTag) => {
    try {
      setTaxonomyError(null)
      if (tag.isActive === false) {
        await adminService.activateArticleTag(tag.id)
      } else {
        await adminService.deactivateArticleTag(tag.id)
      }
      await loadTaxonomyDefinitions()
    } catch (err) {
      const message = err instanceof AdminServiceError ? err.message : '更新標籤狀態失敗'
      setTaxonomyError(message)
    }
  }

  const loadArticleVersionHistory = async (articleId: string, forceReload: boolean = false) => {
    if (!forceReload && versionHistoryByArticleId[articleId]) return

    try {
      setLoadingVersionHistoryArticleId(articleId)
      setTaxonomyError(null)
      const revisions = await adminService.fetchArticleVersionHistory(articleId)
      setVersionHistoryByArticleId((prev) => ({
        ...prev,
        [articleId]: revisions,
      }))
    } catch (err) {
      const message = err instanceof AdminServiceError ? err.message : '無法載入版本紀錄'
      setTaxonomyError(message)
    } finally {
      setLoadingVersionHistoryArticleId((current) => (current === articleId ? null : current))
    }
  }

  const handleToggleVersionHistory = async (articleId: string) => {
    if (openVersionHistoryArticleId === articleId) {
      setOpenVersionHistoryArticleId(null)
      return
    }

    setOpenVersionHistoryArticleId(articleId)
    await loadArticleVersionHistory(articleId)
  }

  const handleRestoreRevision = async (articleId: string, revision: ArticleRevision) => {
    if (!revision.canRestore) {
      setTaxonomyError('此版本缺少可還原的快照資料。')
      return
    }

    const confirmed = window.confirm('確定要還原到此版本嗎？目前內容將被覆寫。')
    if (!confirmed) return

    try {
      setTaxonomyError(null)
      setSuccessMessage(null)
      setRestoringRevisionId(revision.id)
      const restoredArticle = await adminService.restoreArticleVersion(articleId, revision.id)
      setAllLoadedArticles((prev) =>
        prev.map((article) => (article.id === articleId ? restoredArticle : article))
      )
      await loadArticleVersionHistory(articleId, true)
      setSuccessMessage('已還原到所選版本')
    } catch (err) {
      const message = err instanceof AdminServiceError ? err.message : '還原版本失敗'
      setTaxonomyError(message)
    } finally {
      setRestoringRevisionId(null)
    }
  }

  const handleMoveToRecycleBin = async (article: AdminArticle) => {
    const confirmed = window.confirm(`確定要將「${article.title}」移至回收站嗎？`)
    if (!confirmed) return

    try {
      setTaxonomyError(null)
      setSuccessMessage(null)
      setDeletingArticleId(article.id)
      await adminService.deleteArticle(article.id)
      await Promise.all([loadArticles(), loadRecycleBin()])
      setSuccessMessage(`已將「${article.title}」移至回收站，${ARTICLE_RETENTION_LABEL}內可還原`)
    } catch (err) {
      const message = err instanceof AdminServiceError ? err.message : '移至回收站失敗'
      setTaxonomyError(message)
    } finally {
      setDeletingArticleId(null)
    }
  }

  const handleRestoreDeletedArticle = async (article: AdminRecycleBinArticle) => {
    const confirmed = window.confirm(`確定要還原「${article.title}」嗎？`)
    if (!confirmed) return

    try {
      setTaxonomyError(null)
      setSuccessMessage(null)
      setRestoringDeletedArticleId(article.id)
      await adminService.restoreDeletedArticle(article.id)
      await Promise.all([loadArticles(), loadRecycleBin()])
      setSuccessMessage(`已還原「${article.title}」`)
    } catch (err) {
      const message = err instanceof AdminServiceError ? err.message : '還原文章失敗'
      setTaxonomyError(message)
    } finally {
      setRestoringDeletedArticleId(null)
    }
  }

  const handlePurgeDeletedArticle = async (article: AdminRecycleBinArticle) => {
    const confirmed = window.confirm(
      `確定要永久刪除「${article.title}」嗎？此操作不可復原。`
    )
    if (!confirmed) return

    try {
      setTaxonomyError(null)
      setSuccessMessage(null)
      setPurgingArticleId(article.id)
      await adminService.purgeDeletedArticle(article.id)
      await loadRecycleBin()
      setSuccessMessage(`已永久刪除「${article.title}」`)
    } catch (err) {
      const message = err instanceof AdminServiceError ? err.message : '永久刪除失敗'
      setTaxonomyError(message)
    } finally {
      setPurgingArticleId(null)
    }
  }

  const listDescription = selectedNewsletterId
    ? hasActiveFilters
      ? `符合條件 ${articles.length} 篇（本期共 ${allLoadedArticles.length} 篇）`
      : `本期共 ${articles.length} 篇文章`
    : hasActiveFilters
      ? `符合條件 ${articles.length} 篇`
      : `共 ${articles.length} 篇文章`

  return (
    <ErrorBoundary>
      <AdminLayout
        activeTab="articles"
        contentVariant="plain"
        title="文章管理"
        description="搜尋、篩選所有文章；直接編輯內容、整理分類與標籤，或管理回收站。"
      >
        <div className="space-y-6">
          {/* Scope + filters */}
          <section className={`${cardClass} p-6`}>
            <div className="flex flex-wrap items-end gap-3">
              <div className="min-w-[260px] flex-1">
                <label htmlFor="newsletter-filter" className={labelClass}>
                  依電子報篩選
                </label>
                <select
                  id="newsletter-filter"
                  value={selectedNewsletterId}
                  onChange={(event) => handleSelectNewsletter(event.target.value)}
                  className={inputClass}
                >
                  <option value="">{showTemplateOnly ? '全部模板電子報' : '全部電子報'}</option>
                  {selectableNewsletters.map((newsletter) => (
                    <option key={newsletter.id} value={newsletter.id}>
                      {newsletter.weekNumber || newsletter.title || newsletter.id}
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="button"
                onClick={handleToggleTemplateMode}
                className="shrink-0 rounded-lg border border-waldorf-cream-300 bg-white px-4 py-2 text-sm font-medium text-waldorf-clay-700 transition-colors hover:bg-waldorf-cream-50"
              >
                {showTemplateOnly ? '返回一般文章列表' : '模板文章列表'}
              </button>
            </div>

            {selectedNewsletterId && (
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-waldorf-peach-200 bg-waldorf-peach-50/60 px-4 py-3">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="text-waldorf-clay-500">目前檢視</span>
                  <span className="font-semibold text-waldorf-clay-800">{selectedNewsletterLabel}</span>
                  {selectedNewsletter && (
                    <span className="rounded-full bg-white px-2 py-0.5 text-xs font-medium text-waldorf-clay-600">
                      {getNewsletterStatusLabel(selectedNewsletter.status)}
                    </span>
                  )}
                  {selectedNewsletter?.isTemplate && (
                    <span className="rounded-full border border-waldorf-peach-200 bg-white px-2 py-0.5 text-xs font-medium text-waldorf-peach-700">
                      模板
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-4 text-sm">
                  {selectedNewsletter && (
                    <Link
                      to={getAdminNewsletterPath(selectedNewsletter)}
                      className="font-medium text-waldorf-peach-700 hover:text-waldorf-peach-800"
                    >
                      前往電子報編排 →
                    </Link>
                  )}
                  <button
                    type="button"
                    onClick={() => handleSelectNewsletter('')}
                    className="font-medium text-waldorf-clay-600 hover:text-waldorf-clay-800"
                  >
                    顯示全部文章
                  </button>
                </div>
              </div>
            )}

            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-6">
              <div className="xl:col-span-2">
                <label htmlFor="article-search" className={labelClass}>
                  搜尋文章
                </label>
                <input
                  id="article-search"
                  aria-label="搜尋文章"
                  type="search"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="依標題、內容、標籤或電子報搜尋"
                  className={inputClass}
                />
              </div>

              <div>
                <label htmlFor="article-status-filter" className={labelClass}>
                  文章狀態
                </label>
                <select
                  id="article-status-filter"
                  aria-label="依狀態篩選"
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value as ArticleStatusFilter)}
                  className={inputClass}
                >
                  <option value="all">全部狀態</option>
                  <option value="draft">草稿</option>
                  <option value="published">已發布</option>
                </select>
              </div>

              <div>
                <label htmlFor="article-class-filter" className={labelClass}>
                  班級
                </label>
                <select
                  id="article-class-filter"
                  aria-label="依班級篩選"
                  value={classFilter}
                  onChange={(event) => setClassFilter(event.target.value)}
                  className={inputClass}
                >
                  <option value="all">全部班級</option>
                  {activeClasses.map((classInfo) => (
                    <option key={classInfo.id} value={classInfo.id}>
                      {classInfo.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="article-tag-filter" className={labelClass}>
                  標籤
                </label>
                <select
                  id="article-tag-filter"
                  aria-label="依標籤篩選"
                  value={tagFilter}
                  onChange={(event) => setTagFilter(event.target.value)}
                  className={inputClass}
                >
                  <option value="all">全部標籤</option>
                  {activeTags.map((tag) => (
                    <option key={tag.id} value={tag.id}>
                      {tag.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="article-sort" className={labelClass}>
                  排序
                </label>
                <select
                  id="article-sort"
                  aria-label="排序文章"
                  value={sortOption}
                  onChange={(event) => setSortOption(event.target.value as ArticleSortOption)}
                  className={inputClass}
                >
                  {selectedNewsletterId && <option value="order_asc">電子報順序</option>}
                  <option value="updated_desc">最近更新優先</option>
                  <option value="updated_asc">最早更新優先</option>
                  <option value="title_asc">標題 A-Z</option>
                  <option value="title_desc">標題 Z-A</option>
                </select>
              </div>
            </div>

            {hasActiveFilters && (
              <div className="mt-3 flex justify-end">
                <button
                  type="button"
                  onClick={handleClearFilters}
                  className="text-sm font-medium text-waldorf-clay-600 hover:text-waldorf-clay-800"
                >
                  清除篩選條件
                </button>
              </div>
            )}
          </section>

          {successMessage && (
            <div
              role="status"
              className="flex items-start gap-3 rounded-xl border border-waldorf-sage-200 bg-waldorf-sage-50 p-4 text-sm font-medium text-waldorf-sage-700"
            >
              <svg className="mt-0.5 h-4 w-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="flex-1">{successMessage}</span>
              <button
                type="button"
                onClick={() => setSuccessMessage(null)}
                aria-label="關閉訊息"
                className="text-waldorf-sage-600 hover:text-waldorf-sage-800"
              >
                ×
              </button>
            </div>
          )}

          {(error || taxonomyError) && (
            <div
              role="alert"
              className="rounded-xl border border-waldorf-rose-200 bg-waldorf-rose-50 p-4 text-sm font-medium text-waldorf-rose-700"
            >
              {error || taxonomyError}
            </div>
          )}

          {selectedNewsletterId && (
            <PdfArticleImport
              key={selectedNewsletterId}
              newsletterId={selectedNewsletterId}
              onCreated={articleId => {
                const newsletter = newsletters.find(item => item.id === selectedNewsletterId)
                navigate(`${generateWeeklyUrl(newsletter?.weekNumber || selectedNewsletterId)}?admin=1`, {
                  state: { focusArticleId: articleId, startInEditMode: true },
                })
              }}
            />
          )}

          {/* Article list */}
          <section className={`${cardClass} overflow-hidden`}>
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-waldorf-cream-200 px-6 py-4">
              <div>
                <h2 className="font-display text-2xl font-semibold text-waldorf-clay-800">文章列表</h2>
                <p className="mt-1 text-sm text-waldorf-clay-500">{listDescription}</p>
              </div>
              {selectedNewsletterId ? (
                <button
                  type="button"
                  onClick={() => {
                    void handleCreateDraftArticle()
                  }}
                  disabled={isCreatingArticle}
                  className="inline-flex items-center gap-2 rounded-xl bg-waldorf-sage-500 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-waldorf-sage-600 disabled:opacity-50"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  {isCreatingArticle ? '建立中...' : '建立草稿文章'}
                </button>
              ) : (
                <p className="text-xs text-waldorf-clay-400">選擇一份電子報後即可在此建立草稿文章</p>
              )}
            </div>

            {isLoading ? (
              <div className="p-8">
                <LoadingSpinner />
              </div>
            ) : articles.length === 0 ? (
              <div className="px-6 py-12 text-center">
                <p className="font-medium text-waldorf-clay-600">
                  {hasActiveFilters ? '找不到符合條件的文章。' : '目前沒有文章。'}
                </p>
                {hasActiveFilters && (
                  <button
                    type="button"
                    onClick={handleClearFilters}
                    className="mt-2 text-sm font-medium text-waldorf-peach-600 hover:text-waldorf-peach-700"
                  >
                    清除篩選條件
                  </button>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-waldorf-cream-200">
                  <thead className="bg-waldorf-cream-50">
                    <tr>
                      <th className={thClass}>標題</th>
                      <th className={thClass}>狀態</th>
                      <th className={thClass}>所屬電子報</th>
                      <th className={thClass}>分類</th>
                      <th className={thClass}>標籤</th>
                      <th className={thClass}>更新時間</th>
                      <th className={`${thClass} text-right`}>操作</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-waldorf-cream-100 bg-white">
                    {articles.map((article) => {
                      const memberships = membershipsByArticleId[article.id] || []
                      const hasTemplateMembership = memberships.some((membership) => membership.isTemplate)
                      const assignment = getArticleAssignment(article.id)
                      const categoryNames = assignment.categoryIds.map(getCategoryNameById)
                      const tagNames = assignment.tagIds.map(getTagNameById)
                      const draft = assignmentDrafts[article.id] || assignment
                      const canEdit = getEditorTarget(article) !== null
                      const isBusy =
                        publishingArticleId === article.id ||
                        deletingArticleId === article.id || removingArticleId === article.id

                      return (
                        <Fragment key={article.id}>
                          <tr
                            data-testid={`article-row-${article.id}`}
                            className="align-top transition-colors hover:bg-waldorf-cream-50/40"
                          >
                            <td className="px-6 py-4 text-sm">
                              <div className="flex items-start gap-2">
                                {selectedNewsletterId && sortOption === 'order_asc' && (
                                  <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-waldorf-cream-100 text-xs font-semibold text-waldorf-clay-600">
                                    {article.order}
                                  </span>
                                )}
                                <div className="min-w-0">
                                  <button
                                    type="button"
                                    onClick={() => canEdit ? handleEditArticle(article) : navigate(`/admin/article/${article.id}/edit`)}
                                    disabled={isBusy}
                                    className="text-left font-medium text-waldorf-clay-800 hover:text-waldorf-peach-700 disabled:cursor-default disabled:hover:text-waldorf-clay-800"
                                  >
                                    {article.title}
                                  </button>
                                  {hasTemplateMembership && (
                                    <span className="ml-2 inline-flex rounded-full border border-waldorf-peach-200 bg-waldorf-peach-50 px-2 py-0.5 text-[11px] font-medium text-waldorf-peach-700">
                                      模板
                                    </span>
                                  )}
                                  {article.summary && (
                                    <p className="mt-0.5 line-clamp-1 text-xs text-waldorf-clay-500">{article.summary}</p>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4 text-sm">
                              <span
                                className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ${getArticleStatusClass(article.status)}`}
                              >
                                {getArticleStatusLabel(article.status)}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-sm text-waldorf-clay-600">
                              {memberships.length === 0 ? (
                                <span className="text-waldorf-clay-400">未加入電子報</span>
                              ) : (
                                <div className="flex flex-wrap gap-2">
                                  {memberships.map((membership) => (
                                    <button
                                      key={`${article.id}-${membership.newsletterId}`}
                                      type="button"
                                      onClick={() => handleSelectNewsletter(membership.newsletterId)}
                                      title="只顯示這份電子報的文章"
                                      className={`whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
                                        selectedNewsletterId === membership.newsletterId
                                          ? 'border-waldorf-peach-500 bg-waldorf-peach-100 text-waldorf-peach-700'
                                          : 'border-waldorf-cream-300 bg-waldorf-cream-50 text-waldorf-clay-700 hover:bg-waldorf-cream-100'
                                      }`}
                                    >
                                      {membership.label}
                                    </button>
                                  ))}
                                </div>
                              )}
                            </td>
                            <td className="px-6 py-4 text-sm text-waldorf-clay-600">
                              {categoryNames.length === 0 ? (
                                <span className="text-waldorf-clay-400">未設定</span>
                              ) : (
                                <div className="flex flex-wrap gap-2">
                                  {categoryNames.map((name) => (
                                    <span
                                      key={`${article.id}-category-${name}`}
                                      className="whitespace-nowrap rounded-full border border-waldorf-sage-200 bg-waldorf-sage-50 px-2.5 py-1 text-xs font-medium text-waldorf-sage-700"
                                    >
                                      {name}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </td>
                            <td className="px-6 py-4 text-sm text-waldorf-clay-600">
                              {tagNames.length === 0 ? (
                                <span className="text-waldorf-clay-400">未設定</span>
                              ) : (
                                <div className="flex flex-wrap gap-2">
                                  {tagNames.map((name) => (
                                    <span
                                      key={`${article.id}-tag-${name}`}
                                      className="whitespace-nowrap rounded-full border border-waldorf-lavender-200 bg-waldorf-lavender-50 px-2.5 py-1 text-xs font-medium text-waldorf-lavender-700"
                                    >
                                      {name}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </td>
                            <td className="whitespace-nowrap px-6 py-4 text-sm text-waldorf-clay-500">
                              {new Date(article.updatedAt).toLocaleString('zh-TW')}
                            </td>
                            <td className="px-6 py-4 text-right text-sm">
                              <div className="flex flex-wrap justify-end gap-x-3 gap-y-1.5">
                                <button type="button" disabled={isBusy || isCreatingArticle}
                                  onClick={() => void handleCopyArticle(article, false)} className={rowActionClass}>複製為草稿</button>
                                {(membershipsByArticleId[article.id] ?? []).some(m => m.isTemplate) && (
                                  <button type="button" disabled={isBusy || isCreatingArticle}
                                    onClick={() => void handleCopyArticle(article, true)} className={rowActionClass}>從範本建立草稿</button>
                                )}
                                {article.status === 'draft' && !showTemplateOnly && (
                                  <button type="button" onClick={() => void handlePublishArticle(article)}
                                    disabled={isBusy || publishingArticleId !== null}
                                    className={`${rowActionClass} text-waldorf-sage-600 hover:text-waldorf-sage-700`}>
                                    {publishingArticleId === article.id ? '發布中...' : '發布'}
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={() => canEdit ? handleEditArticle(article) : navigate(`/admin/article/${article.id}/edit`)}
                                  disabled={isBusy}
                                  className={`${rowActionClass} text-waldorf-peach-600 hover:text-waldorf-peach-700`}
                                >
                                  編輯文章
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    editingArticleId === article.id
                                      ? closeAssignmentEditor()
                                      : openAssignmentEditor(article.id)
                                  }
                                  disabled={isBusy}
                                  className={`${rowActionClass} text-waldorf-clay-600 hover:text-waldorf-clay-800`}
                                >
                                  {editingArticleId === article.id ? '關閉' : '編輯分類/標籤'}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    void handleToggleVersionHistory(article.id)
                                  }}
                                  disabled={isBusy}
                                  className={`${rowActionClass} text-waldorf-lavender-700 hover:text-waldorf-lavender-800`}
                                >
                                  {openVersionHistoryArticleId === article.id ? '隱藏版本' : '版本紀錄'}
                                </button>
                                {selectedNewsletterId && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      void handleRemoveFromNewsletter(article)
                                    }}
                                    disabled={isBusy}
                                    title="只從這份電子報移除，文章本身會保留"
                                    className={`${rowActionClass} text-waldorf-clay-600 hover:text-waldorf-clay-800`}
                                  >
                                    {removingArticleId === article.id ? '移除中...' : '從電子報移除'}
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={() => {
                                    void handleMoveToRecycleBin(article)
                                  }}
                                  disabled={isBusy}
                                  className={`${rowActionClass} text-waldorf-rose-600 hover:text-waldorf-rose-700`}
                                >
                                  {deletingArticleId === article.id ? '移除中...' : '移至回收站'}
                                </button>
                              </div>
                            </td>
                          </tr>

                          {editingArticleId === article.id && (
                            <tr>
                              <td colSpan={7} className="bg-waldorf-cream-50 px-6 py-4">
                                <div className="grid gap-4 md:grid-cols-2">
                                  <div className="rounded-lg border border-waldorf-cream-200 bg-white p-3">
                                    <h4 className="text-sm font-semibold text-waldorf-clay-700">分類指派</h4>
                                    {activeCategories.length === 0 ? (
                                      <p className="mt-2 text-xs text-waldorf-clay-500">
                                        尚無可用分類，請先在下方「分類與標籤管理」建立。
                                      </p>
                                    ) : (
                                      <div className="mt-2 max-h-40 space-y-1 overflow-y-auto">
                                        {activeCategories.map((category) => (
                                          <label key={category.id} className="flex items-center gap-2 text-sm text-waldorf-clay-700">
                                            <input
                                              type="checkbox"
                                              checked={draft.categoryIds.includes(category.id)}
                                              onChange={() => toggleCategoryDraft(article.id, category.id)}
                                            />
                                            {category.name}
                                          </label>
                                        ))}
                                      </div>
                                    )}
                                  </div>

                                  <div className="rounded-lg border border-waldorf-cream-200 bg-white p-3">
                                    <h4 className="text-sm font-semibold text-waldorf-clay-700">標籤指派</h4>
                                    {activeTags.length === 0 ? (
                                      <p className="mt-2 text-xs text-waldorf-clay-500">
                                        尚無可用標籤，請先在下方「分類與標籤管理」建立。
                                      </p>
                                    ) : (
                                      <div className="mt-2 max-h-40 space-y-1 overflow-y-auto">
                                        {activeTags.map((tag) => (
                                          <label key={tag.id} className="flex items-center gap-2 text-sm text-waldorf-clay-700">
                                            <input
                                              type="checkbox"
                                              checked={draft.tagIds.includes(tag.id)}
                                              onChange={() => toggleTagDraft(article.id, tag.id)}
                                            />
                                            {tag.name}
                                          </label>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                </div>

                                <div className="mt-4 flex justify-end gap-2">
                                  <button
                                    type="button"
                                    onClick={closeAssignmentEditor}
                                    className="rounded-lg border border-waldorf-cream-300 bg-white px-3 py-1.5 text-xs font-medium text-waldorf-clay-700 hover:bg-waldorf-cream-100"
                                  >
                                    取消
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleSaveAssignments(article.id)}
                                    disabled={savingAssignmentArticleId === article.id || isTaxonomyLoading}
                                    className="rounded-lg border border-waldorf-sage-300 bg-waldorf-sage-50 px-3 py-1.5 text-xs font-medium text-waldorf-sage-700 hover:bg-waldorf-sage-100 disabled:opacity-60"
                                  >
                                    {savingAssignmentArticleId === article.id ? '儲存中...' : '儲存指派'}
                                  </button>
                                </div>
                              </td>
                            </tr>
                          )}

                          {openVersionHistoryArticleId === article.id && (
                            <tr>
                              <td colSpan={7} className="bg-waldorf-lavender-50 px-6 py-4">
                                <div className="space-y-3">
                                  <div className="flex items-center justify-between">
                                    <h4 className="text-sm font-semibold text-waldorf-clay-700">版本紀錄</h4>
                                    {loadingVersionHistoryArticleId === article.id && (
                                      <span className="text-xs text-waldorf-clay-500">載入中...</span>
                                    )}
                                  </div>

                                  {loadingVersionHistoryArticleId === article.id ? (
                                    <p className="text-sm text-waldorf-clay-500">正在載入版本紀錄...</p>
                                  ) : (versionHistoryByArticleId[article.id] || []).length === 0 ? (
                                    <p className="text-sm text-waldorf-clay-500">目前沒有可顯示的版本紀錄。</p>
                                  ) : (
                                    <div className="space-y-3">
                                      {(versionHistoryByArticleId[article.id] || []).map((revision) => (
                                        <div
                                          key={revision.id}
                                          className="rounded-lg border border-waldorf-lavender-200 bg-white p-3"
                                        >
                                          <div className="flex flex-wrap items-start justify-between gap-3">
                                            <div>
                                              <p className="text-sm font-semibold text-waldorf-clay-700">
                                                {revision.changeSummary}
                                              </p>
                                              <p className="text-xs text-waldorf-clay-500">
                                                {new Date(revision.changedAt).toLocaleString('zh-TW')}
                                                {revision.changedBy ? ` · ${revision.changedBy}` : ''}
                                              </p>
                                            </div>
                                            <button
                                              type="button"
                                              onClick={() => {
                                                void handleRestoreRevision(article.id, revision)
                                              }}
                                              disabled={!revision.canRestore || restoringRevisionId === revision.id}
                                              className="rounded-lg border border-waldorf-peach-300 bg-waldorf-peach-50 px-3 py-1.5 text-xs font-medium text-waldorf-peach-700 hover:bg-waldorf-peach-100 disabled:opacity-50"
                                            >
                                              {restoringRevisionId === revision.id ? '還原中...' : '還原此版本'}
                                            </button>
                                          </div>

                                          {revision.fieldDiffs.length > 0 && (
                                            <div className="mt-3 space-y-1">
                                              {revision.fieldDiffs.slice(0, 4).map((diff) => (
                                                <p key={`${revision.id}-${diff.field}`} className="text-xs text-waldorf-clay-600">
                                                  <span className="font-medium">{diff.label}：</span>
                                                  {diff.before} → {diff.after}
                                                </p>
                                              ))}
                                              {revision.fieldDiffs.length > 4 && (
                                                <p className="text-xs text-waldorf-clay-500">
                                                  還有 {revision.fieldDiffs.length - 4} 項欄位變更...
                                                </p>
                                              )}
                                            </div>
                                          )}
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* Taxonomy definitions (collapsed so the article list stays in focus) */}
          <details className={`group ${cardClass}`}>
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-6 py-4 [&::-webkit-details-marker]:hidden">
              <div>
                <h2 className="font-display text-xl font-semibold text-waldorf-clay-800">分類與標籤管理</h2>
                <p className="mt-0.5 text-sm text-waldorf-clay-500">
                  {activeCategories.length} 個分類、{activeTags.length} 個標籤可供指派。新增、重新命名或停用後，文章列表會即時更新。
                </p>
              </div>
              <span className="inline-flex shrink-0 items-center gap-2 text-sm font-medium text-waldorf-peach-600">
                <span className="group-open:hidden">展開管理</span>
                <span className="hidden group-open:inline">收合</span>
                <svg className="h-4 w-4 transition-transform group-open:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </span>
            </summary>

            <div className="grid gap-6 border-t border-waldorf-cream-200 p-6 lg:grid-cols-2">
              <div className="space-y-4 rounded-lg border border-waldorf-cream-200 p-4">
                <h3 className="text-lg font-semibold text-waldorf-clay-800">分類</h3>
                <div className="space-y-2">
                  <input
                    type="text"
                    value={newCategoryName}
                    onChange={(event) => setNewCategoryName(event.target.value)}
                    placeholder="新增分類名稱"
                    className={inputClass}
                  />
                  <input
                    type="text"
                    value={newCategoryDescription}
                    onChange={(event) => setNewCategoryDescription(event.target.value)}
                    placeholder="分類描述（選填）"
                    className={inputClass}
                  />
                  <button
                    type="button"
                    onClick={handleCreateCategory}
                    disabled={isCreatingCategory}
                    className="rounded-lg border border-waldorf-sage-300 bg-waldorf-sage-50 px-3 py-2 text-sm font-medium text-waldorf-sage-700 hover:bg-waldorf-sage-100 disabled:opacity-60"
                  >
                    {isCreatingCategory ? '新增中...' : '新增分類'}
                  </button>
                </div>

                {categories.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-waldorf-cream-300 px-3 py-4 text-sm text-waldorf-clay-500">
                    尚無分類，請先建立分類。
                  </div>
                ) : (
                  <div className="space-y-2">
                    {categories.map((category) => (
                      <div
                        key={category.id}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-waldorf-cream-200 bg-waldorf-cream-50 px-3 py-2"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-waldorf-clay-700">{category.name}</span>
                          <span
                            className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                              category.isActive === false
                                ? 'bg-waldorf-rose-100 text-waldorf-rose-700'
                                : 'bg-waldorf-sage-100 text-waldorf-sage-700'
                            }`}
                          >
                            {category.isActive === false ? '停用' : '啟用'}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleRenameCategory(category)}
                            className="text-xs font-medium text-waldorf-clay-600 hover:text-waldorf-clay-800"
                          >
                            編輯
                          </button>
                          <button
                            type="button"
                            onClick={() => handleToggleCategoryStatus(category)}
                            className="text-xs font-medium text-waldorf-peach-600 hover:text-waldorf-peach-700"
                          >
                            {category.isActive === false ? '啟用' : '停用'}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-4 rounded-lg border border-waldorf-cream-200 p-4">
                <h3 className="text-lg font-semibold text-waldorf-clay-800">標籤</h3>
                <div className="space-y-2">
                  <input
                    type="text"
                    value={newTagName}
                    onChange={(event) => setNewTagName(event.target.value)}
                    placeholder="新增標籤名稱"
                    className={inputClass}
                  />
                  <input
                    type="text"
                    value={newTagDescription}
                    onChange={(event) => setNewTagDescription(event.target.value)}
                    placeholder="標籤描述（選填）"
                    className={inputClass}
                  />
                  <button
                    type="button"
                    onClick={handleCreateTag}
                    disabled={isCreatingTag}
                    className="rounded-lg border border-waldorf-sage-300 bg-waldorf-sage-50 px-3 py-2 text-sm font-medium text-waldorf-sage-700 hover:bg-waldorf-sage-100 disabled:opacity-60"
                  >
                    {isCreatingTag ? '新增中...' : '新增標籤'}
                  </button>
                </div>

                {tags.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-waldorf-cream-300 px-3 py-4 text-sm text-waldorf-clay-500">
                    尚無標籤，請先建立標籤。
                  </div>
                ) : (
                  <div className="space-y-2">
                    {tags.map((tag) => (
                      <div
                        key={tag.id}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-waldorf-cream-200 bg-waldorf-cream-50 px-3 py-2"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-waldorf-clay-700">{tag.name}</span>
                          <span
                            className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                              tag.isActive === false
                                ? 'bg-waldorf-rose-100 text-waldorf-rose-700'
                                : 'bg-waldorf-sage-100 text-waldorf-sage-700'
                            }`}
                          >
                            {tag.isActive === false ? '停用' : '啟用'}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleRenameTag(tag)}
                            className="text-xs font-medium text-waldorf-clay-600 hover:text-waldorf-clay-800"
                          >
                            編輯
                          </button>
                          <button
                            type="button"
                            onClick={() => handleToggleTagStatus(tag)}
                            className="text-xs font-medium text-waldorf-peach-600 hover:text-waldorf-peach-700"
                          >
                            {tag.isActive === false ? '啟用' : '停用'}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </details>

          {/* Recycle bin (collapsed unless there is something to act on) */}
          <details className={`group ${cardClass}`} open={recycleBinArticles.length > 0}>
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-6 py-4 [&::-webkit-details-marker]:hidden">
              <div>
                <h2 className="font-display text-xl font-semibold text-waldorf-clay-800">內容回收站</h2>
                <p className="mt-0.5 text-sm text-waldorf-clay-500">
                  已刪除 {recycleBinArticles.length} 篇文章（預設保留 {ARTICLE_RETENTION_LABEL}，期間內可還原）
                </p>
              </div>
              <span className="inline-flex shrink-0 items-center gap-2 text-sm font-medium text-waldorf-peach-600">
                <span className="group-open:hidden">展開</span>
                <span className="hidden group-open:inline">收合</span>
                <svg className="h-4 w-4 transition-transform group-open:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </span>
            </summary>

            <div className="border-t border-waldorf-cream-200">
              {isRecycleBinLoading ? (
                <div className="p-8">
                  <LoadingSpinner />
                </div>
              ) : recycleBinArticles.length === 0 ? (
                <div className="p-8 text-center text-waldorf-clay-500">目前回收站沒有文章。</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-waldorf-cream-200">
                    <thead className="bg-waldorf-cream-50">
                      <tr>
                        <th className={thClass}>標題</th>
                        <th className={thClass}>刪除時間</th>
                        <th className={thClass}>預計清除</th>
                        <th className={thClass}>參照電子報</th>
                        <th className={`${thClass} text-right`}>操作</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-waldorf-cream-100 bg-white">
                      {recycleBinArticles.map((article) => (
                        <tr key={`recycle-${article.id}`}>
                          <td className="px-6 py-4 text-sm font-medium text-waldorf-clay-800">{article.title}</td>
                          <td className="px-6 py-4 text-sm text-waldorf-clay-600">
                            {formatDateTime(article.deletedAt)}
                          </td>
                          <td className="px-6 py-4 text-sm text-waldorf-clay-600">
                            {formatDateTime(article.purgeScheduledAt)}
                          </td>
                          <td className="px-6 py-4 text-sm text-waldorf-clay-600">
                            {article.memberships.length === 0 ? (
                              <span className="text-waldorf-sage-700">無，可永久刪除</span>
                            ) : (
                              <div className="flex flex-wrap gap-2">
                                {article.memberships.map((membership) => (
                                  <span
                                    key={`${article.id}-${membership.newsletterId}`}
                                    className="whitespace-nowrap rounded-full border border-waldorf-peach-200 bg-waldorf-peach-50 px-2.5 py-1 text-xs font-medium text-waldorf-peach-700"
                                  >
                                    {membership.label}
                                  </span>
                                ))}
                              </div>
                            )}
                          </td>
                          <td className="px-6 py-4 text-right text-sm">
                            <div className="flex justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  void handleRestoreDeletedArticle(article)
                                }}
                                disabled={restoringDeletedArticleId === article.id}
                                className="rounded-lg border border-waldorf-sage-300 bg-waldorf-sage-50 px-3 py-1.5 text-xs font-medium text-waldorf-sage-700 hover:bg-waldorf-sage-100 disabled:opacity-60"
                              >
                                {restoringDeletedArticleId === article.id ? '還原中...' : '還原'}
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  void handlePurgeDeletedArticle(article)
                                }}
                                disabled={!article.canPurge || purgingArticleId === article.id}
                                title={article.canPurge ? undefined : '仍有電子報參照此文章，無法永久刪除'}
                                className="rounded-lg border border-waldorf-rose-300 bg-waldorf-rose-50 px-3 py-1.5 text-xs font-medium text-waldorf-rose-700 hover:bg-waldorf-rose-100 disabled:opacity-60"
                              >
                                {purgingArticleId === article.id ? '刪除中...' : '永久刪除'}
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </details>
        </div>
      </AdminLayout>
    </ErrorBoundary>
  )
}

export default AdminArticlesPage
