/**
 * Newsletter Table Component
 * Displays all newsletters in a sortable, filterable table
 *
 * Features:
 * - Display newsletters with week number, release date, article count, status
 * - Status badges (draft, published, archived) with color coding
 * - Context-aware action buttons (edit, publish, archive, delete)
 * - Sorting by week, status, article count
 * - Filtering by status
 * - Responsive design with Waldorf-inspired aesthetics
 */

import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import type { AdminNewsletter, NewsletterFilterOptions } from '@/types/admin'

export interface NewsletterTableProps {
  newsletters: AdminNewsletter[]
  isLoading?: boolean
  error?: string | null
  onEdit?: (id: string) => void
  onPublish?: (id: string) => void
  onArchive?: (id: string) => void
  onDelete?: (id: string) => void
  onFilterChange?: (filters: NewsletterFilterOptions) => void
}

type SortField = 'weekNumber' | 'releaseDate' | 'status' | 'articleCount'
type SortOrder = 'asc' | 'desc'

/**
 * Status badge styling using Waldorf palette
 */
const STATUS_STYLES: Record<string, { bg: string; text: string; border: string }> = {
  published: {
    bg: 'bg-waldorf-sage-100',
    text: 'text-waldorf-sage-700',
    border: 'border-waldorf-sage-200',
  },
  draft: {
    bg: 'bg-waldorf-peach-100',
    text: 'text-waldorf-peach-700',
    border: 'border-waldorf-peach-200',
  },
  archived: {
    bg: 'bg-waldorf-cream-200',
    text: 'text-waldorf-clay-500',
    border: 'border-waldorf-cream-300',
  },
}

const STATUS_LABELS: Record<string, string> = {
  published: '已發布',
  draft: '草稿',
  archived: '已封存',
}

/**
 * Newsletter Table Component
 */
