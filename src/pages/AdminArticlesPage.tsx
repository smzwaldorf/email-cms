import { Fragment, useEffect, useMemo, useState } from 'react'
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
import { useSearchParams } from 'react-router-dom'

type ArticleStatusFilter = 'all' | 'draft' | 'published'
type ArticleSortOption = 'updated_desc' | 'updated_asc' | 'title_asc' | 'title_desc'
const ARTICLE_RETENTION_LABEL = '30 天'

export function AdminArticlesPage() {
  const [searchParams, setSearchParams] = useSearchParams()
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
  const [sortOption, setSortOption] = useState<ArticleSortOption>(() => {
    const sort = searchParams.get('sort')
    if (sort === 'updated_asc' || sort === 'title_asc' || sort === 'title_desc') return sort
    return 'updated_desc'
  })
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [taxonomyError, setTaxonomyError] = useState<string | null>(null)
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

  const selectedNewsletterLabel = useMemo(() => {
    if (showTemplateOnly) return '模板文章列表'
    if (!selectedNewsletterId) return '全部電子報'
    const selected = newsletters.find((newsletter) => newsletter.id === selectedNewsletterId)
    if (!selected) return '未知電子報'
    return selected.weekNumber || selected.title || selected.id
  }, [newsletters, selectedNewsletterId, showTemplateOnly])

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

  useEffect(() => {
    const nextParams = new URLSearchParams()
    if (selectedNewsletterId) nextParams.set('newsletter', selectedNewsletterId)
    if (showTemplateOnly) nextParams.set('templateOnly', '1')
    if (searchQuery.trim()) nextParams.set('q', searchQuery.trim())
    if (statusFilter !== 'all') nextParams.set('status', statusFilter)
    if (classFilter !== 'all') nextParams.set('classId', classFilter)
    if (tagFilter !== 'all') nextParams.set('tagId', tagFilter)
    if (sortOption !== 'updated_desc') nextParams.set('sort', sortOption)

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
    const filtered = allLoadedArticles.filter((article) => {
      if (selectedNewsletterId) return true
      const memberships = membershipsByArticleId[article.id] || []
      const isTemplateArticle = memberships.some((membership) => membership.isTemplate)
      if (showTemplateOnly && !isTemplateArticle) return false
      if (!showTemplateOnly && isTemplateArticle) return false

      const normalizedSearch = searchQuery.trim().toLowerCase()
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
      await adminService.updateArticleTaxonomyAssignments(articleId, draft)
      setTaxonomyByArticleId((prev) => ({
        ...prev,
        [articleId]: {
          categoryIds: [...draft.categoryIds],
          tagIds: [...draft.tagIds],
        },
      }))
      setEditingArticleId(null)
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
      setRestoringRevisionId(revision.id)
      const restoredArticle = await adminService.restoreArticleVersion(articleId, revision.id)
      setAllLoadedArticles((prev) =>
        prev.map((article) => (article.id === articleId ? restoredArticle : article))
      )
      await loadArticleVersionHistory(articleId, true)
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
      setDeletingArticleId(article.id)
      await adminService.deleteArticle(article.id)
      await Promise.all([loadArticles(), loadRecycleBin()])
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
      setRestoringDeletedArticleId(article.id)
      await adminService.restoreDeletedArticle(article.id)
      await Promise.all([loadArticles(), loadRecycleBin()])
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
      setPurgingArticleId(article.id)
      await adminService.purgeDeletedArticle(article.id)
      await loadRecycleBin()
    } catch (err) {
      const message = err instanceof AdminServiceError ? err.message : '永久刪除失敗'
      setTaxonomyError(message)
    } finally {
      setPurgingArticleId(null)
    }
  }

  return (
    <ErrorBoundary>
      <AdminLayout activeTab="articles">
        <div className="space-y-6">
          <div className="rounded-xl border border-waldorf-cream-200 bg-white p-6 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="font-display text-2xl font-semibold text-waldorf-clay-800">文章分類與標籤管理</h2>
                <p className="mt-1 text-sm text-waldorf-clay-500">
                  新增、編輯、停用分類與標籤，並在文章列表中進行綁定。
                </p>
              </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <div className="space-y-4 rounded-lg border border-waldorf-cream-200 p-4">
                <h3 className="text-lg font-semibold text-waldorf-clay-800">分類</h3>
                <div className="space-y-2">
                  <input
                    type="text"
                    value={newCategoryName}
                    onChange={(event) => setNewCategoryName(event.target.value)}
                    placeholder="新增分類名稱"
                    className="w-full rounded-lg border border-waldorf-cream-300 px-3 py-2 text-sm text-waldorf-clay-700"
                  />
                  <input
                    type="text"
                    value={newCategoryDescription}
                    onChange={(event) => setNewCategoryDescription(event.target.value)}
                    placeholder="分類描述（選填）"
                    className="w-full rounded-lg border border-waldorf-cream-300 px-3 py-2 text-sm text-waldorf-clay-700"
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
                    className="w-full rounded-lg border border-waldorf-cream-300 px-3 py-2 text-sm text-waldorf-clay-700"
                  />
                  <input
                    type="text"
                    value={newTagDescription}
                    onChange={(event) => setNewTagDescription(event.target.value)}
                    placeholder="標籤描述（選填）"
                    className="w-full rounded-lg border border-waldorf-cream-300 px-3 py-2 text-sm text-waldorf-clay-700"
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
          </div>

          <div className="rounded-xl border border-waldorf-cream-200 bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div className="min-w-[280px]">
                <label htmlFor="newsletter-filter" className="mb-2 block text-sm font-semibold text-waldorf-clay-700">
                  依電子報篩選
                </label>
                <div className="flex items-center gap-3">
                  <select
                    id="newsletter-filter"
                    value={selectedNewsletterId}
                    onChange={(event) => setSelectedNewsletterId(event.target.value)}
                    className="w-full rounded-lg border border-waldorf-cream-300 bg-white px-4 py-2.5 text-waldorf-clay-700"
                  >
                    <option value="">{showTemplateOnly ? '全部模板電子報' : '全部電子報'}</option>
                    {selectableNewsletters.map((newsletter) => (
                      <option key={newsletter.id} value={newsletter.id}>
                        {newsletter.weekNumber || newsletter.title || newsletter.id}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedNewsletterId('')
                      setShowTemplateOnly((prev) => !prev)
                    }}
                    className="shrink-0 rounded-lg border border-waldorf-cream-300 bg-white px-4 py-2.5 text-sm font-medium text-waldorf-clay-700 transition-colors hover:bg-waldorf-cream-50"
                  >
                    {showTemplateOnly ? '返回一般文章列表' : '模板文章列表'}
                  </button>
                </div>
              </div>

              <div className="text-sm text-waldorf-clay-600">
                目前篩選: <span className="font-medium">{selectedNewsletterLabel}</span>
              </div>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
              <div className="xl:col-span-2">
                <label htmlFor="article-search" className="mb-2 block text-sm font-semibold text-waldorf-clay-700">
                  搜尋文章
                </label>
                <input
                  id="article-search"
                  aria-label="搜尋文章"
                  type="search"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="依標題、內容、標籤或電子報搜尋"
                  className="w-full rounded-lg border border-waldorf-cream-300 bg-white px-4 py-2.5 text-waldorf-clay-700"
                />
              </div>

              <div>
                <label htmlFor="article-status-filter" className="mb-2 block text-sm font-semibold text-waldorf-clay-700">
                  文章狀態
                </label>
                <select
                  id="article-status-filter"
                  aria-label="依狀態篩選"
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value as ArticleStatusFilter)}
                  className="w-full rounded-lg border border-waldorf-cream-300 bg-white px-4 py-2.5 text-waldorf-clay-700"
                >
                  <option value="all">全部狀態</option>
                  <option value="draft">草稿</option>
                  <option value="published">已發布</option>
                </select>
              </div>

              <div>
                <label htmlFor="article-class-filter" className="mb-2 block text-sm font-semibold text-waldorf-clay-700">
                  班級
                </label>
                <select
                  id="article-class-filter"
                  aria-label="依班級篩選"
                  value={classFilter}
                  onChange={(event) => setClassFilter(event.target.value)}
                  className="w-full rounded-lg border border-waldorf-cream-300 bg-white px-4 py-2.5 text-waldorf-clay-700"
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
                <label htmlFor="article-tag-filter" className="mb-2 block text-sm font-semibold text-waldorf-clay-700">
                  標籤
                </label>
                <select
                  id="article-tag-filter"
                  aria-label="依標籤篩選"
                  value={tagFilter}
                  onChange={(event) => setTagFilter(event.target.value)}
                  className="w-full rounded-lg border border-waldorf-cream-300 bg-white px-4 py-2.5 text-waldorf-clay-700"
                >
                  <option value="all">全部標籤</option>
                  {activeTags.map((tag) => (
                    <option key={tag.id} value={tag.id}>
                      {tag.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-3 flex justify-end">
              <div className="w-full md:w-[260px]">
                <label htmlFor="article-sort" className="mb-2 block text-sm font-semibold text-waldorf-clay-700">
                  排序
                </label>
                <select
                  id="article-sort"
                  aria-label="排序文章"
                  value={sortOption}
                  onChange={(event) => setSortOption(event.target.value as ArticleSortOption)}
                  className="w-full rounded-lg border border-waldorf-cream-300 bg-white px-4 py-2.5 text-waldorf-clay-700"
                >
                  <option value="updated_desc">最近更新優先</option>
                  <option value="updated_asc">最早更新優先</option>
                  <option value="title_asc">標題 A-Z</option>
                  <option value="title_desc">標題 Z-A</option>
                </select>
              </div>
            </div>
          </div>

          {(error || taxonomyError) && (
            <div className="rounded-xl border border-waldorf-rose-200 bg-waldorf-rose-50 p-4 text-sm font-medium text-waldorf-rose-700">
              {error || taxonomyError}
            </div>
          )}

          <div className="overflow-hidden rounded-xl border border-waldorf-cream-200 bg-white shadow-sm">
            <div className="border-b border-waldorf-cream-200 px-6 py-4">
              <h2 className="font-display text-2xl font-semibold text-waldorf-clay-800">文章列表</h2>
              <p className="mt-1 text-sm text-waldorf-clay-500">共 {articles.length} 篇文章</p>
            </div>

            {isLoading ? (
              <div className="p-8">
                <LoadingSpinner />
              </div>
            ) : articles.length === 0 ? (
              <div className="p-8 text-center text-waldorf-clay-500">找不到符合條件的文章。</div>
            ) : (
              <table className="min-w-full divide-y divide-waldorf-cream-200">
                <thead className="bg-waldorf-cream-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-waldorf-clay-500">標題</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-waldorf-clay-500">狀態</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-waldorf-clay-500">is_template</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-waldorf-clay-500">所屬電子報</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-waldorf-clay-500">分類</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-waldorf-clay-500">標籤</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-waldorf-clay-500">更新時間</th>
                    <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-waldorf-clay-500">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-waldorf-cream-100 bg-white">
                  {articles.map((article) => {
                    const memberships = membershipsByArticleId[article.id] || []
                    const assignment = getArticleAssignment(article.id)
                    const categoryNames = assignment.categoryIds.map(getCategoryNameById)
                    const tagNames = assignment.tagIds.map(getTagNameById)
                    const draft = assignmentDrafts[article.id] || assignment

                    return (
                      <Fragment key={article.id}>
                        <tr key={article.id} data-testid={`article-row-${article.id}`}>
                          <td className="px-6 py-4 text-sm font-medium text-waldorf-clay-800">{article.title}</td>
                          <td className="px-6 py-4 text-sm text-waldorf-clay-600">{article.status}</td>
                          <td className="px-6 py-4 text-sm text-waldorf-clay-600">
                            {memberships.some((membership) => membership.isTemplate) ? 'true' : 'false'}
                          </td>
                          <td className="px-6 py-4 text-sm text-waldorf-clay-600">
                            {memberships.length === 0 ? (
                              '-'
                            ) : (
                              <div className="flex flex-wrap gap-2">
                                {memberships.map((membership) => (
                                  <button
                                    key={`${article.id}-${membership.newsletterId}`}
                                    onClick={() => setSelectedNewsletterId(membership.newsletterId)}
                                    className={`rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
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
                                    className="rounded-full border border-waldorf-sage-200 bg-waldorf-sage-50 px-2.5 py-1 text-xs font-medium text-waldorf-sage-700"
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
                                    className="rounded-full border border-waldorf-lavender-200 bg-waldorf-lavender-50 px-2.5 py-1 text-xs font-medium text-waldorf-lavender-700"
                                  >
                                    {name}
                                  </span>
                                ))}
                              </div>
                            )}
                          </td>
                          <td className="px-6 py-4 text-sm text-waldorf-clay-500">
                            {new Date(article.updatedAt).toLocaleString('zh-TW')}
                          </td>
                          <td className="px-6 py-4 text-right text-sm">
                            <div className="flex justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  void handleMoveToRecycleBin(article)
                                }}
                                disabled={deletingArticleId === article.id}
                                className="rounded-lg border border-waldorf-rose-300 bg-waldorf-rose-50 px-3 py-1.5 text-xs font-medium text-waldorf-rose-700 hover:bg-waldorf-rose-100 disabled:opacity-60"
                              >
                                {deletingArticleId === article.id ? '移除中...' : '移至回收站'}
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  editingArticleId === article.id
                                    ? closeAssignmentEditor()
                                    : openAssignmentEditor(article.id)
                                }
                                className="rounded-lg border border-waldorf-cream-300 bg-white px-3 py-1.5 text-xs font-medium text-waldorf-clay-700 hover:bg-waldorf-cream-50"
                              >
                                {editingArticleId === article.id ? '關閉' : '編輯分類/標籤'}
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  void handleToggleVersionHistory(article.id)
                                }}
                                className="rounded-lg border border-waldorf-lavender-300 bg-waldorf-lavender-50 px-3 py-1.5 text-xs font-medium text-waldorf-lavender-700 hover:bg-waldorf-lavender-100"
                              >
                                {openVersionHistoryArticleId === article.id ? '隱藏版本' : '版本紀錄'}
                              </button>
                            </div>
                          </td>
                        </tr>

                        {editingArticleId === article.id && (
                          <tr>
                            <td colSpan={8} className="bg-waldorf-cream-50 px-6 py-4">
                              <div className="grid gap-4 md:grid-cols-2">
                                <div className="rounded-lg border border-waldorf-cream-200 bg-white p-3">
                                  <h4 className="text-sm font-semibold text-waldorf-clay-700">分類指派</h4>
                                  {activeCategories.length === 0 ? (
                                    <p className="mt-2 text-xs text-waldorf-clay-500">
                                      尚無可用分類，請先在上方建立。
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
                                      尚無可用標籤，請先在上方建立。
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
                            <td colSpan={8} className="bg-waldorf-lavender-50 px-6 py-4">
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
            )}
          </div>

          <div className="overflow-hidden rounded-xl border border-waldorf-cream-200 bg-white shadow-sm">
            <div className="border-b border-waldorf-cream-200 px-6 py-4">
              <h2 className="font-display text-2xl font-semibold text-waldorf-clay-800">內容回收站</h2>
              <p className="mt-1 text-sm text-waldorf-clay-500">
                已刪除 {recycleBinArticles.length} 篇文章（預設保留 {ARTICLE_RETENTION_LABEL}）
              </p>
            </div>

            {isRecycleBinLoading ? (
              <div className="p-8">
                <LoadingSpinner />
              </div>
            ) : recycleBinArticles.length === 0 ? (
              <div className="p-8 text-center text-waldorf-clay-500">目前回收站沒有文章。</div>
            ) : (
              <table className="min-w-full divide-y divide-waldorf-cream-200">
                <thead className="bg-waldorf-cream-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-waldorf-clay-500">標題</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-waldorf-clay-500">刪除時間</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-waldorf-clay-500">預計清除</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-waldorf-clay-500">參照電子報</th>
                    <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-waldorf-clay-500">操作</th>
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
                                className="rounded-full border border-waldorf-peach-200 bg-waldorf-peach-50 px-2.5 py-1 text-xs font-medium text-waldorf-peach-700"
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
            )}
          </div>
        </div>
      </AdminLayout>
    </ErrorBoundary>
  )
}

export default AdminArticlesPage
