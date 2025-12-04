import React, { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { getSupabaseClient } from '@/lib/supabase'

interface AdminLayoutProps {
  children: React.ReactNode
  activeTab?: 'newsletters' | 'users' | 'audit' | 'classes' | 'families'
  headerAction?: React.ReactNode
}

export const AdminLayout: React.FC<AdminLayoutProps> = ({ children, activeTab, headerAction }) => {
  const [latestWeek, setLatestWeek] = useState<number>(1)
  const navigate = useNavigate()

  useEffect(() => {
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
    }
  }

  const handleTabClick = (tab: string) => {
    if (['newsletters', 'users', 'audit'].includes(tab)) {
      navigate(`/admin?tab=${tab}`)
    }
  }

  return (
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
            {headerAction}
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="mb-6 border-b border-gray-200 bg-white rounded-t-lg">
          <nav className="flex space-x-8 px-6 flex-wrap" aria-label="Admin Navigation">
            <button
              onClick={() => handleTabClick('newsletters')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'newsletters'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Newsletters
            </button>
            <button
              onClick={() => handleTabClick('users')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'users'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              User Management
            </button>
            <button
              onClick={() => handleTabClick('audit')}
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
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'classes'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 transition-colors'
              }`}
            >
              Classes
            </Link>
            <Link
              to="/admin/families"
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'families'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 transition-colors'
              }`}
            >
              Families
            </Link>
          </nav>
        </div>

        {/* Content Area */}
        <div className="bg-white shadow rounded-b-lg p-6 min-h-[500px]">
          {children}
        </div>
      </div>
    </div>
  )
}
