import React, { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { getSupabaseClient } from '@/lib/supabase'

interface AdminLayoutProps {
  children: React.ReactNode
  activeTab?: 'newsletters' | 'users' | 'audit' | 'classes' | 'families'
  headerAction?: React.ReactNode
}

const TabButton: React.FC<{
  isActive: boolean
  onClick?: () => void
  children: React.ReactNode
}> = ({ isActive, onClick, children }) => (
  <button
    onClick={onClick}
    className={`relative py-4 px-1 font-medium text-sm tracking-wide transition-all duration-300 ${
      isActive
        ? 'text-waldorf-clay-700'
        : 'text-waldorf-cream-600 hover:text-waldorf-clay-600'
    }`}
  >
    {children}
    {isActive && (
      <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-waldorf-peach-400 to-waldorf-clay-400 rounded-full animate-scale-in" />
    )}
  </button>
)

const TabLink: React.FC<{
  to: string
  isActive: boolean
  children: React.ReactNode
}> = ({ to, isActive, children }) => (
  <Link
    to={to}
    className={`relative py-4 px-1 font-medium text-sm tracking-wide transition-all duration-300 ${
      isActive
        ? 'text-waldorf-clay-700'
        : 'text-waldorf-cream-600 hover:text-waldorf-clay-600'
    }`}
  >
    {children}
    {isActive && (
      <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-waldorf-peach-400 to-waldorf-clay-400 rounded-full animate-scale-in" />
    )}
  </Link>
)

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
    <div className="min-h-screen bg-gradient-to-br from-waldorf-cream-50 via-waldorf-cream-100 to-waldorf-clay-50">
      {/* Subtle texture overlay */}
      <div className="fixed inset-0 opacity-[0.015] pointer-events-none bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIzMDAiIGhlaWdodD0iMzAwIj48ZmlsdGVyIGlkPSJhIiB4PSIwIiB5PSIwIj48ZmVUdXJidWxlbmNlIGJhc2VGcmVxdWVuY3k9Ii43NSIgc3RpdGNoVGlsZXM9InN0aXRjaCIgdHlwZT0iZnJhY3RhbE5vaXNlIi8+PGZlQ29sb3JNYXRyaXggdHlwZT0ic2F0dXJhdGUiIHZhbHVlcz0iMCIvPjwvZmlsdGVyPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbHRlcj0idXJsKCNhKSIvPjwvc3ZnPg==')]" />

      <div className="relative max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        {/* Navigation Toolbar */}
        <div className="mb-8">
          <div className="flex items-center justify-between bg-white/70 backdrop-blur-sm shadow-sm rounded-2xl px-6 py-4 border border-waldorf-cream-200">
            <a
              href={`/week/${latestWeek}`}
              className="group flex items-center text-waldorf-clay-500 hover:text-waldorf-peach-600 transition-all duration-300"
            >
              <svg className="w-5 h-5 mr-2 transform group-hover:-translate-x-1 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              <span className="font-medium">Back to Weekly Articles</span>
            </a>
            <div className="flex items-center space-x-2">
              <span className="w-2 h-2 rounded-full bg-waldorf-sage-400 animate-pulse" />
              <span className="text-sm font-medium text-waldorf-clay-400 tracking-wide uppercase">Admin Portal</span>
            </div>
          </div>
        </div>

        {/* Page Header */}
        <div className="mb-10">
          <div className="flex items-end justify-between">
            <div>
              <h1 className="font-display text-4xl sm:text-5xl font-semibold text-waldorf-clay-800 tracking-tight">
                Admin Dashboard
              </h1>
              <p className="mt-3 text-lg text-waldorf-clay-500 font-light">
                Manage newsletters, users, and system settings
              </p>
            </div>
            {headerAction && (
              <div>
                {headerAction}
              </div>
            )}
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="mb-8">
          <div className="bg-white/60 backdrop-blur-sm rounded-2xl border border-waldorf-cream-200 shadow-sm">
            <nav className="flex space-x-8 px-8" aria-label="Admin Navigation">
              <TabButton
                isActive={activeTab === 'newsletters'}
                onClick={() => handleTabClick('newsletters')}
              >
                Newsletters
              </TabButton>
              <TabButton
                isActive={activeTab === 'users'}
                onClick={() => handleTabClick('users')}
              >
                User Management
              </TabButton>
              <TabButton
                isActive={activeTab === 'audit'}
                onClick={() => handleTabClick('audit')}
              >
                Audit Logs
              </TabButton>

              <div className="border-l border-waldorf-cream-300 mx-2 my-3" />

              <TabLink to="/admin/classes" isActive={activeTab === 'classes'}>
                Classes
              </TabLink>
              <TabLink to="/admin/families" isActive={activeTab === 'families'}>
                Families
              </TabLink>
            </nav>
          </div>
        </div>

        {/* Content Area */}
        <div className="bg-white/80 backdrop-blur-sm shadow-lg shadow-waldorf-clay-100/50 rounded-2xl p-8 min-h-[500px] border border-waldorf-cream-200">
          {children}
        </div>

        {/* Footer accent */}
        <div className="mt-8 flex justify-center">
          <div className="h-1 w-24 rounded-full bg-gradient-to-r from-waldorf-peach-300 via-waldorf-clay-300 to-waldorf-sage-300 opacity-50" />
        </div>
      </div>
    </div>
  )
}
