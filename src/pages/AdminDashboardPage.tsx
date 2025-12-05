/**
 * Admin Dashboard Page
 * Main page for admin users to manage newsletters, users, and view audit logs
 *
 * Features:
 * - Tabbed interface for Newsletters, Users, and Audit Logs
 * - Newsletter management (CRUD)
 * - User management (Add, Edit, Delete, Force Logout)
 * - Audit log viewing
 */

import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import type { AdminNewsletter, NewsletterFilterOptions } from '@/types/admin'
import { adminService, AdminServiceError } from '@/services/adminService'
import NewsletterTable from '@/components/admin/NewsletterTable'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import { getSupabaseClient, getSupabaseServiceClient } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { UserRole } from '@/types/auth'
import { ROLES } from '@/lib/rbac'
import { AuditLogViewer } from '@/components/AuditLogViewer'
import { adminSessionService } from '@/services/adminSessionService'
import { AdminLayout } from '@/components/admin/AdminLayout'
import { BatchImportForm } from '@/components/admin/BatchImportForm'

// --- Types ---

interface UserData {
  id: string
  email: string
  role: UserRole
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
  const [role, setRole] = useState<UserRole>('parent')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsSubmitting(true)

    try {
      // Use service role client for admin operations
      const supabaseAdmin = getSupabaseServiceClient()

      // Create auth user using admin API (doesn't affect current session)
      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email,
        email_confirm: true,
      })

      if (authError) throw authError
      if (!authData.user) throw new Error('No user returned from signup')

      // Create user_roles entry using service role client (bypasses RLS)
      const { error: roleError } = await supabaseAdmin
        .from('user_roles')
        .insert({
          id: authData.user.id,
          email: email,
          role: role,
        })

      if (roleError) throw roleError

      // Success
      setEmail('')
      setRole('parent')
      onUserAdded()
      onClose()
    } catch (err: any) {
      console.error('Error creating user:', err)
      setError(err.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-waldorf-clay-900/40 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in">
      <div className="bg-white rounded-2xl p-8 max-w-md w-full mx-4 shadow-2xl shadow-waldorf-clay-200/50 border border-waldorf-cream-200 animate-scale-in">
        <h2 className="font-display text-2xl font-semibold text-waldorf-clay-800 mb-6">Add New User</h2>

        {error && (
          <div className="bg-waldorf-rose-50 border border-waldorf-rose-200 text-waldorf-rose-700 px-4 py-3 rounded-xl mb-6">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="mb-5">
            <label className="block text-sm font-medium text-waldorf-clay-600 mb-2">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-4 py-3 border border-waldorf-cream-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-waldorf-peach-300 focus:border-waldorf-peach-400 transition-all duration-200 bg-waldorf-cream-50/50"
            />
            <p className="text-xs text-waldorf-clay-400 mt-2">User will receive a magic link to set up their account</p>
          </div>

          <div className="mb-8">
            <label className="block text-sm font-medium text-waldorf-clay-600 mb-2">Role</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as UserRole)}
              className="w-full px-4 py-3 border border-waldorf-cream-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-waldorf-peach-300 focus:border-waldorf-peach-400 transition-all duration-200 bg-waldorf-cream-50/50"
            >
              {Object.values(ROLES).map((r) => (
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
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2.5 text-white bg-gradient-to-r from-waldorf-peach-500 to-waldorf-peach-600 rounded-xl hover:from-waldorf-peach-600 hover:to-waldorf-peach-700 disabled:opacity-50 transition-all duration-200 font-medium shadow-lg shadow-waldorf-peach-200/50"
            >
              {isSubmitting ? 'Creating...' : 'Create User'}
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
      const supabase = getSupabaseClient()

      const { error: updateError } = await supabase
        .from('user_roles')
        .update({ display_name: displayName || null })
        .eq('id', userData.id)

      if (updateError) throw updateError

      onUserUpdated()
      onClose()
    } catch (err: any) {
      console.error('Error updating user:', err)
      setError(err.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!isOpen || !userData) return null

  return (
    <div className="fixed inset-0 bg-waldorf-clay-900/40 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in">
      <div className="bg-white rounded-2xl p-8 max-w-md w-full mx-4 shadow-2xl shadow-waldorf-clay-200/50 border border-waldorf-cream-200 animate-scale-in">
        <h2 className="font-display text-2xl font-semibold text-waldorf-clay-800 mb-6">Edit User</h2>

        {error && (
          <div className="bg-waldorf-rose-50 border border-waldorf-rose-200 text-waldorf-rose-700 px-4 py-3 rounded-xl mb-6">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="mb-5">
            <label className="block text-sm font-medium text-waldorf-clay-600 mb-2">Email</label>
            <input
              type="email"
              value={userData.email}
              disabled
              className="w-full px-4 py-3 border border-waldorf-cream-300 rounded-xl bg-waldorf-cream-100 cursor-not-allowed text-waldorf-clay-400"
            />
          </div>

          <div className="mb-8">
            <label className="block text-sm font-medium text-waldorf-clay-600 mb-2">Display Name</label>
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
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2.5 text-white bg-gradient-to-r from-waldorf-peach-500 to-waldorf-peach-600 rounded-xl hover:from-waldorf-peach-600 hover:to-waldorf-peach-700 disabled:opacity-50 transition-all duration-200 font-medium shadow-lg shadow-waldorf-peach-200/50"
            >
              {isSubmitting ? 'Updating...' : 'Update'}
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
}

/**
 * Admin Dashboard Page Component
 */
export function AdminDashboardPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { user } = useAuth()

  // Tab state derived from URL
  const tabParam = searchParams.get('tab')
  const activeTab = (tabParam === 'users' || tabParam === 'audit') ? tabParam : 'newsletters'

  // Newsletter state
  const [newsletters, setNewsletters] = useState<AdminNewsletter[]>([])
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

  // Check for suspicious activity
  useEffect(() => {
    const checkSuspicious = async () => {
      try {
        const suspicious = await adminSessionService.detectSuspiciousActivity()
        setSuspiciousUsers(suspicious)
      } catch (err) {
        console.error('Error detecting suspicious activity:', err)
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
      const data = await adminService.fetchNewsletters()
      setNewsletters(data)
    } catch (err) {
      const message = err instanceof AdminServiceError ? err.message : err instanceof Error ? err.message : '無法載入電子報'
      setNewsletterError(message)
      console.error('Failed to load newsletters:', err)
    } finally {
      setIsNewsletterLoading(false)
    }
  }

  const handleCreateNewsletter = () => {
    navigate('/admin/newsletter/create')
  }

  const handleEdit = (id: string) => {
    const newsletter = newsletters.find((n) => n.id === id)
    if (newsletter) {
      navigate(`/admin/articles/${newsletter.weekNumber}`, {
        state: { newsletterId: id },
      })
    }
  }

  const handlePublish = async (id: string) => {
    try {
      setNewsletterError(null)
      const updated = await adminService.publishNewsletter(id)
      setNewsletters(newsletters.map((n) => (n.id === id ? updated : n)))
      setSuccessMessage('電子報已發布')
    } catch (err) {
      const message = err instanceof AdminServiceError ? err.message : err instanceof Error ? err.message : '發布失敗'
      setNewsletterError(message)
    }
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
      setSuccessMessage('電子報已刪除')
    } catch (err) {
      const message = err instanceof AdminServiceError ? err.message : err instanceof Error ? err.message : '刪除失敗'
      setNewsletterError(message)
    }
  }

  const handleFilterChange = (filters: NewsletterFilterOptions) => {
    console.log('Filter change:', filters)
  }

  // --- User Functions ---

  const fetchUsers = async () => {
    try {
      setIsUserLoading(true)
      const supabase = getSupabaseClient()

      const { data, error } = await supabase
        .from('user_roles')
        .select('*')
        .order('role', { ascending: true })

      if (error) throw error

      const usersWithSessions = await Promise.all(
        (data as UserData[]).map(async (userData) => {
          try {
            const sessions = await adminSessionService.getUserSessions(userData.id)
            return {
              ...userData,
              hasActiveSessions: sessions.length > 0,
            }
          } catch (err) {
            console.error(`Error fetching sessions for user ${userData.id}:`, err)
            return userData
          }
        })
      )

      setUsers(usersWithSessions)
    } catch (err: any) {
      console.error('Error fetching users:', err)
      setUserError(err.message)
    } finally {
      setIsUserLoading(false)
    }
  }

  const handleForceLogout = async (userId: string) => {
    if (!confirm('Force logout this user from all devices?')) return

    try {
      setDeletingId(userId)
      const success = await adminSessionService.forceLogoutUser(userId, user?.id || '')

      if (success) {
        setSuccessMessage('User successfully logged out from all devices')
        await fetchUsers()
      } else {
        setUserError('Failed to force logout user')
      }
    } catch (err: any) {
      console.error('Error force logging out user:', err)
      setUserError(`Failed to force logout: ${err.message}`)
    } finally {
      setDeletingId(null)
    }
  }

  const updateUserRole = async (userId: string, newRole: UserRole) => {
    try {
      setUpdatingId(userId)
      const supabaseAdmin = getSupabaseServiceClient()

      const { error } = await supabaseAdmin
        .from('user_roles')
        .update({ role: newRole })
        .eq('id', userId)

      if (error) throw error

      setUsers(users.map(u => u.id === userId ? { ...u, role: newRole } : u))
      setSuccessMessage('User role updated')
    } catch (err: any) {
      console.error('Error updating role:', err)
      setUserError(`Failed to update role: ${err.message}`)
    } finally {
      setUpdatingId(null)
    }
  }

  const handleDeleteUser = async (userId: string) => {
    if (!confirm('Are you sure you want to delete this user? This action cannot be undone.')) return

    try {
      setDeletingId(userId)
      const supabase = getSupabaseClient()

      const { error: roleError } = await supabase
        .from('user_roles')
        .delete()
        .eq('id', userId)

      if (roleError) throw roleError

      setUsers(users.filter(u => u.id !== userId))
      setSuccessMessage('User deleted')
    } catch (err: any) {
      console.error('Error deleting user:', err)
      setUserError(`Failed to delete user: ${err.message}`)
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
              <span>Create Newsletter</span>
            </button>
          ) : activeTab === 'users' ? (
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="group px-5 py-2.5 bg-gradient-to-r from-waldorf-peach-500 to-waldorf-peach-600 text-white rounded-xl hover:from-waldorf-peach-600 hover:to-waldorf-peach-700 transition-all duration-300 font-medium shadow-lg shadow-waldorf-peach-200/50 flex items-center space-x-2"
            >
              <svg className="w-5 h-5 transform group-hover:rotate-90 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              <span>Add User</span>
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
                    Suspicious activity detected: {suspiciousUsers.length} user(s) with multiple failed login attempts
                  </p>
                  <ul className="mt-2 list-disc list-inside text-sm text-waldorf-rose-700">
                    {suspiciousUsers.map((su) => (
                      <li key={su.userId}>
                        User {su.userId.substring(0, 8)}... has {su.failureCount} failed attempts
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
                {newsletterError && (
                  <div className="mb-6 p-4 bg-waldorf-rose-50 border border-waldorf-rose-200 rounded-xl">
                    <p className="text-waldorf-rose-800 font-semibold">Error</p>
                    <p className="text-waldorf-rose-600 text-sm mt-1">{newsletterError}</p>
                  </div>
                )}
                <NewsletterTable
                  newsletters={newsletters}
                  isLoading={isNewsletterLoading}
                  error={newsletterError}
                  onEdit={handleEdit}
                  onPublish={handlePublish}
                  onArchive={handleArchive}
                  onDelete={handleDelete}
                  onFilterChange={handleFilterChange}
                />
              </>
            )}

            {/* Users Tab */}
            {activeTab === 'users' && (
              <>
                <div className="flex justify-between items-center mb-8">
                  <div>
                    <h2 className="font-display text-2xl font-semibold text-waldorf-clay-800">User Management</h2>
                    <p className="text-waldorf-clay-500 mt-1">{users.length} users found</p>
                  </div>
                  <div className="flex gap-3">
                    {userManagementMode === 'table' && (
                      <button
                        onClick={() => setUserManagementMode('batch-import')}
                        className="px-4 py-2 border border-waldorf-clay-300 text-waldorf-clay-600 rounded-lg font-medium hover:bg-waldorf-cream-50 transition-colors"
                        title="Import multiple users from CSV file"
                      >
                        📥 Batch Import
                      </button>
                    )}
                    {userManagementMode === 'batch-import' && (
                      <button
                        onClick={() => setUserManagementMode('table')}
                        className="px-4 py-2 bg-waldorf-sage-600 text-white rounded-lg font-medium hover:bg-waldorf-sage-700 transition-colors"
                      >
                        ← Back to User List
                      </button>
                    )}
                  </div>
                </div>

                {userError && (
                  <div className="mb-6 p-4 bg-waldorf-rose-50 border border-waldorf-rose-200 rounded-xl">
                    <p className="text-waldorf-rose-800 font-semibold">Error</p>
                    <p className="text-waldorf-rose-600 text-sm mt-1">{userError}</p>
                  </div>
                )}

                {userManagementMode === 'table' ? (
                  isUserLoading ? (
                    <div className="flex items-center justify-center py-16">
                      <LoadingSpinner />
                    </div>
                  ) : (
                    <div className="overflow-hidden rounded-xl border border-waldorf-cream-200 shadow-sm">
                      <table className="min-w-full">
                        <thead className="bg-gradient-to-r from-waldorf-cream-100 to-waldorf-cream-50">
                          <tr>
                            <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-waldorf-clay-600 uppercase tracking-wider">User</th>
                            <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-waldorf-clay-600 uppercase tracking-wider">Role</th>
                            <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-waldorf-clay-600 uppercase tracking-wider">Status</th>
                            <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-waldorf-clay-600 uppercase tracking-wider">Change Role</th>
                            <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-waldorf-clay-600 uppercase tracking-wider">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-waldorf-cream-100">
                          {users.map((userData, index) => (
                            <tr
                              key={userData.id}
                              className="hover:bg-waldorf-cream-50/50 transition-colors duration-200"
                              style={{ animationDelay: `${index * 50}ms` }}
                            >
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="flex items-center">
                                  <div className="flex-shrink-0 h-11 w-11">
                                    <div className="h-11 w-11 rounded-full bg-gradient-to-br from-waldorf-peach-400 to-waldorf-clay-400 flex items-center justify-center text-white font-semibold text-lg shadow-md">
                                      {userData.display_name?.[0] || userData.email?.[0]?.toUpperCase() || '?'}
                                    </div>
                                  </div>
                                  <div className="ml-4">
                                    <div className="text-sm font-semibold text-waldorf-clay-800">{userData.display_name || 'No Name'}</div>
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
                                    Current User
                                  </span>
                                ) : userData.hasActiveSessions ? (
                                  <span className="flex items-center text-waldorf-sage-600 font-medium">
                                    <span className="w-2 h-2 rounded-full bg-waldorf-sage-400 mr-2 animate-pulse" />
                                    Active Session
                                  </span>
                                ) : (
                                  <span className="text-waldorf-clay-400">No Active Session</span>
                                )}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm">
                                <select
                                  value={userData.role}
                                  onChange={(e) => updateUserRole(userData.id, e.target.value as UserRole)}
                                  disabled={updatingId === userData.id || userData.id === user?.id}
                                  className="block w-full px-3 py-2 text-sm border border-waldorf-cream-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-waldorf-peach-300 focus:border-waldorf-peach-400 disabled:bg-waldorf-cream-100 disabled:cursor-not-allowed transition-all duration-200"
                                >
                                  {Object.values(ROLES).map((role) => (
                                    <option key={role} value={role}>{role}</option>
                                  ))}
                                </select>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-3">
                                <button
                                  onClick={() => handleEditUser(userData)}
                                  className="text-waldorf-clay-500 hover:text-waldorf-clay-700 transition-colors duration-200"
                                >
                                  Edit
                                </button>
                                {userData.id !== user?.id && (
                                  <>
                                    {userData.hasActiveSessions && (
                                      <button
                                        onClick={() => handleForceLogout(userData.id)}
                                        disabled={deletingId === userData.id}
                                        className="text-waldorf-peach-600 hover:text-waldorf-peach-700 disabled:opacity-50 transition-colors duration-200"
                                      >
                                        {deletingId === userData.id ? 'Logging out...' : 'Force Logout'}
                                      </button>
                                    )}
                                    <button
                                      onClick={() => handleDeleteUser(userData.id)}
                                      disabled={deletingId === userData.id}
                                      className="text-waldorf-rose-500 hover:text-waldorf-rose-700 disabled:opacity-50 transition-colors duration-200"
                                    >
                                      {deletingId === userData.id ? 'Deleting...' : 'Delete'}
                                    </button>
                                  </>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )
                ) : (
                  <div className="overflow-hidden rounded-xl border border-waldorf-cream-200 shadow-sm bg-white p-6">
                    <h3 className="text-lg font-semibold text-waldorf-clay-800 mb-6">Import Users from CSV</h3>
                    <BatchImportForm
                      onImportComplete={() => {
                        fetchUsers()
                        setUserManagementMode('table')
                      }}
                    />
                  </div>
                )}
              </>
            )}

            {/* Audit Logs Tab */}
            {activeTab === 'audit' && (
              <AuditLogViewer />
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
