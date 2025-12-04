/**
 * Class List Component
 * 班級列表元件
 * Displays all classes in a sortable, filterable table
 *
 * Features:
 * - Display classes with name, description, student count
 * - Search by name
 * - Sort by name, student count, creation date
 * - Action buttons: edit, delete
 * - Responsive design with Waldorf-inspired aesthetics
 */

import { useMemo, useState } from 'react'
import type { Class } from '@/types/admin'

export interface ClassListProps {
  classes: Class[]
  isLoading?: boolean
  error?: string | null
  onEdit?: (id: string) => void
  onDelete?: (id: string) => void
  onSearchChange?: (searchTerm: string) => void
}

type SortField = 'name' | 'studentCount' | 'createdAt'
type SortOrder = 'asc' | 'desc'

/**
 * Class List Component
 */
export function ClassList({
  classes,
  isLoading = false,
  error = null,
  onEdit,
  onDelete,
  onSearchChange,
}: ClassListProps) {
  const [sortField, setSortField] = useState<SortField>('name')
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc')
  const [searchTerm, setSearchTerm] = useState('')

  /**
   * Handle sort column click
   */
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortOrder('asc')
    }
  }

  /**
   * Handle search input change
   */
  const handleSearchChange = (value: string) => {
    setSearchTerm(value)
    onSearchChange?.(value)
  }

  /**
   * Sort and filter classes
   */
  const sortedAndFiltered = useMemo(() => {
    let result = [...classes]

    // Apply search filter
    if (searchTerm) {
      result = result.filter(
        (c) =>
          c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          c.description?.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

    // Apply sorting
    result.sort((a, b) => {
      let aVal: any
      let bVal: any

      switch (sortField) {
        case 'name':
          aVal = a.name
          bVal = b.name
          break
        case 'studentCount':
          aVal = a.studentIds?.length || 0
          bVal = b.studentIds?.length || 0
          break
        case 'createdAt':
          aVal = new Date(a.createdAt).getTime()
          bVal = new Date(b.createdAt).getTime()
          break
      }

      if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1
      if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1
      return 0
    })

    return result
  }, [classes, sortField, sortOrder, searchTerm])

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
      <svg className="w-4 h-4 ml-1 text-waldorf-sage-500 inline-block" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
      </svg>
    ) : (
      <svg className="w-4 h-4 ml-1 text-waldorf-sage-500 inline-block" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
          <div className="w-12 h-12 rounded-full border-4 border-waldorf-cream-200 border-t-waldorf-sage-500 animate-spin"></div>
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
  if (classes.length === 0) {
    return (
      <div className="text-center py-16">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-waldorf-cream-100 mb-4">
          <svg className="w-8 h-8 text-waldorf-clay-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
          </svg>
        </div>
        <p className="text-waldorf-clay-500 font-medium">尚無班級</p>
        <p className="text-waldorf-clay-400 text-sm mt-1">點擊上方按鈕創建第一個班級</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Search */}
      <div className="flex flex-wrap items-center gap-4 p-4 bg-waldorf-cream-50/50 rounded-xl border border-waldorf-cream-200">
        <div className="flex items-center gap-3 flex-1">
          <label htmlFor="search" className="text-sm font-medium text-waldorf-clay-600">
            搜尋:
          </label>
          <input
            id="search"
            type="text"
            value={searchTerm}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="班級名稱或描述..."
            className="flex-1 px-4 py-2 border border-waldorf-cream-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-waldorf-sage-300 focus:border-waldorf-sage-400 bg-white transition-all duration-200"
            data-testid="search-input"
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-waldorf-clay-500">
            顯示 <span className="font-semibold text-waldorf-clay-700">{sortedAndFiltered.length}</span> / {classes.length} 個班級
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
                onClick={() => handleSort('name')}
                data-testid="sort-name"
              >
                <span className="inline-flex items-center">
                  班級名稱{renderSortIndicator('name')}
                </span>
              </th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-waldorf-clay-600 uppercase tracking-wider">
                描述
              </th>
              <th
                className="px-6 py-4 text-left text-xs font-semibold text-waldorf-clay-600 uppercase tracking-wider cursor-pointer hover:bg-waldorf-cream-100/50 transition-colors duration-200"
                onClick={() => handleSort('studentCount')}
                data-testid="sort-students"
              >
                <span className="inline-flex items-center">
                  學生數{renderSortIndicator('studentCount')}
                </span>
              </th>
              <th
                className="px-6 py-4 text-left text-xs font-semibold text-waldorf-clay-600 uppercase tracking-wider cursor-pointer hover:bg-waldorf-cream-100/50 transition-colors duration-200"
                onClick={() => handleSort('createdAt')}
                data-testid="sort-date"
              >
                <span className="inline-flex items-center">
                  建立日期{renderSortIndicator('createdAt')}
                </span>
              </th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-waldorf-clay-600 uppercase tracking-wider">
                操作
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-waldorf-cream-100">
            {sortedAndFiltered.map((classItem, index) => (
              <tr
                key={`${classItem.id}-${index}`}
                className="hover:bg-waldorf-cream-50/50 transition-colors duration-200 animate-fade-in"
                style={{ animationDelay: `${index * 30}ms` }}
                data-testid={`class-row-${classItem.id}`}
              >
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="font-display text-lg font-semibold text-waldorf-clay-800">
                    {classItem.name}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm text-waldorf-clay-600">
                  {classItem.description || <span className="text-waldorf-clay-400">-</span>}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-waldorf-sage-100 text-waldorf-sage-700 font-semibold text-sm">
                    {classItem.studentIds?.length || 0}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-waldorf-clay-600">
                  {new Date(classItem.createdAt).toLocaleDateString('zh-TW', {
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit',
                  })}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => onEdit?.(classItem.id)}
                      className="px-3 py-1.5 bg-waldorf-clay-100 text-waldorf-clay-700 text-xs font-medium rounded-lg hover:bg-waldorf-clay-200 transition-all duration-200 disabled:opacity-50"
                      data-testid={`edit-btn-${classItem.id}`}
                      disabled={!onEdit}
                    >
                      編輯
                    </button>
                    <button
                      onClick={() => onDelete?.(classItem.id)}
                      className="px-3 py-1.5 bg-waldorf-rose-100 text-waldorf-rose-700 text-xs font-medium rounded-lg hover:bg-waldorf-rose-200 transition-all duration-200 disabled:opacity-50"
                      data-testid={`delete-btn-${classItem.id}`}
                      disabled={!onDelete}
                    >
                      刪除
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* No results after search */}
      {sortedAndFiltered.length === 0 && classes.length > 0 && (
        <div className="text-center py-8">
          <p className="text-waldorf-clay-500">沒有符合條件的班級</p>
        </div>
      )}
    </div>
  )
}

export default ClassList
