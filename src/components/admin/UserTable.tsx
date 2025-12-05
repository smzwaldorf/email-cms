/**
 * User Table Component
 * 用戶列表表格 - 顯示所有用戶並支援排序、篩選和操作
 *
 * Features:
 * - Display users in sortable, filterable table
 * - Show email, name, role, status with visual indicators
 * - Action buttons: edit, delete, toggle status
 * - Role badge with color coding
 * - Status indicator (active/disabled/pending)
 * - Responsive design with Waldorf palette
 */

import { useMemo, useState } from 'react'
import type { AdminUser } from '@/types/admin'

export interface UserTableProps {
  users: AdminUser[]
  isLoading?: boolean
  error?: string | null
  onEdit?: (user: AdminUser) => void
  onDelete?: (id: string) => void
  onStatusToggle?: (id: string, status: 'active' | 'disabled') => void
  onFilterChange?: (filters: UserFilterOptions) => void
}

interface UserFilterOptions {
  role?: string
  status?: string
  searchTerm?: string
  sortBy?: 'email' | 'name' | 'role' | 'status' | 'createdAt'
  sortOrder?: 'asc' | 'desc'
}

type SortField = 'email' | 'name' | 'role' | 'status' | 'createdAt'
type SortOrder = 'asc' | 'desc'

/**
 * Role badge styling using Waldorf palette
 * 根據角色使用 Waldorf 調色板進行樣式設定
 */
const ROLE_STYLES: Record<string, { bg: string; text: string }> = {
  admin: {
    bg: 'bg-waldorf-sage-100',
    text: 'text-waldorf-sage-700',
  },
  teacher: {
    bg: 'bg-waldorf-peach-100',
    text: 'text-waldorf-peach-700',
  },
  parent: {
    bg: 'bg-waldorf-clay-100',
    text: 'text-waldorf-clay-700',
  },
  student: {
    bg: 'bg-waldorf-cream-100',
    text: 'text-waldorf-cream-700',
  },
}

const ROLE_LABELS: Record<string, string> = {
  admin: '管理員',
  teacher: '教師',
  parent: '家長',
  student: '學生',
}

const STATUS_STYLES: Record<string, { bg: string; text: string; icon: string }> = {
  active: {
    bg: 'bg-green-50',
    text: 'text-green-700',
    icon: '✓',
  },
  disabled: {
    bg: 'bg-gray-50',
    text: 'text-gray-600',
    icon: '×',
  },
  pending_approval: {
    bg: 'bg-yellow-50',
    text: 'text-yellow-700',
    icon: '○',
  },
}

const STATUS_LABELS: Record<string, string> = {
  active: '活躍',
  disabled: '停用',
  pending_approval: '待審批',
}

/**
 * User Table Component
 */
