/**
 * Role Selector Component
 * 角色選擇器 - 用於指派使用者角色
 *
 * Features:
 * - Display available roles with descriptions
 * - Visual role selection with color coding
 * - Support for single and multiple role selection (future)
 * - Waldorf palette styling
 */

import type { UserRole } from '@/types/admin'

export interface RoleSelectorProps {
  selectedRole: UserRole
  onRoleChange: (role: UserRole) => void
  disabled?: boolean
  showDescriptions?: boolean
}

/**
 * Role information with descriptions
 * 角色資訊及描述
 */
const ROLE_INFO: Record<
  UserRole,
  {
    label: string
    description: string
    bg: string
    text: string
    border: string
  }
> = {
  admin: {
    label: '管理員',
    description: '完整系統存取權限，可管理所有內容和用戶',
    bg: 'bg-waldorf-sage-50',
    text: 'text-waldorf-sage-700',
    border: 'border-waldorf-sage-200',
  },
  teacher: {
    label: '教師',
    description: '可查看課程內容和班級，可編輯班級文章',
    bg: 'bg-waldorf-peach-50',
    text: 'text-waldorf-peach-700',
    border: 'border-waldorf-peach-200',
  },
  parent: {
    label: '家長',
    description: '可查看公開文章和孩子班級的內容',
    bg: 'bg-waldorf-clay-50',
    text: 'text-waldorf-clay-700',
    border: 'border-waldorf-clay-200',
  },
  student: {
    label: '學生',
    description: '不登入系統，用於班級和家庭關聯',
    bg: 'bg-waldorf-cream-50',
    text: 'text-waldorf-cream-700',
    border: 'border-waldorf-cream-200',
  },
}

/**
 * Role Selector Component
 */
export function RoleSelector({
  selectedRole,
  onRoleChange,
  disabled = false,
  showDescriptions = true,
}: RoleSelectorProps) {
  const roles: UserRole[] = ['admin', 'teacher', 'parent', 'student']

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-700">角色</label>

      <div
        className={`grid gap-3 ${showDescriptions ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-2 sm:grid-cols-4'}`}
      >
        {roles.map((role) => {
          const info = ROLE_INFO[role]
          const isSelected = selectedRole === role

          return (
            <button
              key={role}
              type="button"
              onClick={() => !disabled && onRoleChange(role)}
              disabled={disabled}
              className={`relative rounded-lg border-2 p-4 text-left transition-all ${
                isSelected
                  ? `${info.bg} ${info.border} border-2 shadow-md`
                  : 'border-gray-200 hover:border-gray-300'
              } ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
            >
              {/* Selection indicator */}
              {isSelected && (
                <div className="absolute right-2 top-2">
                  <div
                    className={`flex h-5 w-5 items-center justify-center rounded-full border-2 ${info.border}`}
                  >
                    <div className="h-3 w-3 rounded-full bg-waldorf-sage-600" />
                  </div>
                </div>
              )}

              {/* Role label */}
              <h3 className={`text-sm font-semibold ${info.text}`}>{info.label}</h3>

              {/* Role description */}
              {showDescriptions && (
                <p className="mt-2 text-xs text-gray-600">{info.description}</p>
              )}
            </button>
          )
        })}
      </div>

      {/* Help text */}
      <p className="text-xs text-gray-500">
        選擇用戶的角色以決定其系統存取權限
      </p>
    </div>
  )
}

/**
 * Compact Role Selector (dropdown)
 * 簡潔角色選擇器 - 下拉菜單版本
 */
export function RoleSelectorDropdown({
  selectedRole,
  onRoleChange,
  disabled = false,
}: Omit<RoleSelectorProps, 'showDescriptions'>) {
  const roles: UserRole[] = ['admin', 'teacher', 'parent', 'student']

  return (
    <select
      value={selectedRole}
      onChange={(e) => onRoleChange(e.target.value as UserRole)}
      disabled={disabled}
      className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-waldorf-sage-500 focus:outline-none disabled:opacity-50"
    >
      {roles.map((role) => (
        <option key={role} value={role}>
          {ROLE_INFO[role].label}
        </option>
      ))}
    </select>
  )
}
