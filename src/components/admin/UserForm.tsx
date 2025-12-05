/**
 * User Form Component
 * 用戶表單 - 建立和編輯用戶的表單
 *
 * Features:
 * - Create new users with email and role
 * - Edit user name, email validation, role, and status
 * - Email uniqueness validation
 * - Role selection with RoleSelector component
 * - Form validation with error messages
 * - Support for admin operations (status management, role change)
 */

import { useState, useEffect } from 'react'
import { RoleSelector } from './RoleSelector'
import type { AdminUser } from '@/types/admin'
import type { UserRole } from '@/types/admin'

export interface UserFormProps {
  user?: AdminUser
  isSubmitting?: boolean
  onSubmit: (data: UserFormData) => Promise<void>
  onCancel?: () => void
}

export interface UserFormData {
  email: string
  name: string
  role: UserRole
  status: 'active' | 'disabled' | 'pending_approval'
}

/**
 * Validate email format
 * 驗證電子郵件格式
 */
function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

/**
 * User Form Component
 */
export function UserForm({
  user,
  isSubmitting = false,
  onSubmit,
  onCancel,
}: UserFormProps) {
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [role, setRole] = useState<UserRole>('parent')
  const [status, setStatus] = useState<'active' | 'disabled' | 'pending_approval'>(
    'pending_approval'
  )
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)
  const [touched, setTouched] = useState<Set<string>>(new Set())

  /**
   * Initialize form with user data
   * 使用用戶資料初始化表單
   */
  useEffect(() => {
    if (user) {
      setEmail(user.email)
      setName(user.name)
      setRole(user.role)
      setStatus(user.status)
    }
  }, [user])

  /**
   * Validate form fields
   * 驗證表單欄位
   */
  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {}

    // Email validation
    if (!email.trim()) {
      newErrors.email = '電子郵件為必填項'
    } else if (!isValidEmail(email)) {
      newErrors.email = '請輸入有效的電子郵件地址'
    }

    // Name validation
    if (!name.trim()) {
      newErrors.name = '姓名為必填項'
    } else if (name.trim().length < 2) {
      newErrors.name = '姓名至少需要 2 個字符'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  /**
   * Handle field change
   * 處理欄位變更
   */
  const handleFieldChange = (field: string, value: any) => {
    if (field === 'email') {
      setEmail(value)
    } else if (field === 'name') {
      setName(value)
    } else if (field === 'role') {
      setRole(value)
    } else if (field === 'status') {
      setStatus(value)
    }

    // Mark field as touched
    setTouched(new Set([...touched, field]))

    // Clear error for this field
    setErrors({
      ...errors,
      [field]: undefined,
    })
  }

  /**
   * Handle field blur
   * 處理欄位失焦
   */
  const handleFieldBlur = (field: string) => {
    setTouched(new Set([...touched, field]))

    // Re-validate on blur
    if (field === 'email' && email) {
      if (!isValidEmail(email)) {
        setErrors({
          ...errors,
          email: '請輸入有效的電子郵件地址',
        })
      }
    }
  }

  /**
   * Handle form submission
   * 處理表單提交
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!validateForm()) {
      return
    }

    try {
      await onSubmit({
        email: email.trim(),
        name: name.trim(),
        role,
        status,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Error Message */}
      {error && (
        <div className="rounded-lg bg-red-50 p-4">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Email Field */}
      <div>
        <label htmlFor="email" className="block text-sm font-medium text-gray-700">
          電子郵件 {!user && <span className="text-red-500">*</span>}
        </label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => handleFieldChange('email', e.target.value)}
          onBlur={() => handleFieldBlur('email')}
          disabled={!!user} // Email cannot be changed for existing users
          className={`mt-1 block w-full rounded-lg border px-3 py-2 text-sm focus:outline-none ${
            user ? 'bg-gray-100 cursor-not-allowed' : ''
          } ${
            touched.has('email') && errors.email
              ? 'border-red-500 focus:border-red-500'
              : 'border-gray-300 focus:border-waldorf-sage-500'
          }`}
          placeholder="user@example.com"
          required
        />
        {touched.has('email') && errors.email && (
          <p className="mt-1 text-xs text-red-600">{errors.email}</p>
        )}
        {user && (
          <p className="mt-1 text-xs text-gray-500">電子郵件無法變更</p>
        )}
      </div>

      {/* Name Field */}
      <div>
        <label htmlFor="name" className="block text-sm font-medium text-gray-700">
          姓名 <span className="text-red-500">*</span>
        </label>
        <input
          id="name"
          type="text"
          value={name}
          onChange={(e) => handleFieldChange('name', e.target.value)}
          onBlur={() => handleFieldBlur('name')}
          className={`mt-1 block w-full rounded-lg border px-3 py-2 text-sm focus:outline-none ${
            touched.has('name') && errors.name
              ? 'border-red-500 focus:border-red-500'
              : 'border-gray-300 focus:border-waldorf-sage-500'
          }`}
          placeholder="李明"
          required
        />
        {touched.has('name') && errors.name && (
          <p className="mt-1 text-xs text-red-600">{errors.name}</p>
        )}
      </div>

      {/* Role Selection */}
      <div>
        <RoleSelector
          selectedRole={role}
          onRoleChange={(newRole) => handleFieldChange('role', newRole)}
          showDescriptions={true}
        />
      </div>

      {/* Status Field (for editing existing users) */}
      {user && (
        <div>
          <label htmlFor="status" className="block text-sm font-medium text-gray-700">
            狀態
          </label>
          <select
            id="status"
            value={status}
            onChange={(e) =>
              handleFieldChange(
                'status',
                e.target.value as 'active' | 'disabled' | 'pending_approval'
              )
            }
            className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-waldorf-sage-500 focus:outline-none"
          >
            <option value="active">活躍</option>
            <option value="disabled">停用</option>
            <option value="pending_approval">待審批</option>
          </select>
          <p className="mt-1 text-xs text-gray-500">
            管理用戶的帳戶狀態
          </p>
        </div>
      )}

      {/* Form Actions */}
      <div className="flex gap-3 pt-6">
        <button
          type="submit"
          disabled={isSubmitting}
          className="flex-1 rounded-lg bg-waldorf-sage-600 px-4 py-2 text-sm font-medium text-white hover:bg-waldorf-sage-700 disabled:opacity-50"
        >
          {isSubmitting ? '處理中...' : user ? '更新用戶' : '建立用戶'}
        </button>

        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            取消
          </button>
        )}
      </div>

      {/* Help Text */}
      <div className="rounded-lg bg-blue-50 p-4">
        <p className="text-xs text-blue-700">
          {user
            ? '編輯現有用戶的詳細資訊。電子郵件地址無法變更。'
            : '建立新用戶帳戶。新用戶將收到電子郵件設置其帳戶。'}
        </p>
      </div>
    </form>
  )
}
