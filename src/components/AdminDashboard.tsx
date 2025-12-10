import React, { useEffect, useState } from 'react'
import { getSupabaseClient } from '@/lib/supabase'
import { AuditLogViewer as UserAuditLog } from './UserAuditLog'
import { UserTable } from './admin/UserTable'
import { UserForm, type UserFormData } from './admin/UserForm'
import { adminSessionService } from '@/services/adminSessionService'
import type { AdminUser } from '@/types/admin'

export const AdminDashboard: React.FC = () => {
  const [users, setUsers] = useState<AdminUser[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showUserForm, setShowUserForm] = useState(false)
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null)
  const [isSubmittingForm, setIsSubmittingForm] = useState(false)
  const [latestWeek, setLatestWeek] = useState<number>(1)

  // Tab state for switching between user management and audit logs
  const [activeTab, setActiveTab] = useState<'users' | 'audit'>('users')

  // Suspicious activity detection
  const [suspiciousUsers, setSuspiciousUsers] = useState<Array<{ userId: string; failureCount: number }>>([])

  useEffect(() => {
    fetchUsers()
    fetchLatestWeek()
  }, [])

  // Check for suspicious activity every 5 minutes
  useEffect(() => {
    const checkSuspicious = async () => {
      try {
        const suspicious = await adminSessionService.detectSuspiciousActivity()
        setSuspiciousUsers(suspicious)
      } catch (err) {
        console.error('Error detecting suspicious activity:', err)
      }
    }

    // Check immediately
    checkSuspicious()

    // Then check every 5 minutes
    const interval = setInterval(checkSuspicious, 5 * 60 * 1000)

    return () => clearInterval(interval)
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
        .order('createdAt', { ascending: false })

      if (error) throw error

      setUsers((data as AdminUser[]) || [])
    } catch (err: any) {
      console.error('Error fetching users:', err)
      setError(err.message)
    } finally {
      setIsLoading(false)
    }
  }

  const handleDeleteUser = async (userId: string) => {
    if (!confirm('Are you sure you want to delete this user? This action cannot be undone.')) {
      return
    }

    try {
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
    }
  }

  const handleStatusToggle = async (userId: string, status: 'active' | 'disabled') => {
    try {
      const supabase = getSupabaseClient()

      const { error } = await supabase
        .from('user_roles')
        .update({ status, updatedAt: new Date().toISOString() })
        .eq('id', userId)

      if (error) throw error

      setUsers(users.map(u => u.id === userId ? { ...u, status } : u))
    } catch (err: any) {
      console.error('Error updating user status:', err)
      alert(`Failed to update user status: ${err.message}`)
    }
  }

  const handleUserFormSubmit = async (formData: UserFormData) => {
    setIsSubmittingForm(true)
    try {
      if (editingUser) {
        // Update existing user
        const supabase = getSupabaseClient()
        const { error } = await supabase
          .from('user_roles')
          .update({
            name: formData.name,
            status: formData.status,
            updatedAt: new Date().toISOString(),
          })
          .eq('id', editingUser.id)

        if (error) throw error

        setUsers(users.map(u =>
          u.id === editingUser.id
            ? { ...u, name: formData.name, status: formData.status }
            : u
        ))
      } else {
        // Create new user
        const supabaseAdmin = getSupabaseClient()

        // Create auth user
        const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
          email: formData.email,
          email_confirm: true,
        })

        if (authError) throw authError
        if (!authData.user) throw new Error('No user returned from signup')

        // Create user_roles entry
        const now = new Date().toISOString()
        const { error: roleError } = await supabaseAdmin
          .from('user_roles')
          .insert({
            id: authData.user.id,
            email: formData.email,
            name: formData.name,
            role: formData.role,
            status: formData.status,
            createdAt: now,
            updatedAt: now,
          })

        if (roleError) throw roleError
      }

      // Reset form and refresh
      setShowUserForm(false)
      setEditingUser(null)
      await fetchUsers()
    } finally {
      setIsSubmittingForm(false)
    }
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

      {/* Suspicious Activity Alert */}
      {suspiciousUsers.length > 0 && (
        <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-6">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-red-800">
                ⚠️ Suspicious activity detected: {suspiciousUsers.length} user(s) with multiple failed login attempts
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
        <nav className="flex space-x-8 px-6" aria-label="Tabs">
          <button
            onClick={() => setActiveTab('users')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'users'
                ? 'border-waldorf-peach-500 text-waldorf-peach-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            User Management
          </button>
          <button
            onClick={() => setActiveTab('audit')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'audit'
                ? 'border-waldorf-peach-500 text-waldorf-peach-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Audit Logs
          </button>
        </nav>
      </div>

      {/* User Management Tab */}
      {activeTab === 'users' && (
        <div className="bg-white shadow rounded-lg overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
            <div>
              <h2 className="text-lg font-medium text-gray-900">User Management</h2>
              <p className="text-sm text-gray-500 mt-1">{users.length} users found</p>
            </div>
            {!showUserForm && (
              <button
                onClick={() => {
                  setEditingUser(null)
                  setShowUserForm(true)
                }}
                className="px-4 py-2 bg-waldorf-peach-500 text-white rounded-md hover:bg-opacity-90 transition-colors"
              >
                + Add User
              </button>
            )}
          </div>
          <div className="p-6">
            {showUserForm ? (
              <div className="mb-6 p-6 border border-gray-200 rounded-lg bg-gray-50">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">
                    {editingUser ? 'Edit User' : 'Add New User'}
                  </h3>
                  <button
                    onClick={() => {
                      setShowUserForm(false)
                      setEditingUser(null)
                    }}
                    className="text-gray-500 hover:text-gray-700 text-2xl leading-none"
                  >
                    ×
                  </button>
                </div>
                <UserForm
                  user={editingUser || undefined}
                  isSubmitting={isSubmittingForm}
                  onSubmit={handleUserFormSubmit}
                  onCancel={() => {
                    setShowUserForm(false)
                    setEditingUser(null)
                  }}
                />
              </div>
            ) : null}
            {!showUserForm && (
              <UserTable
                users={users}
                isLoading={isLoading}
                error={error}
                onEdit={(user) => {
                  setEditingUser(user)
                  setShowUserForm(true)
                }}
                onDelete={handleDeleteUser}
                onStatusToggle={handleStatusToggle}
              />
            )}
          </div>
        </div>
      )}

      {/* Audit Logs Tab */}
      {activeTab === 'audit' && (
        <div className="bg-white shadow rounded-lg overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
            <h2 className="text-lg font-medium text-gray-900">Authentication Audit Logs</h2>
            <p className="text-sm text-gray-500 mt-1">View all authentication events for security auditing</p>
          </div>
          <div className="p-6">
            <UserAuditLog />
          </div>
        </div>
      )}
    </div>
  )
}
