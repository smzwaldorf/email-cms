import React, { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { adminService } from '@/services/adminService'
import { useAuth } from '@/context/AuthContext'
import { hasRole } from '@/lib/rbac'
import { backendRequest } from '@/services/backendApi'
import type { NewsletterRow } from '@/types/database'

export type AdminLayoutTab =
  | 'newsletters'
  | 'articles'
  | 'media'
  | 'templates'
  | 'email-templates'
  | 'email-preview'
  | 'users'
  | 'classes'
  | 'teachers'
  | 'families'
  | 'parents'
  | 'students'
  | 'analytics'

interface AdminLayoutProps {
  children: React.ReactNode
  activeTab?: AdminLayoutTab
  headerAction?: React.ReactNode
  /** Page-level heading. Defaults to the portal heading for top-level tabs. */
  title?: React.ReactNode
  /** Short supporting copy rendered under the title. */
  description?: React.ReactNode
  /** Optional contextual back link rendered above the title. */
  backLink?: { to: string; label: string }
  /**
   * `card` wraps children in the frosted content panel (good for tables/lists).
   * `plain` renders children directly so pages composed of their own cards do not nest.
   */
  contentVariant?: 'card' | 'plain'
}

const tabClassName = (isActive: boolean) =>
  `relative py-3.5 px-1 font-medium text-sm tracking-wide whitespace-nowrap transition-all duration-300 ${
    isActive ? 'text-waldorf-clay-700' : 'text-waldorf-cream-600 hover:text-waldorf-clay-600'
  }`

const ActiveIndicator = () => (
  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-waldorf-peach-400 to-waldorf-clay-400 rounded-full animate-scale-in" />
)

const TabButton: React.FC<{
  isActive: boolean
  onClick?: () => void
  children: React.ReactNode
}> = ({ isActive, onClick, children }) => (
  <button type="button" onClick={onClick} className={tabClassName(isActive)} aria-current={isActive ? 'page' : undefined}>
    {children}
    {isActive && <ActiveIndicator />}
  </button>
)

const TabLink: React.FC<{
  to: string
  isActive: boolean
  children: React.ReactNode
}> = ({ to, isActive, children }) => (
  <Link to={to} className={tabClassName(isActive)} aria-current={isActive ? 'page' : undefined}>
    {children}
    {isActive && <ActiveIndicator />}
  </Link>
)

const TabGroupDivider = () => (
  <span aria-hidden="true" className="hidden sm:block self-center h-5 w-px bg-waldorf-cream-300" />
)

interface LatestNewsletter {
  id: string
  weekNumber: string | number | null
}

const roleLabels: Record<string, string> = {
  admin: '管理員', teacher: '教師', parent: '家長', editor: '編輯', student: '學生',
}

export const AdminLayout: React.FC<AdminLayoutProps> = ({
  children,
  activeTab,
  headerAction,
  title = '管理後台',
  description = '管理電子報與系統設定',
  backLink,
  contentVariant = 'card',
}) => {
  const [latestNewsletter, setLatestNewsletter] = useState<LatestNewsletter | null>(null)
  const [isSigningOut, setIsSigningOut] = useState(false)
  const navigate = useNavigate()
  const { user, signOut, isLoading } = useAuth()
  const isAdmin = hasRole(user, 'admin')

  const handleSignOut = async () => {
    setIsSigningOut(true)
    try {
      await signOut()
    } finally {
      setIsSigningOut(false)
    }
  }

  useEffect(() => {
    fetchLatestNewsletter()
  }, [user?.id, isAdmin])

  const fetchLatestNewsletter = async () => {
    try {
      const newsletters = isAdmin ? await adminService.fetchNewsletters({ status: 'published' })
        : (await backendRequest<NewsletterRow[]>('/api/teacher/newsletters')).filter(row => row.status === 'published').map(row => ({ id: row.id, weekNumber: row.week_number }))
      const latest = newsletters[0]
      if (latest?.id) {
        setLatestNewsletter({
          id: latest.id,
          weekNumber: latest.weekNumber ?? null,
        })
      }
    } catch (err: unknown) {
      console.error('Error fetching latest published newsletter:', err)
      // Default fallback: keep latestNewsletter as null, which disables the link
    }
  }

  const handleTabClick = (tab: string) => {
    if (['newsletters', 'users'].includes(tab)) {
      navigate(`/admin?tab=${tab}`)
    }
  }

  const isNewsletterTab = activeTab === 'newsletters' || activeTab === 'templates'

  return (
    <div className="min-h-screen bg-gradient-to-br from-waldorf-cream-50 via-waldorf-cream-100 to-waldorf-clay-50">
      {/* Subtle texture overlay */}
      <div className="fixed inset-0 opacity-[0.015] pointer-events-none bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIzMDAiIGhlaWdodD0iMzAwIj48ZmlsdGVyIGlkPSJhIiB4PSIwIiB5PSIwIj48ZmVUdXJidWxlbmNlIGJhc2VGcmVxdWVuY3k9Ii43NSIgc3RpdGNoVGlsZXM9InN0aXRjaCIgdHlwZT0iZnJhY3RhbE5vaXNlIi8+PGZlQ29sb3JNYXRyaXggdHlwZT0ic2F0dXJhdGUiIHZhbHVlcz0iMCIvPjwvZmlsdGVyPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbHRlcj0idXJsKCNhKSIvPjwvc3ZnPg==')]" />

      <div className="relative max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        {/* Portal toolbar + primary navigation */}
        <header className="mb-8 bg-white/70 backdrop-blur-sm shadow-sm rounded-2xl border border-waldorf-cream-200">
          <div className="flex flex-col gap-3 px-4 py-3 border-b border-waldorf-cream-200/70 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            {latestNewsletter ? (() => {
              // Use /week for week_number format, /newsletter for UUIDs
              const routeKey = latestNewsletter.weekNumber || latestNewsletter.id
              const isWeekNumber = latestNewsletter.weekNumber && /^\d{4}-W\d{2}$/.test(String(latestNewsletter.weekNumber))
              const route = isWeekNumber ? `/week/${routeKey}` : `/newsletter/${routeKey}`
              return (
                <a
                  href={route}
                  className="group flex items-center text-sm text-waldorf-clay-500 hover:text-waldorf-peach-600 transition-all duration-300"
                >
                  <svg className="w-4 h-4 mr-2 transform group-hover:-translate-x-1 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                  </svg>
                  <span className="font-medium">返回每週文章</span>
                </a>
              )
            })() : (
              <div className="flex items-center text-sm text-waldorf-clay-400 cursor-not-allowed opacity-50">
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                <span className="font-medium">沒有已發布的文章</span>
              </div>
            )}
            {user && (
              <div className="flex min-w-0 items-center justify-between gap-4 sm:justify-end">
                <div className="min-w-0 sm:text-right" aria-label="目前登入的使用者">
                  <p className="text-xs text-waldorf-clay-500">目前登入 · {(user.roles?.length ? user.roles : [user.role]).map(role => roleLabels[role] ?? role).join('、')}</p>
                  <p className="break-all text-sm font-semibold text-waldorf-clay-700">{user.displayName || user.email}</p>
                  {user.displayName && <p className="break-all text-xs text-waldorf-clay-500">{user.email}</p>}
                </div>
                <button
                  type="button"
                  onClick={handleSignOut}
                  disabled={isSigningOut || isLoading}
                  className="shrink-0 rounded-lg border border-waldorf-cream-300 bg-white px-4 py-2 text-sm font-medium text-waldorf-clay-600 transition-colors hover:bg-waldorf-cream-100 disabled:cursor-wait disabled:opacity-50"
                >
                  {isSigningOut ? '登出中...' : '登出'}
                </button>
              </div>
            )}
          </div>

          <nav className="flex flex-wrap items-stretch gap-x-6 px-6" aria-label="管理導覽">
            <TabButton isActive={isNewsletterTab} onClick={() => handleTabClick('newsletters')}>
              電子報
            </TabButton>
            <TabLink to="/admin/articles" isActive={activeTab === 'articles'}>
              文章
            </TabLink>
            <TabLink to="/admin/media" isActive={activeTab === 'media'}>
              媒體
            </TabLink>
            {isAdmin && <>
            <TabGroupDivider />
            <TabLink to="/admin/email-templates" isActive={activeTab === 'email-templates'}>
              電子郵件範本
            </TabLink>
            <TabLink to="/admin/newsletters/preview" isActive={activeTab === 'email-preview'}>
              電子郵件預覽
            </TabLink>
            <TabGroupDivider />
            </>}
            <TabLink to="/admin/analytics" isActive={activeTab === 'analytics'}>
              分析
            </TabLink>
          </nav>
        </header>

        {/* Page header */}
        <div className="mb-8">
          {backLink && (
            <Link
              to={backLink.to}
              className="group mb-3 inline-flex items-center text-sm font-medium text-waldorf-peach-600 hover:text-waldorf-peach-700 transition-colors"
            >
              <svg className="mr-1.5 h-4 w-4 transform group-hover:-translate-x-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              {backLink.label}
            </Link>
          )}
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="min-w-0">
              <h1 className="font-display text-3xl sm:text-4xl font-semibold text-waldorf-clay-800 tracking-tight">
                {title}
              </h1>
              {description && (
                <p className="mt-2 text-base text-waldorf-clay-500 font-light">
                  {description}
                </p>
              )}
            </div>
            {headerAction && (
              <div className="flex-shrink-0">
                {headerAction}
              </div>
            )}
          </div>
        </div>

        {/* Content Area */}
        {contentVariant === 'card' ? (
          <div className="bg-white/80 backdrop-blur-sm shadow-lg shadow-waldorf-clay-100/50 rounded-2xl p-8 min-h-[500px] border border-waldorf-cream-200">
            {children}
          </div>
        ) : (
          <div className="min-h-[500px]">{children}</div>
        )}

        {/* Footer accent */}
        <div className="mt-8 flex justify-center">
          <div className="h-1 w-24 rounded-full bg-gradient-to-r from-waldorf-peach-300 via-waldorf-clay-300 to-waldorf-sage-300 opacity-50" />
        </div>
      </div>
    </div>
  )
}
