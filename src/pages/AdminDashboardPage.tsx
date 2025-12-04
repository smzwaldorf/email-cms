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
import { useNavigate, Link } from 'react-router-dom'
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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
        <h2 className="text-2xl font-bold mb-4">Add New User</h2>
        
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-waldorf-peach-500"
            />
            <p className="text-xs text-gray-500 mt-1">User will receive a magic link to set up their account</p>
          </div>

          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">Role</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as UserRole)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-waldorf-peach"
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
              className="px-4 py-2 text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 text-white bg-waldorf-peach-500 rounded-md hover:bg-opacity-90 disabled:opacity-50"
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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
        <h2 className="text-2xl font-bold mb-4">Edit User</h2>
        
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
            <input
              type="email"
              value={userData.email}
              disabled
              className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-100 cursor-not-allowed"
            />
          </div>

          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">Display Name</label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-waldorf-peach"
            />
          </div>

          <div className="flex justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 text-white bg-waldorf-peach-500 rounded-md hover:bg-opacity-90 disabled:opacity-50"
            >
              {isSubmitting ? 'Updating...' : 'Update'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

/**
 * Admin Dashboard Page Component
 */
export function AdminDashboardPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  
  // Tab state
  const [activeTab, setActiveTab] = useState<'newsletters' | 'users' | 'audit'>('newsletters')

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
  
  // Shared state
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [suspiciousUsers, setSuspiciousUsers] = useState<Array<{ userId: string; failureCount: number }>>([])
  const [latestWeek, setLatestWeek] = useState<number>(1)

  // --- Effects ---

  useEffect(() => {
    fetchLatestWeek()
  }, [])

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

  const fetchLatestWeek = async () => {
    try {
      const supabase = getSupabaseClient()
      const { data, error } = await supabase
        .from('newsletter_weeks')
        .select('week_number')
        .order('week_number', { ascending: false })
        .limit(1)
        .single()

      if (error) throw error
      if (data) {
        setLatestWeek(data.week_number)
      }
    } catch (err: any) {
      console.error('Error fetching latest week:', err)
    }
  }

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
      <div className="min-h-screen bg-gray-100 py-8 px-4">
        <div className="max-w-7xl mx-auto">
          {/* Navigation Toolbar */}
          <div className="mb-6 flex items-center justify-between bg-white shadow-sm rounded-lg px-4 py-3 border border-gray-200">
            <a
              href={`/week/${latestWeek}`}
              className="flex items-center text-gray-600 hover:text-blue-500 transition-colors"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Back to Weekly Articles
            </a>
            <div className="text-sm text-gray-500">
              Admin Dashboard
            </div>
          </div>

          {/* Page Header */}
          <div className="mb-8">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
                <p className="mt-1 text-gray-600">Manage newsletters, users, and system settings</p>
              </div>
              {activeTab === 'newsletters' && (
                <button
                  onClick={handleCreateNewsletter}
                  className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors font-medium"
                  data-testid="create-newsletter-btn"
                >
                  + Create Newsletter
                </button>
              )}
            </div>
          </div>

          {/* Success Message */}
          {successMessage && (
            <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-green-800 font-medium">{successMessage}</p>
            </div>
          )}

          {/* Suspicious Activity Alert */}
          {suspiciousUsers.length > 0 && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex">
                <div className="flex-shrink-0">
                  <span className="text-red-400">⚠️</span>
                </div>
                <div className="ml-3">
                  <p className="text-sm font-medium text-red-800">
                    Suspicious activity detected: {suspiciousUsers.length} user(s) with multiple failed login attempts
                  </p>
                  <ul className="mt-2 list-disc list-inside text-sm text-red-700">
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

          {/* Tab Navigation */}
          <div className="mb-6 border-b border-gray-200 bg-white rounded-t-lg">
            <nav className="flex space-x-8 px-6 flex-wrap" aria-label="Admin Navigation">
              <button
                onClick={() => setActiveTab('newsletters')}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'newsletters'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Newsletters
              </button>
              <button
                onClick={() => setActiveTab('users')}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'users'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                User Management
              </button>
              <button
                onClick={() => setActiveTab('audit')}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'audit'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Audit Logs
              </button>
              <div className="border-l border-gray-200 mx-2"></div>
              <Link
                to="/admin/classes"
                className="py-4 px-1 border-b-2 border-transparent font-medium text-sm text-gray-500 hover:text-gray-700 hover:border-gray-300 transition-colors"
                data-testid="classes-link"
              >
                Classes
              </Link>
              <Link
                to="/admin/families"
                className="py-4 px-1 border-b-2 border-transparent font-medium text-sm text-gray-500 hover:text-gray-700 hover:border-gray-300 transition-colors"
                data-testid="families-link"
              >
                Families
              </Link>
            </nav>
          </div>

          {/* Content Area */}
          <div className="bg-white shadow rounded-b-lg p-6 min-h-[500px]">
            {/* Newsletters Tab */}
            {activeTab === 'newsletters' && (
              <>
                {newsletterError && (
                  <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-red-800 font-medium">Error</p>
                    <p className="text-red-600 text-sm">{newsletterError}</p>
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
                <div className="flex justify-between items-center mb-6">
                  <div>
                    <h2 className="text-lg font-medium text-gray-900">User Management</h2>
                    <p className="text-sm text-gray-500 mt-1">{users.length} users found</p>
                  </div>
                  <button
                    onClick={() => setIsAddModalOpen(true)}
                    className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors"
                  >
                    + Add User
                  </button>
                </div>

                {userError && (
                  <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-red-800 font-medium">Error</p>
                    <p className="text-red-600 text-sm">{userError}</p>
                  </div>
                )}

                {isUserLoading ? (
                  <LoadingSpinner />
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Change Role</th>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {users.map((userData) => (
                          <tr key={userData.id}>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center">
                                <div className="flex-shrink-0 h-10 w-10">
                                  <div className="h-10 w-10 rounded-full bg-blue-500 flex items-center justify-center text-white font-bold">
                                    {userData.display_name?.[0] || userData.email?.[0]?.toUpperCase() || '?'}
                                  </div>
                                </div>
                                <div className="ml-4">
                                  <div className="text-sm font-medium text-gray-900">{userData.display_name || 'No Name'}</div>
                                  <div className="text-sm text-gray-500">{userData.email}</div>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full 
                                ${userData.role === 'admin' ? 'bg-purple-100 text-purple-800' : 
                                  userData.role === 'teacher' ? 'bg-green-100 text-green-800' : 
                                  userData.role === 'parent' ? 'bg-blue-100 text-blue-800' : 
                                  'bg-gray-100 text-gray-800'}`}>
                                {userData.role}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {userData.id === user?.id ? (
                                <span className="text-green-600 font-medium">Current User</span>
                              ) : userData.hasActiveSessions ? (
                                <span className="text-green-600 font-medium">Active Session</span>
                              ) : (
                                <span className="text-gray-400">No Active Session</span>
                              )}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              <select
                                value={userData.role}
                                onChange={(e) => updateUserRole(userData.id, e.target.value as UserRole)}
                                disabled={updatingId === userData.id || userData.id === user?.id}
                                className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
                              >
                                {Object.values(ROLES).map((role) => (
                                  <option key={role} value={role}>{role}</option>
                                ))}
                              </select>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                              <button
                                onClick={() => handleEditUser(userData)}
                                className="text-blue-600 hover:text-blue-900"
                              >
                                Edit
                              </button>
                              {userData.id !== user?.id && (
                                <>
                                  {userData.hasActiveSessions && (
                                    <button
                                      onClick={() => handleForceLogout(userData.id)}
                                      disabled={deletingId === userData.id}
                                      className="text-orange-600 hover:text-orange-900 disabled:opacity-50"
                                    >
                                      {deletingId === userData.id ? 'Logging out...' : 'Force Logout'}
                                    </button>
                                  )}
                                  <button
                                    onClick={() => handleDeleteUser(userData.id)}
                                    disabled={deletingId === userData.id}
                                    className="text-red-600 hover:text-red-900 disabled:opacity-50"
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
                )}
              </>
            )}

            {/* Audit Logs Tab */}
            {activeTab === 'audit' && (
              <AuditLogViewer />
            )}
          </div>
        </div>

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
      </div>
    </ErrorBoundary>
  )
}

export default AdminDashboardPage
