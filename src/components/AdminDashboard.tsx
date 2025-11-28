import React, { useEffect, useState } from 'react'
import { getSupabaseClient, getSupabaseServiceClient } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { UserRole } from '@/types/auth'
import { ROLES } from '@/lib/rbac'

interface UserData {
  id: string
  email: string
  role: UserRole
  display_name?: string
  last_seen?: string
}

interface AddUserModalProps {
  isOpen: boolean
  onClose: () => void
  onUserAdded: () => void
}

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

interface EditUserModalProps {
  isOpen: boolean
  onClose: () => void
  userData: UserData | null
  onUserUpdated: () => void
}


// Edit User Modal Component
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

export const AdminDashboard: React.FC = () => {
  const { user } = useAuth()
  const [users, setUsers] = useState<UserData[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<UserData | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [latestWeek, setLatestWeek] = useState<number>(1)

  useEffect(() => {
    fetchUsers()
    fetchLatestWeek()
  }, [])

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
      // Keep default value of 1 if fetch fails
    }
  }

  const fetchUsers = async () => {
    try {
      setIsLoading(true)
      const supabase = getSupabaseClient()
      
      const { data, error } = await supabase
        .from('user_roles')
        .select('*')
        .order('role', { ascending: true })

      if (error) throw error

      setUsers(data as UserData[])
    } catch (err: any) {
      console.error('Error fetching users:', err)
      setError(err.message)
    } finally {
      setIsLoading(false)
    }
  }

  const updateUserRole = async (userId: string, newRole: UserRole) => {
    try {
      setUpdatingId(userId)
      // Use service role client to bypass RLS policies
      const supabaseAdmin = getSupabaseServiceClient()

      const { error } = await supabaseAdmin
        .from('user_roles')
        .update({ role: newRole })
        .eq('id', userId)

      if (error) throw error

      setUsers(users.map(u => u.id === userId ? { ...u, role: newRole } : u))
      
    } catch (err: any) {
      console.error('Error updating role:', err)
      alert(`Failed to update role: ${err.message}`)
    } finally {
      setUpdatingId(null)
    }
  }

  const handleDeleteUser = async (userId: string) => {
    if (!confirm('Are you sure you want to delete this user? This action cannot be undone.')) {
      return
    }

    try {
      setDeletingId(userId)
      const supabase = getSupabaseClient()

      // Delete from user_roles first
      const { error: roleError } = await supabase
        .from('user_roles')
        .delete()
        .eq('id', userId)

      if (roleError) throw roleError

      // Note: Deleting from auth.users requires admin API
      // For now, we just remove from user_roles
      // In production, you'd want to call a Supabase Edge Function with admin privileges

      setUsers(users.filter(u => u.id !== userId))
    } catch (err: any) {
      console.error('Error deleting user:', err)
      alert(`Failed to delete user: ${err.message}`)
    } finally {
      setDeletingId(null)
    }
  }

  const handleEditUser = (userData: UserData) => {
    setEditingUser(userData)
    setIsEditModalOpen(true)
  }

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-waldorf-peach border-t-transparent"></div>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      {/* Navigation Toolbar */}
      <div className="mb-6 flex items-center justify-between bg-white shadow-sm rounded-lg px-4 py-3 border border-gray-200">
        <a
          href={`/week/${latestWeek}`}
          className="flex items-center text-gray-600 hover:text-waldorf-peach-500 transition-colors"
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

      <header className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
        <p className="text-gray-600 mt-2">Manage users, roles, and system settings.</p>
      </header>

      {error && (
        <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-6">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
          <div>
            <h2 className="text-lg font-medium text-gray-900">User Management</h2>
            <p className="text-sm text-gray-500 mt-1">{users.length} users found</p>
          </div>
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="px-4 py-2 bg-waldorf-peach-500 text-white rounded-md hover:bg-opacity-90 transition-colors"
          >
            + Add User
          </button>
        </div>
        
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
                        <div className="h-10 w-10 rounded-full bg-waldorf-peach-500 flex items-center justify-center text-white font-bold">
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
                    ) : (
                      'Active'
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <select
                      value={userData.role}
                      onChange={(e) => updateUserRole(userData.id, e.target.value as UserRole)}
                      disabled={updatingId === userData.id || userData.id === user?.id}
                      className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-waldorf-peach focus:border-waldorf-peach sm:text-sm rounded-md"
                    >
                      {Object.values(ROLES).map((role) => (
                        <option key={role} value={role}>{role}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                    <button
                      onClick={() => handleEditUser(userData)}
                      className="text-waldorf-peach hover:text-opacity-80"
                    >
                      Edit
                    </button>
                    {userData.id !== user?.id && (
                      <button
                        onClick={() => handleDeleteUser(userData.id)}
                        disabled={deletingId === userData.id}
                        className="text-red-600 hover:text-red-800 disabled:opacity-50"
                      >
                        {deletingId === userData.id ? 'Deleting...' : 'Delete'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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
  )
}
