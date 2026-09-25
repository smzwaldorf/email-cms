import { IdentityDirectoryPage } from './IdentityDirectoryPage'
import { smzAuthIssuer } from '@/services/smzAuth'
/**
 * Admin Dashboard Page
 * Main page for admin users to manage newsletters and view legacy user records
 *
 * Features:
 * - Newsletter management and a legacy user records view
 * - Newsletter management (CRUD)
 * - User management (Add, Edit, Delete, Force Logout)
 */

import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import type {
  AdminNewsletter,
  NewsletterFilterOptions,
  AccessControlRole,
  BulkPermissionPreviewEntry,
} from '@/types/admin'
import { adminService, AdminServiceError } from '@/services/adminService'
import NewsletterTable from '@/components/admin/NewsletterTable'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import { getAdminNewsletterPath } from '@/utils/adminNewsletterRoutes'
import { useAuth } from '@/context/AuthContext'
import { adminSessionService } from '@/services/adminSessionService'
import { AdminLayout } from '@/components/admin/AdminLayout'
import { BatchImportForm } from '@/components/admin/BatchImportForm'

// --- Types ---

interface UserData {
  id: string
  email: string
  role: AccessControlRole
  display_name?: string
  last_seen?: string
  hasActiveSessions?: boolean
}

interface AddUserModalProps {
  isOpen: boolean
  onClose: () => void
  onUserAdded: () => void
}

interface EditUserModalProps {
  isOpen: boolean
  onClose: () => void
  userData: UserData | null
  onUserUpdated: () => void
}

// --- Sub-components ---