export function UserTable({
  users,
  isLoading = false,
  error = null,
  onEdit,
  onDelete,
  onStatusToggle,
  onFilterChange,
}: UserTableProps) {
  const [sortField, setSortField] = useState<SortField>('createdAt')
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc')
  const [roleFilter, setRoleFilter] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')

  /**
   * Handle sort column click
   * 處理排序列點擊
   */
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortOrder('asc')
    }

    // Notify parent of filter change
    if (onFilterChange) {
      onFilterChange({
        sortBy: field,
        sortOrder: sortOrder === 'asc' ? 'desc' : 'asc',
        role: roleFilter || undefined,
        status: statusFilter || undefined,
        searchTerm: searchTerm || undefined,
      })
    }
  }

  /**
   * Handle filter change
   * 處理篩選變更
   */
  const handleFilterChange = (
    type: 'role' | 'status' | 'search',
    value: string | null
  ) => {
    if (type === 'role') {
      setRoleFilter(value)
    } else if (type === 'status') {
      setStatusFilter(value)
    } else if (type === 'search') {
      setSearchTerm(value)
    }

    // Notify parent
    if (onFilterChange) {
      onFilterChange({
        sortBy: sortField,
        sortOrder,
        role: type === 'role' ? value || undefined : roleFilter || undefined,
        status: type === 'status' ? value || undefined : statusFilter || undefined,
        searchTerm: type === 'search' ? value || undefined : searchTerm || undefined,
      })
    }
  }

  /**
   * Sort and filter users
   * 排序和篩選用戶
   */
  const sortedAndFilteredUsers = useMemo(() => {
    let filtered = [...users]

    // Apply role filter
    if (roleFilter) {
      filtered = filtered.filter((u) => u.role === roleFilter)
    }

    // Apply status filter
    if (statusFilter) {
      filtered = filtered.filter((u) => u.status === statusFilter)
    }

    // Apply search term
    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      filtered = filtered.filter(
        (u) =>
          u.email.toLowerCase().includes(term) ||
          u.name.toLowerCase().includes(term)
      )
    }

    // Apply sorting
    filtered.sort((a, b) => {
      let aVal: any = a[sortField]
      let bVal: any = b[sortField]

      // Handle string comparison
      if (typeof aVal === 'string') {
        aVal = aVal.toLowerCase()
        bVal = (bVal as string).toLowerCase()
        return sortOrder === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal)
      }

      // Handle date comparison
      if (sortField === 'createdAt') {
        aVal = new Date(aVal).getTime()
        bVal = new Date(bVal).getTime()
      }

      return sortOrder === 'asc' ? aVal - bVal : bVal - aVal
    })

    return filtered
  }, [users, roleFilter, statusFilter, searchTerm, sortField, sortOrder])

  if (error) {
    return (
      <div className="rounded-md bg-red-50 p-4">
        <p className="text-sm text-red-700">錯誤：{error}</p>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-waldorf-sage-200 border-t-waldorf-sage-600" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-4">
        {/* Search */}
        <input
          type="text"
          placeholder="搜尋電子郵件或名稱..."
          value={searchTerm}
          onChange={(e) => handleFilterChange('search', e.target.value || null)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-waldorf-sage-500 focus:outline-none"
        />

        {/* Role filter */}
        <select
          value={roleFilter || ''}
          onChange={(e) => handleFilterChange('role', e.target.value || null)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-waldorf-sage-500 focus:outline-none"
        >
          <option value="">所有角色</option>
          <option value="admin">管理員</option>
          <option value="teacher">教師</option>
          <option value="parent">家長</option>
          <option value="student">學生</option>
        </select>

        {/* Status filter */}
        <select
          value={statusFilter || ''}
          onChange={(e) => handleFilterChange('status', e.target.value || null)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-waldorf-sage-500 focus:outline-none"
        >
          <option value="">所有狀態</option>
          <option value="active">活躍</option>
          <option value="disabled">停用</option>
          <option value="pending_approval">待審批</option>
        </select>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-gray-200 shadow">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th
                onClick={() => handleSort('email')}
                className="cursor-pointer px-6 py-3 text-left text-sm font-semibold text-gray-700 hover:bg-gray-100"
              >
                <div className="flex items-center gap-2">
                  電子郵件
                  {sortField === 'email' && (
                    <span className="text-xs">{sortOrder === 'asc' ? '▲' : '▼'}</span>
                  )}
                </div>
              </th>

              <th
                onClick={() => handleSort('name')}
                className="cursor-pointer px-6 py-3 text-left text-sm font-semibold text-gray-700 hover:bg-gray-100"
              >
                <div className="flex items-center gap-2">
                  姓名
                  {sortField === 'name' && (
                    <span className="text-xs">{sortOrder === 'asc' ? '▲' : '▼'}</span>
                  )}
                </div>
              </th>

              <th
                onClick={() => handleSort('role')}
                className="cursor-pointer px-6 py-3 text-left text-sm font-semibold text-gray-700 hover:bg-gray-100"
              >
                <div className="flex items-center gap-2">
                  角色
                  {sortField === 'role' && (
                    <span className="text-xs">{sortOrder === 'asc' ? '▲' : '▼'}</span>
                  )}
                </div>
              </th>

              <th
                onClick={() => handleSort('status')}
                className="cursor-pointer px-6 py-3 text-left text-sm font-semibold text-gray-700 hover:bg-gray-100"
              >
                <div className="flex items-center gap-2">
                  狀態
                  {sortField === 'status' && (
                    <span className="text-xs">{sortOrder === 'asc' ? '▲' : '▼'}</span>
                  )}
                </div>
              </th>

              <th
                onClick={() => handleSort('createdAt')}
                className="cursor-pointer px-6 py-3 text-left text-sm font-semibold text-gray-700 hover:bg-gray-100"
              >
                <div className="flex items-center gap-2">
                  建立日期
                  {sortField === 'createdAt' && (
                    <span className="text-xs">{sortOrder === 'asc' ? '▲' : '▼'}</span>
                  )}
                </div>
              </th>

              <th className="px-6 py-3 text-center text-sm font-semibold text-gray-700">操作</th>
            </tr>
          </thead>

          <tbody>
            {sortedAndFilteredUsers.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-8 text-center text-sm text-gray-500">
                  沒有用戶
                </td>
              </tr>
            ) : (
              sortedAndFilteredUsers.map((user) => {
                const roleStyle = ROLE_STYLES[user.role] || ROLE_STYLES.student
                const statusStyle = STATUS_STYLES[user.status] || STATUS_STYLES.active

                return (
                  <tr key={user.id} className="border-b border-gray-200 hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <span className="text-sm text-gray-900">{user.email}</span>
                    </td>

                    <td className="px-6 py-4">
                      <span className="text-sm text-gray-900">{user.name}</span>
                    </td>

                    <td className="px-6 py-4">
                      <span
                        className={`inline-block rounded-full px-3 py-1 text-xs font-medium ${roleStyle.bg} ${roleStyle.text}`}
                      >
                        {ROLE_LABELS[user.role]}
                      </span>
                    </td>

                    <td className="px-6 py-4">
                      <span
                        className={`inline-block rounded-full px-3 py-1 text-xs font-medium ${statusStyle.bg} ${statusStyle.text}`}
                      >
                        {STATUS_LABELS[user.status]}
                      </span>
                    </td>

                    <td className="px-6 py-4">
                      <span className="text-sm text-gray-600">
                        {new Date(user.createdAt).toLocaleDateString('zh-TW')}
                      </span>
                    </td>

                    <td className="px-6 py-4">
                      <div className="flex justify-center gap-2">
                        {onEdit && (
                          <button
                            onClick={() => onEdit(user)}
                            className="rounded px-3 py-1 text-xs font-medium text-waldorf-sage-600 hover:bg-waldorf-sage-50"
                          >
                            編輯
                          </button>
                        )}

                        {onStatusToggle && user.status !== 'pending_approval' && (
                          <button
                            onClick={() =>
                              onStatusToggle(
                                user.id,
                                user.status === 'active' ? 'disabled' : 'active'
                              )
                            }
                            className="rounded px-3 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50"
                          >
                            {user.status === 'active' ? '停用' : '啟用'}
                          </button>
                        )}

                        {onDelete && (
                          <button
                            onClick={() => onDelete(user.id)}
                            className="rounded px-3 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
                          >
                            刪除
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Summary */}
      <div className="flex items-center justify-between border-t border-gray-200 pt-4">
        <span className="text-sm text-gray-600">
          顯示 {sortedAndFilteredUsers.length} / {users.length} 個用戶
        </span>
      </div>
    </div>
  )
}
