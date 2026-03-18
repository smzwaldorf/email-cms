import { useEffect, useMemo, useState } from 'react'
import { adminService, AdminServiceError } from '@/services/adminService'
import type { AdminArticle, AdminNewsletter } from '@/types/admin'
import { AdminLayout } from '@/components/admin/AdminLayout'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { LoadingSpinner } from '@/components/LoadingSpinner'

export function AdminArticlesPage() {
  const [articles, setArticles] = useState<AdminArticle[]>([])
  const [allLoadedArticles, setAllLoadedArticles] = useState<AdminArticle[]>([])
  const [newsletters, setNewsletters] = useState<AdminNewsletter[]>([])
  const [templateNewsletters, setTemplateNewsletters] = useState<AdminNewsletter[]>([])
  const [membershipsByArticleId, setMembershipsByArticleId] = useState<
    Record<string, Array<{ newsletterId: string; label: string; isTemplate: boolean }>>
  >({})
  const [selectedNewsletterId, setSelectedNewsletterId] = useState('')
  const [showTemplateOnly, setShowTemplateOnly] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void loadNewsletters()
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

      const data = selectedNewsletterId
        ? await adminService.fetchArticlesByNewsletterId(selectedNewsletterId)
        : await adminService.fetchAllArticles()

      setAllLoadedArticles(data)

      const memberships = await adminService.fetchArticleNewsletterMemberships(
        data.map((article) => article.id)
      )
      setMembershipsByArticleId(memberships)
    } catch (err) {
      const message = err instanceof AdminServiceError ? err.message : '無法載入文章列表'
      setError(message)
      setMembershipsByArticleId({})
    } finally {
      setIsLoading(false)
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

  useEffect(() => {
    const filtered = allLoadedArticles.filter((article) => {
      if (selectedNewsletterId) return true
      const memberships = membershipsByArticleId[article.id] || []
      const isTemplateArticle = memberships.some((membership) => membership.isTemplate)
      if (showTemplateOnly) return isTemplateArticle
      return !isTemplateArticle
    })

    setArticles(filtered)
  }, [allLoadedArticles, membershipsByArticleId, selectedNewsletterId, showTemplateOnly])

  return (
    <ErrorBoundary>
      <AdminLayout activeTab="articles">
        <div className="space-y-6">
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
          </div>

          {error && (
            <div className="rounded-xl border border-waldorf-rose-200 bg-waldorf-rose-50 p-4 text-sm font-medium text-waldorf-rose-700">
              {error}
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
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-waldorf-clay-500">更新時間</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-waldorf-cream-100 bg-white">
                  {articles.map((article) => {
                    const memberships = membershipsByArticleId[article.id] || []

                    return (
                    <tr key={article.id}>
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
                      <td className="px-6 py-4 text-sm text-waldorf-clay-500">
                        {new Date(article.updatedAt).toLocaleString('zh-TW')}
                      </td>
                    </tr>
                  )})}
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
