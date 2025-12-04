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
 * - Responsive design with Tailwind CSS
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
  if (classes.length === 0) {
    return (
      <div className="text-center p-8">
        <p className="text-gray-500">尚無班級</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="bg-white p-4 rounded-lg shadow flex items-center gap-4">
        <label htmlFor="search" className="text-sm font-medium text-gray-700">
          搜尋:
        </label>
        <input
          id="search"
          type="text"
          value={searchTerm}
          onChange={(e) => handleSearchChange(e.target.value)}
          placeholder="班級名稱或描述..."
          className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          data-testid="search-input"
        />
        <div className="ml-auto text-sm text-gray-600">
          顯示 {sortedAndFiltered.length} / {classes.length} 個班級
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full border-collapse">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th
                className="px-6 py-3 text-left text-sm font-semibold text-gray-900 cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('name')}
                data-testid="sort-name"
              >
                班級名稱{renderSortIndicator('name')}
              </th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                描述
              </th>
              <th
                className="px-6 py-3 text-left text-sm font-semibold text-gray-900 cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('studentCount')}
                data-testid="sort-students"
              >
                學生數{renderSortIndicator('studentCount')}
              </th>
              <th
                className="px-6 py-3 text-left text-sm font-semibold text-gray-900 cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('createdAt')}
                data-testid="sort-date"
              >
                建立日期{renderSortIndicator('createdAt')}
              </th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                操作
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {sortedAndFiltered.map((classItem, index) => (
              <tr
                key={`${classItem.id}-${index}`}
                className="hover:bg-gray-50 transition-colors"
                data-testid={`class-row-${classItem.id}`}
              >
                <td className="px-6 py-4 text-sm font-medium text-gray-900">
                  {classItem.name}
                </td>
                <td className="px-6 py-4 text-sm text-gray-600">
                  {classItem.description || '-'}
                </td>
                <td className="px-6 py-4 text-sm text-gray-600">
                  {classItem.studentIds?.length || 0}
                </td>
                <td className="px-6 py-4 text-sm text-gray-600">
                  {new Date(classItem.createdAt).toLocaleDateString('zh-TW', {
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit',
                  })}
                </td>
                <td className="px-6 py-4 text-sm space-x-2">
                  <button
                    onClick={() => onEdit?.(classItem.id)}
                    className="px-3 py-1 bg-blue-500 text-white text-xs rounded hover:bg-blue-600 transition-colors disabled:opacity-50"
                    data-testid={`edit-btn-${classItem.id}`}
                    disabled={!onEdit}
                  >
                    編輯
                  </button>
                  <button
                    onClick={() => onDelete?.(classItem.id)}
                    className="px-3 py-1 bg-red-500 text-white text-xs rounded hover:bg-red-600 transition-colors disabled:opacity-50"
                    data-testid={`delete-btn-${classItem.id}`}
                    disabled={!onDelete}
                  >
                    刪除
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* No results after search */}
      {sortedAndFiltered.length === 0 && classes.length > 0 && (
        <div className="text-center p-4 text-gray-500">沒有符合條件的班級</div>
      )}
    </div>
  )
}

export default ClassList
