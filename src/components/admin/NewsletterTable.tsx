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
 * - Responsive design with Tailwind CSS
 */

import { useMemo, useState } from 'react'
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
 * Status badge styling
 */
const STATUS_COLORS: Record<string, string> = {
  published: 'bg-green-100 text-green-800',
  draft: 'bg-yellow-100 text-yellow-800',
  archived: 'bg-gray-100 text-gray-800',
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
    if (sortField !== field) return ' ⇅'
    return sortOrder === 'asc' ? ' ↑' : ' ↓'
  }

  /**
   * Loading state
   */
  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        <span className="ml-2 text-gray-600">載入中...</span>
      </div>
    )
  }

  /**
   * Error state
   */
  if (error) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
        <p className="text-red-800 font-medium">錯誤</p>
        <p className="text-red-600 text-sm">{error}</p>
      </div>
    )
  }

  /**
   * Empty state
   */
  if (newsletters.length === 0) {
    return (
      <div className="text-center p-8">
        <p className="text-gray-500">尚無電子報</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="bg-white p-4 rounded-lg shadow flex items-center gap-4">
        <label className="text-sm font-medium text-gray-700">按狀態篩選:</label>
        <div className="flex gap-2">
          <button
            onClick={() => handleStatusFilterChange(null)}
            className={`px-3 py-1 rounded text-sm font-medium ${
              statusFilter === null
                ? 'bg-blue-500 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
            data-testid="filter-all"
          >
            全部
          </button>
          <button
            onClick={() => handleStatusFilterChange('draft')}
            className={`px-3 py-1 rounded text-sm font-medium ${
              statusFilter === 'draft'
                ? 'bg-yellow-500 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
            data-testid="filter-draft"
          >
            草稿
          </button>
          <button
            onClick={() => handleStatusFilterChange('published')}
            className={`px-3 py-1 rounded text-sm font-medium ${
              statusFilter === 'published'
                ? 'bg-green-500 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
            data-testid="filter-published"
          >
            已發布
          </button>
          <button
            onClick={() => handleStatusFilterChange('archived')}
            className={`px-3 py-1 rounded text-sm font-medium ${
              statusFilter === 'archived'
                ? 'bg-gray-500 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
            data-testid="filter-archived"
          >
            已封存
          </button>
        </div>
        <div className="ml-auto text-sm text-gray-600">
          顯示 {sortedAndFiltered.length} / {newsletters.length} 個電子報
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full border-collapse">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th
                className="px-6 py-3 text-left text-sm font-semibold text-gray-900 cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('weekNumber')}
                data-testid="sort-week"
              >
                週次{renderSortIndicator('weekNumber')}
              </th>
              <th
                className="px-6 py-3 text-left text-sm font-semibold text-gray-900 cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('releaseDate')}
                data-testid="sort-date"
              >
                發布日期{renderSortIndicator('releaseDate')}
              </th>
              <th
                className="px-6 py-3 text-left text-sm font-semibold text-gray-900 cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('articleCount')}
                data-testid="sort-articles"
              >
                文章數{renderSortIndicator('articleCount')}
              </th>
              <th
                className="px-6 py-3 text-left text-sm font-semibold text-gray-900 cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('status')}
                data-testid="sort-status"
              >
                狀態{renderSortIndicator('status')}
              </th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {sortedAndFiltered.map((newsletter) => (
              <tr
                key={newsletter.id}
                className="hover:bg-gray-50 transition-colors"
                data-testid={`newsletter-row-${newsletter.id}`}
              >
                <td className="px-6 py-4 text-sm font-medium text-gray-900">
                  {newsletter.weekNumber}
                </td>
                <td className="px-6 py-4 text-sm text-gray-600">
                  {new Date(newsletter.releaseDate).toLocaleDateString('zh-TW', {
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit',
                  })}
                </td>
                <td className="px-6 py-4 text-sm text-gray-600">{newsletter.articleCount}</td>
                <td className="px-6 py-4 text-sm">
                  <span
                    className={`inline-block px-2 py-1 rounded-full text-xs font-semibold ${
                      STATUS_COLORS[newsletter.status] || 'bg-gray-100 text-gray-800'
                    }`}
                    data-testid={`status-badge-${newsletter.id}`}
                  >
                    {STATUS_LABELS[newsletter.status] || newsletter.status}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm space-x-2">
                  {newsletter.status === 'draft' && (
                    <>
                      <button
                        onClick={() => onEdit?.(newsletter.id)}
                        className="px-3 py-1 bg-blue-500 text-white text-xs rounded hover:bg-blue-600 transition-colors disabled:opacity-50"
                        data-testid={`edit-btn-${newsletter.id}`}
                        disabled={!onEdit}
                      >
                        編輯
                      </button>
                      <button
                        onClick={() => onPublish?.(newsletter.id)}
                        className="px-3 py-1 bg-green-500 text-white text-xs rounded hover:bg-green-600 transition-colors disabled:opacity-50"
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
                      className="px-3 py-1 bg-gray-500 text-white text-xs rounded hover:bg-gray-600 transition-colors disabled:opacity-50"
                      data-testid={`archive-btn-${newsletter.id}`}
                      disabled={!onArchive}
                    >
                      封存
                    </button>
                  )}
                  {newsletter.status !== 'archived' && (
                    <button
                      onClick={() => onDelete?.(newsletter.id)}
                      className="px-3 py-1 bg-red-500 text-white text-xs rounded hover:bg-red-600 transition-colors disabled:opacity-50"
                      data-testid={`delete-btn-${newsletter.id}`}
                      disabled={!onDelete}
                    >
                      刪除
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* No results after filter */}
      {sortedAndFiltered.length === 0 && newsletters.length > 0 && (
        <div className="text-center p-4 text-gray-500">沒有符合條件的電子報</div>
      )}
    </div>
  )
}

export default NewsletterTable