export function NewsletterTable({
  newsletters,
  isLoading = false,
  error = null,
  onEdit,
  onPublish,
  onArchive,
  onDelete,
  onFilterChange,
}: NewsletterTableProps) {
  const [sortField, setSortField] = useState<SortField>('weekNumber')
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc')
  const [statusFilter, setStatusFilter] = useState<string | null>(null)

  /**
   * Handle sort column click
   */
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      // Toggle sort order if same field clicked
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      // New field, default to ascending
      setSortField(field)
      setSortOrder('asc')
    }
  }

  /**
   * Handle status filter change
   */
  const handleStatusFilterChange = (status: string | null) => {
    setStatusFilter(status)
    if (onFilterChange) {
      onFilterChange({
        status: status as any,
      })
    }
  }

  /**
   * Sort and filter newsletters
   */
  const sortedAndFiltered = useMemo(() => {
    let result = [...newsletters]

    // Apply status filter
    if (statusFilter) {
      result = result.filter((n) => n.status === statusFilter)
    }

    // Apply sorting
    result.sort((a, b) => {
      let aVal: any
      let bVal: any

      switch (sortField) {
        case 'weekNumber':
          aVal = a.weekNumber
          bVal = b.weekNumber
          break
        case 'releaseDate':
          aVal = new Date(a.releaseDate).getTime()
          bVal = new Date(b.releaseDate).getTime()
          break
        case 'status':
          aVal = a.status
          bVal = b.status
          break
        case 'articleCount':
          aVal = a.articleCount
          bVal = b.articleCount
          break
      }

      if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1
      if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1
      return 0
    })

    return result
  }, [newsletters, sortField, sortOrder, statusFilter])

  /**
   * Render sort indicator
   */
  const renderSortIndicator = (field: SortField) => {
    if (sortField !== field) {
      return (
        <svg className="w-4 h-4 ml-1 text-waldorf-cream-400 inline-block" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
        </svg>
      )
    }
    return sortOrder === 'asc' ? (
      <svg className="w-4 h-4 ml-1 text-waldorf-peach-500 inline-block" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
      </svg>
    ) : (
      <svg className="w-4 h-4 ml-1 text-waldorf-peach-500 inline-block" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      </svg>
    )
  }

  /**
   * Loading state
   */
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <div className="relative">
          <div className="w-12 h-12 rounded-full border-4 border-waldorf-cream-200 border-t-waldorf-peach-500 animate-spin"></div>
        </div>
        <span className="mt-4 text-waldorf-clay-500 font-medium">載入中...</span>
      </div>
    )
  }

  /**
   * Error state
   */
  if (error) {
    return (
      <div className="p-6 bg-waldorf-rose-50 border border-waldorf-rose-200 rounded-xl">
        <p className="text-waldorf-rose-800 font-semibold">錯誤</p>
        <p className="text-waldorf-rose-600 text-sm mt-1">{error}</p>
      </div>
    )
  }

  /**
   * Empty state
   */
  if (newsletters.length === 0) {
    return (
      <div className="text-center py-16">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-waldorf-cream-100 mb-4">
          <svg className="w-8 h-8 text-waldorf-clay-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
          </svg>
        </div>
        <p className="text-waldorf-clay-500 font-medium">尚無電子報</p>
        <p className="text-waldorf-clay-400 text-sm mt-1">點擊上方按鈕創建第一份電子報</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4 p-4 bg-waldorf-cream-50/50 rounded-xl border border-waldorf-cream-200">
        <div className="flex items-center gap-3">
          <label htmlFor="status-filter" className="text-sm font-medium text-waldorf-clay-600">
            按狀態篩選:
          </label>
          <select
            id="status-filter"
            value={statusFilter || 'all'}
            onChange={(e) => handleStatusFilterChange(e.target.value === 'all' ? null : e.target.value)}
            className="px-4 py-2 border border-waldorf-cream-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-waldorf-peach-300 focus:border-waldorf-peach-400 bg-white transition-all duration-200"
          >
            <option value="all">全部</option>
            <option value="draft">草稿</option>
            <option value="published">已發布</option>
            <option value="archived">已封存</option>
          </select>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <span className="text-sm text-waldorf-clay-500">
            顯示 <span className="font-semibold text-waldorf-clay-700">{sortedAndFiltered.length}</span> / {newsletters.length} 個電子報
          </span>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-waldorf-cream-200 shadow-sm">
        <table className="w-full">
          <thead className="bg-gradient-to-r from-waldorf-cream-100 to-waldorf-cream-50">
            <tr>
              <th
                className="px-6 py-4 text-left text-xs font-semibold text-waldorf-clay-600 uppercase tracking-wider cursor-pointer hover:bg-waldorf-cream-100/50 transition-colors duration-200"
                onClick={() => handleSort('weekNumber')}
                data-testid="sort-week"
              >
                <span className="inline-flex items-center">
                  週次{renderSortIndicator('weekNumber')}
                </span>
              </th>
              <th
                className="px-6 py-4 text-left text-xs font-semibold text-waldorf-clay-600 uppercase tracking-wider cursor-pointer hover:bg-waldorf-cream-100/50 transition-colors duration-200"
                onClick={() => handleSort('releaseDate')}
                data-testid="sort-date"
              >
                <span className="inline-flex items-center">
                  發布日期{renderSortIndicator('releaseDate')}
                </span>
              </th>
              <th
                className="px-6 py-4 text-left text-xs font-semibold text-waldorf-clay-600 uppercase tracking-wider cursor-pointer hover:bg-waldorf-cream-100/50 transition-colors duration-200"
                onClick={() => handleSort('articleCount')}
                data-testid="sort-articles"
              >
                <span className="inline-flex items-center">
                  文章數{renderSortIndicator('articleCount')}
                </span>
              </th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-waldorf-clay-600 uppercase tracking-wider">
                Is Published
              </th>
              <th
                className="px-6 py-4 text-left text-xs font-semibold text-waldorf-clay-600 uppercase tracking-wider cursor-pointer hover:bg-waldorf-cream-100/50 transition-colors duration-200"
                onClick={() => handleSort('status')}
                data-testid="sort-status"
              >
                <span className="inline-flex items-center">
                  狀態{renderSortIndicator('status')}
                </span>
              </th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-waldorf-clay-600 uppercase tracking-wider">
                操作
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-waldorf-cream-100">
            {sortedAndFiltered.map((newsletter, index) => (
              <tr
                key={`${newsletter.id}-${index}`}
                className="hover:bg-waldorf-cream-50/50 transition-colors duration-200 animate-fade-in"
                style={{ animationDelay: `${index * 30}ms` }}
                data-testid={`newsletter-row-${newsletter.id}`}
              >
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="font-display text-lg font-semibold text-waldorf-clay-800">
                    {newsletter.weekNumber}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-waldorf-clay-600">
                  {new Date(newsletter.releaseDate).toLocaleDateString('zh-TW', {
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit',
                  })}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <Link
                    to={`/admin/articles/${newsletter.weekNumber}`}
                    className="inline-flex items-center gap-1.5 text-waldorf-clay-600 hover:text-waldorf-peach-600 transition-colors duration-200 group"
                    title="View Articles"
                  >
                    <span className="font-medium">{newsletter.articleCount}</span>
                    <svg className="w-4 h-4 opacity-0 group-hover:opacity-100 transform translate-x-0 group-hover:translate-x-1 transition-all duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </Link>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-center">
                  {newsletter.isPublished ? (
                    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-waldorf-sage-100" title="Published">
                      <svg className="w-4 h-4 text-waldorf-sage-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </span>
                  ) : (
                    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-waldorf-cream-100" title="Not Published">
                      <span className="w-2 h-2 rounded-full bg-waldorf-cream-300"></span>
                    </span>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center gap-2">
                    {(() => {
                      const style = STATUS_STYLES[newsletter.status] || STATUS_STYLES.archived
                      return (
                        <span
                          className={`inline-flex px-3 py-1 rounded-full text-xs font-semibold border ${style.bg} ${style.text} ${style.border}`}
                          data-testid={`status-badge-${newsletter.id}`}
                        >
                          {STATUS_LABELS[newsletter.status] || newsletter.status}
                        </span>
                      )
                    })()}
                    {newsletter.status === 'published' && (
                      <a
                        href={`/week/${newsletter.weekNumber}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-waldorf-clay-400 hover:text-waldorf-peach-500 transition-colors duration-200"
                        title="View Public Newsletter"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                      </a>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center gap-2">
                    {newsletter.status === 'draft' && (
                      <>
                        <button
                          onClick={() => onEdit?.(newsletter.id)}
                          className="px-3 py-1.5 bg-waldorf-clay-100 text-waldorf-clay-700 text-xs font-medium rounded-lg hover:bg-waldorf-clay-200 transition-all duration-200 disabled:opacity-50"
                          data-testid={`edit-btn-${newsletter.id}`}
                          disabled={!onEdit}
                        >
                          編輯
                        </button>
                        <button
                          onClick={() => onPublish?.(newsletter.id)}
                          className="px-3 py-1.5 bg-waldorf-sage-100 text-waldorf-sage-700 text-xs font-medium rounded-lg hover:bg-waldorf-sage-200 transition-all duration-200 disabled:opacity-50"
                          data-testid={`publish-btn-${newsletter.id}`}
                          disabled={!onPublish}
                        >
                          發布
                        </button>
                      </>
                    )}
                    {newsletter.status === 'published' && (
                      <button
                        onClick={() => onArchive?.(newsletter.id)}
                        className="px-3 py-1.5 bg-waldorf-cream-200 text-waldorf-clay-600 text-xs font-medium rounded-lg hover:bg-waldorf-cream-300 transition-all duration-200 disabled:opacity-50"
                        data-testid={`archive-btn-${newsletter.id}`}
                        disabled={!onArchive}
                      >
                        封存
                      </button>
                    )}
                    {newsletter.status !== 'archived' && (
                      <button
                        onClick={() => onDelete?.(newsletter.id)}
                        className="px-3 py-1.5 bg-waldorf-rose-100 text-waldorf-rose-700 text-xs font-medium rounded-lg hover:bg-waldorf-rose-200 transition-all duration-200 disabled:opacity-50"
                        data-testid={`delete-btn-${newsletter.id}`}
                        disabled={!onDelete}
                      >
                        刪除
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* No results after filter */}
      {sortedAndFiltered.length === 0 && newsletters.length > 0 && (
        <div className="text-center py-8">
          <p className="text-waldorf-clay-500">沒有符合條件的電子報</p>
        </div>
      )}
    </div>
  )
}

export default NewsletterTable