const AddUserModal: React.FC<AddUserModalProps> = ({ isOpen, onClose, onUserAdded }) => {
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<AccessControlRole>('parent')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsSubmitting(true)

    try {
      await adminService.createUser(email, email, role)

      // Success
      setEmail('')
      setRole('parent')
      onUserAdded()
      onClose()
    } catch (err: unknown) {
      console.error('建立使用者時發生錯誤：', err)
      setError(err instanceof Error ? err.message : '無法建立使用者')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-waldorf-clay-900/40 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in">
      <div className="bg-white rounded-2xl p-8 max-w-md w-full mx-4 shadow-2xl shadow-waldorf-clay-200/50 border border-waldorf-cream-200 animate-scale-in">
        <h2 className="font-display text-2xl font-semibold text-waldorf-clay-800 mb-6">新增使用者</h2>

        {error && (
          <div className="bg-waldorf-rose-50 border border-waldorf-rose-200 text-waldorf-rose-700 px-4 py-3 rounded-xl mb-6">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="mb-5">
            <label className="block text-sm font-medium text-waldorf-clay-600 mb-2">電子郵件</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-4 py-3 border border-waldorf-cream-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-waldorf-peach-300 focus:border-waldorf-peach-400 transition-all duration-200 bg-waldorf-cream-50/50"
            />
            <p className="text-xs text-waldorf-clay-400 mt-2">使用者將收到設定帳號的登入連結</p>
          </div>

          <div className="mb-8">
            <label className="block text-sm font-medium text-waldorf-clay-600 mb-2">角色</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as AccessControlRole)}
              className="w-full px-4 py-3 border border-waldorf-cream-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-waldorf-peach-300 focus:border-waldorf-peach-400 transition-all duration-200 bg-waldorf-cream-50/50"
            >
              {(['admin', 'teacher', 'parent', 'student'] as AccessControlRole[]).map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>

          <div className="flex justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-5 py-2.5 text-waldorf-clay-600 bg-waldorf-cream-100 rounded-xl hover:bg-waldorf-cream-200 disabled:opacity-50 transition-all duration-200 font-medium"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2.5 text-white bg-gradient-to-r from-waldorf-peach-500 to-waldorf-peach-600 rounded-xl hover:from-waldorf-peach-600 hover:to-waldorf-peach-700 disabled:opacity-50 transition-all duration-200 font-medium shadow-lg shadow-waldorf-peach-200/50"
            >
              {isSubmitting ? '建立中...' : '建立使用者'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

const EditUserModal: React.FC<EditUserModalProps> = ({ isOpen, onClose, userData, onUserUpdated }) => {
  const [displayName, setDisplayName] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (userData) {
      setDisplayName(userData.display_name || '')
    }
  }, [userData])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!userData) return

    setError(null)
    setIsSubmitting(true)

    try {
      await adminService.updateUser(userData.id, {
        name: displayName || userData.email,
        role: userData.role,
      })

      onUserUpdated()
      onClose()
    } catch (err: unknown) {
      console.error('更新使用者時發生錯誤：', err)
      setError(err instanceof Error ? err.message : '無法更新使用者')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!isOpen || !userData) return null

  return (
    <div className="fixed inset-0 bg-waldorf-clay-900/40 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in">
      <div className="bg-white rounded-2xl p-8 max-w-md w-full mx-4 shadow-2xl shadow-waldorf-clay-200/50 border border-waldorf-cream-200 animate-scale-in">
        <h2 className="font-display text-2xl font-semibold text-waldorf-clay-800 mb-6">編輯使用者</h2>

        {error && (
          <div className="bg-waldorf-rose-50 border border-waldorf-rose-200 text-waldorf-rose-700 px-4 py-3 rounded-xl mb-6">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="mb-5">
            <label className="block text-sm font-medium text-waldorf-clay-600 mb-2">電子郵件</label>
            <input
              type="email"
              value={userData.email}
              disabled
              className="w-full px-4 py-3 border border-waldorf-cream-300 rounded-xl bg-waldorf-cream-100 cursor-not-allowed text-waldorf-clay-400"
            />
          </div>

          <div className="mb-8">
            <label className="block text-sm font-medium text-waldorf-clay-600 mb-2">顯示名稱</label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full px-4 py-3 border border-waldorf-cream-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-waldorf-peach-300 focus:border-waldorf-peach-400 transition-all duration-200 bg-waldorf-cream-50/50"
            />
          </div>

          <div className="flex justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-5 py-2.5 text-waldorf-clay-600 bg-waldorf-cream-100 rounded-xl hover:bg-waldorf-cream-200 disabled:opacity-50 transition-all duration-200 font-medium"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2.5 text-white bg-gradient-to-r from-waldorf-peach-500 to-waldorf-peach-600 rounded-xl hover:from-waldorf-peach-600 hover:to-waldorf-peach-700 disabled:opacity-50 transition-all duration-200 font-medium shadow-lg shadow-waldorf-peach-200/50"
            >
              {isSubmitting ? '更新中...' : '更新'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// Role badge colors using Waldorf palette
const ROLE_COLORS: Record<string, string> = {
  admin: 'bg-waldorf-lavender-100 text-waldorf-lavender-700 border-waldorf-lavender-200',
  teacher: 'bg-waldorf-sage-100 text-waldorf-sage-700 border-waldorf-sage-200',
  parent: 'bg-waldorf-peach-100 text-waldorf-peach-700 border-waldorf-peach-200',
  student: 'bg-waldorf-cream-100 text-waldorf-clay-600 border-waldorf-cream-200',
}

const ACCESS_CONTROL_ROLE_OPTIONS: AccessControlRole[] = ['admin', 'teacher', 'parent', 'student']

/**
 * Admin Dashboard Page Component
 */
export function AdminDashboardPage() {
  const [searchParams] = useSearchParams()
  if (searchParams.get('tab') === 'users') return <IdentityDirectoryPage kind="users" />
  return <NewsletterAdminDashboard />
}

function NewsletterAdminDashboard() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { user } = useAuth()

  // Tab state derived from URL
  const tabParam = searchParams.get('tab')
  // User management remains out of the primary navigation; keep the legacy
  // tab addressable for backwards-compatible links.
  const activeTab = tabParam === 'users' ? 'users' : 'newsletters'

  // Newsletter state
  const [newsletters, setNewsletters] = useState<AdminNewsletter[]>([])
  const [templateNewsletters, setTemplateNewsletters] = useState<AdminNewsletter[]>([])
  const [showTemplateList, setShowTemplateList] = useState(false)
  const [isNewsletterLoading, setIsNewsletterLoading] = useState(true)
  const [newsletterError, setNewsletterError] = useState<string | null>(null)

  // User state
  const [users, setUsers] = useState<UserData[]>([])
  const [isUserLoading, setIsUserLoading] = useState(false)
  const [userError, setUserError] = useState<string | null>(null)
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<UserData | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [userManagementMode, setUserManagementMode] = useState<'table' | 'batch-import'>('table')
  const [userClassScopes, setUserClassScopes] = useState<Record<string, string[]>>({})
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([])
  const [bulkRoleTarget, setBulkRoleTarget] = useState<AccessControlRole>('teacher')
  const [bulkPreview, setBulkPreview] = useState<BulkPermissionPreviewEntry[]>([])
  const [isBulkPreviewLoading, setIsBulkPreviewLoading] = useState(false)
  const [isBulkApplying, setIsBulkApplying] = useState(false)

  // Shared state
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [suspiciousUsers, setSuspiciousUsers] = useState<Array<{ userId: string; failureCount: number }>>([])


  useEffect(() => {
    // Initial load based on active tab
    if (activeTab === 'newsletters') {
      loadNewsletters()
    } else if (activeTab === 'users') {
      fetchUsers()
    }
  }, [activeTab])

  useEffect(() => {
    const recovered = () => {
      if (activeTab === 'newsletters') void loadNewsletters()
      else if (activeTab === 'users') void fetchUsers()
    }
    window.addEventListener('cms-auth-renewed', recovered)
    return () => window.removeEventListener('cms-auth-renewed', recovered)
  }, [activeTab])

  // Check for suspicious activity
  useEffect(() => {
    const checkSuspicious = async () => {
      try {
        const suspicious = await adminSessionService.detectSuspiciousActivity()
        setSuspiciousUsers(suspicious)
      } catch (err) {
        console.error('偵測可疑活動時發生錯誤：', err)
      }
    }

    checkSuspicious()
    const interval = setInterval(checkSuspicious, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(null), 3000)
      return () => clearTimeout(timer)
    }
  }, [successMessage])

  // --- Newsletter Functions ---



  const loadNewsletters = async () => {
    try {
      setIsNewsletterLoading(true)
      setNewsletterError(null)
      const [allNewsletters, templates] = await Promise.all([
        adminService.fetchNewsletters(),
        adminService.fetchNewsletterTemplates(),
      ])
      setNewsletters(allNewsletters.filter((newsletter) => !newsletter.isTemplate))
      setTemplateNewsletters(templates)
    } catch (err) {
      const message = err instanceof AdminServiceError ? err.message : err instanceof Error ? err.message : '無法載入電子報'
      setNewsletterError(message)
      console.error('無法載入電子報：', err)
    } finally {
      setIsNewsletterLoading(false)
    }
  }

  const handleCreateNewsletter = () => {
    navigate('/admin/newsletter/create')
  }

  const handleEdit = (id: string) => {
    const newsletter = [...newsletters, ...templateNewsletters].find((n) => n.id === id)
    if (newsletter) {
      navigate(getAdminNewsletterPath(newsletter), {
        state: { newsletterId: id },
      })
    }
  }

  const handleCreateTemplate = (id: string) => {
    navigate(`/admin/newsletter/create?sourceNewsletter=${id}`)
  }

  const handlePublish = (id: string) => {
    navigate(`/admin/newsletters/id/${encodeURIComponent(id)}`)
  }

  const handleArchive = async (id: string) => {
    try {
      setNewsletterError(null)
      const updated = await adminService.archiveNewsletter(id)
      setNewsletters(newsletters.map((n) => (n.id === id ? updated : n)))
      setSuccessMessage('電子報已封存')
    } catch (err) {
      const message = err instanceof AdminServiceError ? err.message : err instanceof Error ? err.message : '封存失敗'
      setNewsletterError(message)
    }
  }

  const handleDelete = async (id: string) => {
    if (!window.confirm('確定要刪除這份電子報嗎？')) return

    try {
      setNewsletterError(null)
      await adminService.deleteNewsletter(id)
      setNewsletters(newsletters.filter((n) => n.id !== id))
      setTemplateNewsletters(templateNewsletters.filter((n) => n.id !== id))
      setSuccessMessage('電子報已刪除')
    } catch (err) {
      const message = err instanceof AdminServiceError ? err.message : err instanceof Error ? err.message : '刪除失敗'
      setNewsletterError(message)
    }
  }

  const handleFilterChange = (filters: NewsletterFilterOptions) => {
    console.log('篩選條件已變更：', filters)
  }

  const displayedNewsletters = showTemplateList ? templateNewsletters : newsletters

  const newsletterSummary = [
    {
      key: 'draft',
      label: '草稿',
      hint: '尚未發布',
      count: newsletters.filter((n) => n.status === 'draft').length,
      tone: 'border-waldorf-peach-200 bg-waldorf-peach-50/70 text-waldorf-peach-700',
    },
    {
      key: 'published',
      label: '已發布',
      hint: '已寄送給家長',
      count: newsletters.filter((n) => n.status === 'published').length,
      tone: 'border-waldorf-sage-200 bg-waldorf-sage-50/70 text-waldorf-sage-700',
    },
    {
      key: 'archived',
      label: '已封存',
      hint: '歷史期數',
      count: newsletters.filter((n) => n.status === 'archived').length,
      tone: 'border-waldorf-cream-300 bg-waldorf-cream-100/70 text-waldorf-clay-600',
    },
    {
      key: 'templates',
      label: '模板',
      hint: '可重複使用的結構',
      count: templateNewsletters.length,
      tone: 'border-waldorf-lavender-200 bg-waldorf-lavender-50/70 text-waldorf-lavender-700',
    },
  ]

  // --- User Functions ---

  const fetchUsers = async () => {
    try {
      setIsUserLoading(true)
      const data = await adminService.fetchUsers()

      const usersWithSessions = await Promise.all(
        (data as Array<{
          id: string
          email: string
          name?: string
          role: AccessControlRole
          lastLoginAt?: string | null
        }>).map(async (userData) => {
          try {
            const sessions = await adminSessionService.getUserSessions(userData.id)
            return {
              id: userData.id,
              email: userData.email,
              role: userData.role,
              display_name: userData.name,
              last_seen: userData.lastLoginAt ?? undefined,
              hasActiveSessions: sessions.length > 0,
            }
          } catch (err) {
            console.error(`Error fetching sessions for user ${userData.id}:`, err)
            return {
              id: userData.id,
              email: userData.email,
              role: userData.role,
              display_name: userData.name,
              last_seen: userData.lastLoginAt ?? undefined,
            }
          }
        })
      )

      setUsers(usersWithSessions)
      setSelectedUserIds([])
      setBulkPreview([])

      const teacherUsers = usersWithSessions.filter((userData) => userData.role === 'teacher')
      const classScopes = await Promise.all(
        teacherUsers.map(async (teacher) => {
          try {
            const classIds = await adminService.fetchUserClassRestrictions(teacher.id, teacher.role)
            return [teacher.id, classIds] as const
          } catch (err) {
            console.error(`Error fetching class scope for user ${teacher.id}:`, err)
            return [teacher.id, []] as const
          }
        }),
      )
      setUserClassScopes(Object.fromEntries(classScopes))
    } catch (err: unknown) {
      console.error('取得使用者時發生錯誤：', err)
      setUserError(err instanceof Error ? err.message : '無法取得使用者')
    } finally {
      setIsUserLoading(false)
    }
  }

  const handleForceLogout = async (userId: string) => {
    if (!confirm('要強制此使用者從所有裝置登出嗎？')) return

    try {
      setDeletingId(userId)
      const success = await adminSessionService.forceLogoutUser(userId, user?.id || '')

      if (success) {
        setSuccessMessage('已將使用者從所有裝置登出')
        await fetchUsers()
      } else {
        setUserError('無法強制使用者登出')
      }
    } catch (err: unknown) {
      console.error('強制使用者登出時發生錯誤：', err)
      setUserError(
        `強制登出失敗：${err instanceof Error ? err.message : '未知錯誤'}`,
      )
    } finally {
      setDeletingId(null)
    }
  }

  const toggleUserSelection = (userId: string) => {
    setSelectedUserIds((current) =>
      current.includes(userId)
        ? current.filter((id) => id !== userId)
        : [...current, userId],
    )
  }

  const toggleSelectAllUsers = () => {
    setSelectedUserIds((current) =>
      current.length === users.length ? [] : users.map((userData) => userData.id),
    )
  }

  const handlePreviewBulkRoleUpdate = async () => {
    if (selectedUserIds.length === 0) return
    try {
      setIsBulkPreviewLoading(true)
      setUserError(null)
      const preview = await adminService.previewBulkPermissionUpdate(selectedUserIds, [bulkRoleTarget])
      setBulkPreview(preview)
    } catch (err: unknown) {
      console.error('預覽批次角色變更時發生錯誤：', err)
      setUserError(
        `預覽批次更新失敗：${err instanceof Error ? err.message : '未知錯誤'}`,
      )
    } finally {
      setIsBulkPreviewLoading(false)
    }
  }

  const handleApplyBulkRoleUpdate = async () => {
    if (selectedUserIds.length === 0) return
    if (!window.confirm(`要將角色「${bulkRoleTarget}」套用至選取的 ${selectedUserIds.length} 位使用者嗎？`)) return

    try {
      setIsBulkApplying(true)
      setUserError(null)
      const results = await adminService.applyBulkPermissionUpdate(selectedUserIds, [bulkRoleTarget], {
        actorId: user?.id,
      })
      const failed = results.filter((result) => !result.success)
      if (failed.length > 0) {
        setUserError(`批次更新完成，${failed.length} 位使用者更新失敗。`)
      } else {
        setSuccessMessage(`已更新 ${results.length} 位使用者的角色。`)
      }
      await fetchUsers()
    } catch (err: unknown) {
      console.error('套用批次角色變更時發生錯誤：', err)
      setUserError(
        `套用批次更新失敗：${err instanceof Error ? err.message : '未知錯誤'}`,
      )
    } finally {
      setIsBulkApplying(false)
    }
  }

  const handleEditClassRestrictions = async (userData: UserData) => {
    if (userData.role !== 'teacher') return

    const currentClassIds = userClassScopes[userData.id] || []
    const input = window.prompt(
      '請輸入此教師的班級 ID，並以逗號分隔（留空可清除）：',
      currentClassIds.join(', ')
    )
    if (input === null) return

    const classIds = input
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean)

    try {
      setUpdatingId(userData.id)
      setUserError(null)
      await adminService.updateUserAccessControl(userData.id, ['teacher'], classIds, {
        actorId: user?.id,
        auditAction: 'class_scope_update',
      })
      setUserClassScopes((current) => ({ ...current, [userData.id]: classIds }))
      setSuccessMessage('班級限制已更新')
    } catch (err: unknown) {
      console.error('更新班級限制時發生錯誤：', err)
      setUserError(
        `更新班級限制失敗：${err instanceof Error ? err.message : '未知錯誤'}`,
      )
    } finally {
      setUpdatingId(null)
    }
  }

  const updateUserRole = async (userId: string, newRole: AccessControlRole) => {
    try {
      setUpdatingId(userId)
      const currentClassIds = userClassScopes[userId] || []
      const nextClassIds = newRole === 'teacher' ? currentClassIds : []

      await adminService.updateUserAccessControl(userId, [newRole], nextClassIds, {
        actorId: user?.id,
      })

      setUsers(users.map(u => u.id === userId ? { ...u, role: newRole } : u))
      if (newRole !== 'teacher') {
        setUserClassScopes((current) => ({ ...current, [userId]: [] }))
      }
      setSuccessMessage('使用者角色已更新')
    } catch (err: unknown) {
      console.error('更新角色時發生錯誤：', err)
      setUserError(
        `更新角色失敗：${err instanceof Error ? err.message : '未知錯誤'}`,
      )
    } finally {
      setUpdatingId(null)
    }
  }

  const handleDeleteUser = async (userId: string) => {
    if (!confirm('確定要刪除此使用者嗎？此操作無法復原。')) return

    try {
      setDeletingId(userId)
      await adminService.deleteUser(userId)

      setUsers(users.filter(u => u.id !== userId))
      setSuccessMessage('使用者已刪除')
    } catch (err: unknown) {
      console.error('刪除使用者時發生錯誤：', err)
      setUserError(
        `刪除使用者失敗：${err instanceof Error ? err.message : '未知錯誤'}`,
      )
    } finally {
      setDeletingId(null)
    }
  }

  const handleEditUser = (userData: UserData) => {
    setEditingUser(userData)
    setIsEditModalOpen(true)
  }

  // --- Render ---

  return (
    <ErrorBoundary>
      <AdminLayout
        activeTab={activeTab}
        title={activeTab === 'users' ? '使用者管理' : '電子報'}
        description={
          activeTab === 'users'
              ? '此處僅供查閱歷史紀錄；角色與使用資格由 SMZ Auth 管理。'
              : '建立草稿 → 編排文章 → 預覽郵件 → 發布寄送。點選任一期進入編排頁。'
        }
        headerAction={
          activeTab === 'newsletters' ? (
            <button
              onClick={handleCreateNewsletter}
              className="group px-5 py-2.5 bg-gradient-to-r from-waldorf-peach-500 to-waldorf-peach-600 text-white rounded-xl hover:from-waldorf-peach-600 hover:to-waldorf-peach-700 transition-all duration-300 font-medium shadow-lg shadow-waldorf-peach-200/50 flex items-center space-x-2"
              data-testid="create-newsletter-btn"
            >
              <svg className="w-5 h-5 transform group-hover:rotate-90 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              <span>建立電子報</span>
            </button>
          ) : activeTab === 'users' ? (
            <button
              disabled
              onClick={() => setIsAddModalOpen(true)}
              className="group px-5 py-2.5 bg-gradient-to-r from-waldorf-peach-500 to-waldorf-peach-600 text-white rounded-xl hover:from-waldorf-peach-600 hover:to-waldorf-peach-700 transition-all duration-300 font-medium shadow-lg shadow-waldorf-peach-200/50 flex items-center space-x-2"
            >
              <svg className="w-5 h-5 transform group-hover:rotate-90 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              <span>新增使用者</span>
            </button>
          ) : null
        }
      >

          {/* Success Message */}
          {successMessage && (
            <div className="mb-6 p-4 bg-waldorf-sage-50 border border-waldorf-sage-200 rounded-xl animate-fade-in-up">
              <div className="flex items-center">
                <svg className="w-5 h-5 text-waldorf-sage-500 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-waldorf-sage-700 font-medium">{successMessage}</p>
              </div>
            </div>
          )}

          {/* Suspicious Activity Alert */}
          {suspiciousUsers.length > 0 && (
            <div className="mb-6 p-4 bg-waldorf-rose-50 border border-waldorf-rose-200 rounded-xl animate-fade-in-up">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="w-6 h-6 text-waldorf-rose-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-semibold text-waldorf-rose-800">
                    偵測到可疑活動： {suspiciousUsers.length} 位使用者多次登入失敗
                  </p>
                  <ul className="mt-2 list-disc list-inside text-sm text-waldorf-rose-700">
                    {suspiciousUsers.map((su) => (
                      <li key={su.userId}>
                        使用者 {su.userId.substring(0, 8)}……已有 {su.failureCount} 次失敗紀錄
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* Content Area */}
          <div className="animate-fade-in">
            {/* Newsletters Tab */}
            {activeTab === 'newsletters' && (
              <>
                {!isNewsletterLoading && !newsletterError && (
                  <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
                    {newsletterSummary.map((item) => (
                      <div
                        key={item.key}
                        className={`rounded-xl border px-4 py-3 ${item.tone} ${
                          item.key === 'templates' && showTemplateList ? 'ring-2 ring-waldorf-lavender-300' : ''
                        }`}
                      >
                        <p className="text-xs font-semibold uppercase tracking-wider opacity-80">{item.label}</p>
                        <p className="mt-1 font-display text-3xl font-semibold leading-none">{item.count}</p>
                        <p className="mt-1 text-[11px] opacity-70">{item.hint}</p>
                      </div>
                    ))}
                  </div>
                )}
                <NewsletterTable
                  newsletters={displayedNewsletters}
                  isLoading={isNewsletterLoading}
                  error={newsletterError}
                  onEdit={handleEdit}
                  onPublish={handlePublish}
                  onArchive={handleArchive}
                  onDelete={handleDelete}
                  onCreateTemplate={handleCreateTemplate}
                  onFilterChange={handleFilterChange}
                  onTemplateListToggle={() => setShowTemplateList((prev) => !prev)}
                  templateToggleLabel={showTemplateList ? '返回電子報列表' : '模板列表'}
                />
              </>
            )}

            {/* Users Tab */}
            {activeTab === 'users' && (
              <>
                <p className="mb-4 rounded border bg-white p-4">登入資格、角色和班級關係由 <a className="underline" href={new URL('/', smzAuthIssuer()).toString()}>SMZ Auth</a> 管理。以下為唯讀歷史資料。</p>
                <fieldset disabled className="opacity-60">
                <div className="flex justify-between items-center mb-8">
                  <div>
                    <h2 className="font-display text-2xl font-semibold text-waldorf-clay-800">使用者管理</h2>
                    <p className="text-waldorf-clay-500 mt-1">{users.length} 位使用者</p>
                  </div>
                  <div className="flex gap-3">
                    {userManagementMode === 'table' && (
                      <button
                        onClick={() => setUserManagementMode('batch-import')}
                        className="px-4 py-2 border border-waldorf-peach-300 text-waldorf-peach-600 rounded-lg font-medium hover:bg-waldorf-peach-50 hover:border-waldorf-peach-400 transition-colors duration-200"
                        title="從 CSV 檔案匯入多位使用者"
                      >
                        📥 批次匯入
                      </button>
                    )}
                    {userManagementMode === 'batch-import' && (
                      <button
                        onClick={() => setUserManagementMode('table')}
                        className="px-4 py-2 bg-gradient-to-r from-waldorf-peach-500 to-waldorf-peach-600 text-white rounded-lg font-medium hover:from-waldorf-peach-600 hover:to-waldorf-peach-700 transition-colors duration-200"
                      >
                        ← 返回使用者列表
                      </button>
                    )}
                  </div>
                </div>

                {userError && (
                  <div className="mb-6 p-4 bg-waldorf-rose-50 border border-waldorf-rose-200 rounded-xl">
                    <p className="text-waldorf-rose-800 font-semibold">錯誤</p>
                    <p className="text-waldorf-rose-600 text-sm mt-1">{userError}</p>
                  </div>
                )}

                {userManagementMode === 'table' ? (
                  isUserLoading ? (
                    <div className="flex items-center justify-center py-16">
                      <LoadingSpinner />
                    </div>
                  ) : (
                    <div>
                      <div className="mb-4 p-4 rounded-xl border border-waldorf-cream-200 bg-waldorf-cream-50">
                        <div className="flex flex-wrap items-center gap-3">
                          <span className="text-sm font-medium text-waldorf-clay-700">
                            {selectedUserIds.length} 已選取
                          </span>
                          <select
                            value={bulkRoleTarget}
                            onChange={(e) => setBulkRoleTarget(e.target.value as AccessControlRole)}
                            className="px-3 py-2 text-sm border border-waldorf-cream-300 rounded-lg bg-white"
                          >
                            {ACCESS_CONTROL_ROLE_OPTIONS.map((role) => (
                              <option key={role} value={role}>{role}</option>
                            ))}
                          </select>
                          <button
                            onClick={handlePreviewBulkRoleUpdate}
                            disabled={selectedUserIds.length === 0 || isBulkPreviewLoading}
                            className="px-3 py-2 text-sm border border-waldorf-peach-300 text-waldorf-peach-700 rounded-lg disabled:opacity-50"
                          >
                            {isBulkPreviewLoading ? '預覽中...' : '預覽批次更新'}
                          </button>
                          <button
                            onClick={handleApplyBulkRoleUpdate}
                            disabled={selectedUserIds.length === 0 || isBulkApplying}
                            className="px-3 py-2 text-sm bg-waldorf-peach-600 text-white rounded-lg disabled:opacity-50"
                          >
                            {isBulkApplying ? '套用中...' : '套用批次更新'}
                          </button>
                        </div>
                        {bulkPreview.length > 0 && (
                          <p className="mt-2 text-xs text-waldorf-clay-500">
                            預覽已準備完成，共 {bulkPreview.length} 位使用者，角色將改為「{bulkRoleTarget}".
                          </p>
                        )}
                      </div>

                      <div className="overflow-hidden rounded-xl border border-waldorf-cream-200 shadow-sm">
                      <table className="min-w-full">
                        <thead className="bg-gradient-to-r from-waldorf-cream-100 to-waldorf-cream-50">
                          <tr>
                            <th scope="col" className="px-4 py-4 text-left text-xs font-semibold text-waldorf-clay-600 uppercase tracking-wider">
                              <input
                                type="checkbox"
                                checked={users.length > 0 && selectedUserIds.length === users.length}
                                onChange={toggleSelectAllUsers}
                                aria-label="全選使用者"
                              />
                            </th>
                            <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-waldorf-clay-600 uppercase tracking-wider">使用者</th>
                            <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-waldorf-clay-600 uppercase tracking-wider">角色</th>
                            <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-waldorf-clay-600 uppercase tracking-wider">狀態</th>
                            <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-waldorf-clay-600 uppercase tracking-wider">變更角色</th>
                            <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-waldorf-clay-600 uppercase tracking-wider">班級範圍</th>
                            <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-waldorf-clay-600 uppercase tracking-wider">操作</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-waldorf-cream-100">
                          {users.map((userData, index) => (
                            <tr
                              key={userData.id}
                              className="hover:bg-waldorf-cream-50/50 transition-colors duration-200"
                              style={{ animationDelay: `${index * 50}ms` }}
                            >
                              <td className="px-4 py-4 whitespace-nowrap text-sm">
                                <input
                                  type="checkbox"
                                  checked={selectedUserIds.includes(userData.id)}
                                  onChange={() => toggleUserSelection(userData.id)}
                                  aria-label={`Select ${userData.email}`}
                                />
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="flex items-center">
                                  <div className="flex-shrink-0 h-11 w-11">
                                    <div className="h-11 w-11 rounded-full bg-gradient-to-br from-waldorf-peach-400 to-waldorf-clay-400 flex items-center justify-center text-white font-semibold text-lg shadow-md">
                                      {userData.display_name?.[0] || userData.email?.[0]?.toUpperCase() || '?'}
                                    </div>
                                  </div>
                                  <div className="ml-4">
                                    <div className="text-sm font-semibold text-waldorf-clay-800">{userData.display_name || '未提供姓名'}</div>
                                    <div className="text-sm text-waldorf-clay-400">{userData.email}</div>
                                  </div>
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <span className={`px-3 py-1 inline-flex text-xs font-semibold rounded-full border ${
                                  ROLE_COLORS[userData.role] || 'bg-waldorf-cream-100 text-waldorf-clay-600 border-waldorf-cream-200'
                                }`}>
                                  {userData.role}
                                </span>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm">
                                {userData.id === user?.id ? (
                                  <span className="flex items-center text-waldorf-sage-600 font-medium">
                                    <span className="w-2 h-2 rounded-full bg-waldorf-sage-400 mr-2 animate-pulse" />
                                    目前使用者
                                  </span>
                                ) : userData.hasActiveSessions ? (
                                  <span className="flex items-center text-waldorf-sage-600 font-medium">
                                    <span className="w-2 h-2 rounded-full bg-waldorf-sage-400 mr-2 animate-pulse" />
                                    有效工作階段
                                  </span>
                                ) : (
                                  <span className="text-waldorf-clay-400">無有效工作階段</span>
                                )}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm">
                                <select
                                  value={userData.role}
                                  onChange={(e) => updateUserRole(userData.id, e.target.value as AccessControlRole)}
                                  disabled={updatingId === userData.id || userData.id === user?.id}
                                  className="block w-full px-3 py-2 text-sm border border-waldorf-cream-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-waldorf-peach-300 focus:border-waldorf-peach-400 disabled:bg-waldorf-cream-100 disabled:cursor-not-allowed transition-all duration-200"
                                >
                                  {ACCESS_CONTROL_ROLE_OPTIONS.map((role) => (
                                    <option key={role} value={role}>{role}</option>
                                  ))}
                                </select>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-waldorf-clay-600">
                                {userData.role === 'teacher' ? (
                                  <div className="flex items-center gap-2">
                                    <span>
                                      {(userClassScopes[userData.id] || []).length > 0
                                        ? userClassScopes[userData.id].join(', ')
                                        : '沒有班級限制'}
                                    </span>
                                    <button
                                      onClick={() => handleEditClassRestrictions(userData)}
                                      disabled={updatingId === userData.id}
                                      className="text-waldorf-peach-600 hover:text-waldorf-peach-700 disabled:opacity-50"
                                    >
                                      編輯
                                    </button>
                                  </div>
                                ) : (
                                  <span className="text-waldorf-clay-400">N/A</span>
                                )}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-3">
                                <button
                                  onClick={() => handleEditUser(userData)}
                                  className="text-waldorf-clay-500 hover:text-waldorf-clay-700 transition-colors duration-200"
                                >
                                  編輯
                                </button>
                                {userData.id !== user?.id && (
                                  <>
                                    {userData.hasActiveSessions && (
                                      <button
                                        onClick={() => handleForceLogout(userData.id)}
                                        disabled={deletingId === userData.id}
                                        className="text-waldorf-peach-600 hover:text-waldorf-peach-700 disabled:opacity-50 transition-colors duration-200"
                                      >
                                        {deletingId === userData.id ? '登出中...' : '強制登出'}
                                      </button>
                                    )}
                                    <button
                                      onClick={() => handleDeleteUser(userData.id)}
                                      disabled={deletingId === userData.id}
                                      className="text-waldorf-rose-500 hover:text-waldorf-rose-700 disabled:opacity-50 transition-colors duration-200"
                                    >
                                      {deletingId === userData.id ? '刪除中...' : '刪除'}
                                    </button>
                                    </>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    </div>
                  )
                ) : (
                  <div className="overflow-hidden rounded-xl border border-waldorf-cream-200 shadow-sm bg-white p-6">
                    <h3 className="text-lg font-semibold text-waldorf-clay-800 mb-6">從 CSV 匯入使用者</h3>
                    <BatchImportForm
                      onImportComplete={() => {
                        fetchUsers()
                        setUserManagementMode('table')
                      }}
                    />
                  </div>
                )}
                </fieldset>
              </>
            )}


          </div>
      </AdminLayout>

        <AddUserModal
          isOpen={isAddModalOpen}
          onClose={() => setIsAddModalOpen(false)}
          onUserAdded={fetchUsers}
        />

        <EditUserModal
          isOpen={isEditModalOpen}
          onClose={() => {
            setIsEditModalOpen(false)
            setEditingUser(null)
          }}
          userData={editingUser}
          onUserUpdated={fetchUsers}
        />

    </ErrorBoundary>
  )
}

export default AdminDashboardPage
