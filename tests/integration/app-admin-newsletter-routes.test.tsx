import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import App from '@/App'

vi.mock('@/context/AuthContext', () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

vi.mock('@/context/NavigationContext', () => ({
  NavigationProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

vi.mock('@/context/AnalyticsContext', () => ({
  AnalyticsProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

vi.mock('@/components/ProtectedRoute', () => ({
  ProtectedRoute: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

vi.mock('@/components/ErrorBoundary', () => ({
  ErrorBoundary: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

vi.mock('@/components/AnalyticsFooter', () => ({
  AnalyticsFooter: () => <div data-testid="analytics-footer" />,
}))

vi.mock('@/pages/LoginPage', () => ({ LoginPage: () => <div>Login Page</div> }))
vi.mock('@/pages/AuthCallbackPage', () => ({ AuthCallbackPage: () => <div>Auth Callback</div> }))
vi.mock('@/pages/WeeklyReaderPage', () => ({ WeeklyReaderPage: () => <div>Weekly Reader</div> }))
vi.mock('@/pages/ErrorPage', () => ({ ErrorPage: () => <div>Error Page</div> }))
vi.mock('@/pages/ArticleReadersPage', () => ({ ArticleReadersPage: () => <div>Article Readers Page</div> }))
vi.mock('@/pages/EditorPage', () => ({ EditorPage: () => <div>Editor Page</div> }))
vi.mock('@/pages/AdminDashboardPage', () => ({ AdminDashboardPage: () => <div>Admin Dashboard</div> }))
vi.mock('@/pages/AdminArticleListPage', () => ({ AdminArticleListPage: () => <div>Admin Newsletter Workflow</div> }))
vi.mock('@/pages/ArticleEditorPage', () => ({ ArticleEditorPage: () => <div>Article Editor</div> }))
vi.mock('@/pages/NewsletterCreatePage', () => ({ NewsletterCreatePage: () => <div>Newsletter Create</div> }))
vi.mock('@/pages/ClassManagementPage', () => ({ ClassManagementPage: () => <div>Class Management</div> }))
vi.mock('@/pages/FamilyManagementPage', () => ({ FamilyManagementPage: () => <div>Family Management</div> }))
vi.mock('@/pages/ParentStudentPage', () => ({ ParentStudentPage: () => <div>Parent Student</div> }))
vi.mock('@/pages/AnalyticsDashboardPage', () => ({ AnalyticsDashboardPage: () => <div>Analytics Dashboard</div> }))
vi.mock('@/pages/analytics/ClassAnalyticsPage', () => ({ ClassAnalyticsPage: () => <div>Class Analytics Page</div> }))
vi.mock('@/pages/analytics/ArticleAnalyticsPage', () => ({ ArticleAnalyticsPage: () => <div>Article Analytics Page</div> }))

describe('App admin newsletter routes', () => {
  beforeEach(() => {
    window.history.pushState({}, '', '/admin/newsletters/id/test-newsletter')
  })

  it('renders the admin newsletter workflow page for id-based routes', async () => {
    render(<App />)

    expect(await screen.findByText('Admin Newsletter Workflow')).toBeInTheDocument()
  })
})
