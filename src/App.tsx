import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { lazy, Suspense } from 'react'
import { AuthProvider } from '@/context/AuthContext'
import { NavigationProvider } from '@/context/NavigationContext'
import { LoginPage } from '@/pages/LoginPage'
import { AuthCallbackPage } from '@/pages/AuthCallbackPage'
import { WeeklyReaderPage } from '@/pages/WeeklyReaderPage'
import { ErrorPage } from '@/pages/ErrorPage'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { AnalyticsFooter } from '@/components/AnalyticsFooter'

import { ArticleReadersPage } from './pages/ArticleReadersPage';
import { AnalyticsProvider } from '@/context/AnalyticsContext';
import '@/styles/globals.css'

// Lazy load editor and admin pages - only loaded when route is accessed
// Reduces initial bundle size and improves Time to Interactive (TTI)
const LazyEditorPage = lazy(() => import('@/pages/EditorPage').then(m => ({ default: m.EditorPage })))
const LazyAdminDashboard = lazy(() => import('@/pages/AdminDashboardPage').then(m => ({ default: m.AdminDashboardPage })))
const LazyAdminArticlesPage = lazy(() => import('@/pages/AdminArticlesPage').then(m => ({ default: m.AdminArticlesPage })))
const LazyAdminArticleList = lazy(() => import('@/pages/AdminArticleListPage').then(m => ({ default: m.AdminArticleListPage })))
const LazyArticleEditorPage = lazy(() => import('@/pages/ArticleEditorPage').then(m => ({ default: m.ArticleEditorPage })))
const LazyNewsletterCreatePage = lazy(() => import('@/pages/NewsletterCreatePage').then(m => ({ default: m.NewsletterCreatePage })))
const LazyAdminTemplatesPage = lazy(() => import('@/pages/AdminTemplatesPage').then(m => ({ default: m.AdminTemplatesPage })))
const LazyAdminEmailTemplatesPage = lazy(() => import('@/pages/AdminEmailTemplatesPage').then(m => ({ default: m.AdminEmailTemplatesPage })))
const LazyAdminEmailTemplateEditorPage = lazy(() => import('@/pages/AdminEmailTemplateEditorPage').then(m => ({ default: m.AdminEmailTemplateEditorPage })))
const LazyAdminFileEmailTemplatePreviewPage = lazy(() => import('@/pages/AdminFileEmailTemplatePreviewPage').then(m => ({ default: m.AdminFileEmailTemplatePreviewPage })))
const LazyNewsletterEmailPreviewPage = lazy(() => import('@/pages/NewsletterEmailPreviewPage').then(m => ({ default: m.NewsletterEmailPreviewPage })))
const LazyClassManagementPage = lazy(() => import('@/pages/ClassManagementPage').then(m => ({ default: m.ClassManagementPage })))
const LazyTeacherManagementPage = lazy(() => import('@/pages/TeacherManagementPage').then(m => ({ default: m.TeacherManagementPage })))
const LazyFamilyManagementPage = lazy(() => import('@/pages/FamilyManagementPage').then(m => ({ default: m.FamilyManagementPage })))
const LazyParentManagementPage = lazy(() => import('@/pages/ParentManagementPage').then(m => ({ default: m.ParentManagementPage })))
const LazyStudentManagementPage = lazy(() => import('@/pages/StudentManagementPage').then(m => ({ default: m.StudentManagementPage })))
const LazyParentStudentPage = lazy(() => import('@/pages/ParentStudentPage').then(m => ({ default: m.ParentStudentPage })))
const LazyAdminMediaPage = lazy(() => import('@/pages/AdminMediaPage').then(m => ({ default: m.AdminMediaPage })))
const LazyAnalyticsDashboardPage = lazy(() => import('@/pages/AnalyticsDashboardPage').then(m => ({ default: m.AnalyticsDashboardPage })))
const LazyClassAnalyticsPage = lazy(() => import('@/pages/analytics/ClassAnalyticsPage').then(m => ({ default: m.ClassAnalyticsPage })))
const LazyArticleAnalyticsPage = lazy(() => import('@/pages/analytics/ArticleAnalyticsPage').then(m => ({ default: m.ArticleAnalyticsPage })))

// Loading component shown while lazy route is loading
const RouteLoader = () => (
  <div className="flex items-center justify-center h-screen bg-gray-50">
    <div className="text-center">
      <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mb-4"></div>
      <p className="text-gray-600">読み込み中...</p>
    </div>
  </div>
)

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <NavigationProvider>
          <AnalyticsProvider>
            <Router>
              <Routes>
              <Route path="/" element={<Navigate to="/login" replace />} />
              <Route path="/login" element={<LoginPage />} />

              <Route path="/auth/callback" element={<AuthCallbackPage />} />
              <Route
                path="/week/:weekNumber"
                element={
                  <ProtectedRoute>
                    <WeeklyReaderPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/week/:weekNumber/:shortId"
                element={
                  <ProtectedRoute>
                    <WeeklyReaderPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/article/:articleId"
                element={
                  <ProtectedRoute>
                    <WeeklyReaderPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/newsletter/:newsletterId"
                element={
                  <ProtectedRoute>
                    <WeeklyReaderPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/newsletter/:newsletterId/:shortId"
                element={
                  <ProtectedRoute>
                    <WeeklyReaderPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/editor/:weekNumber"
                element={
                  <ProtectedRoute>
                    <Suspense fallback={<RouteLoader />}>
                      <LazyEditorPage />
                    </Suspense>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin"
                element={
                  <ErrorBoundary>
                    <ProtectedRoute requiredRole="admin">
                      <Suspense fallback={<RouteLoader />}>
                        <LazyAdminDashboard />
                      </Suspense>
                    </ProtectedRoute>
                  </ErrorBoundary>
                }
              />
              <Route
                path="/admin/newsletter/create"
                element={
                  <ErrorBoundary>
                    <ProtectedRoute requiredRole="admin">
                      <Suspense fallback={<RouteLoader />}>
                        <LazyNewsletterCreatePage />
                      </Suspense>
                    </ProtectedRoute>
                  </ErrorBoundary>
                }
              />
              <Route
                path="/admin/templates"
                element={
                  <ErrorBoundary>
                    <ProtectedRoute requiredRole="admin">
                      <Suspense fallback={<RouteLoader />}>
                        <LazyAdminTemplatesPage />
                      </Suspense>
                    </ProtectedRoute>
                  </ErrorBoundary>
                }
              />
              <Route
                path="/admin/email-templates"
                element={
                  <ErrorBoundary>
                    <ProtectedRoute requiredRole="admin">
                      <Suspense fallback={<RouteLoader />}>
                        <LazyAdminEmailTemplatesPage />
                      </Suspense>
                    </ProtectedRoute>
                  </ErrorBoundary>
                }
              />
              <Route
                path="/admin/newsletters/preview"
                element={
                  <ErrorBoundary>
                    <ProtectedRoute requiredRole="admin">
                      <Suspense fallback={<RouteLoader />}>
                        <LazyNewsletterEmailPreviewPage />
                      </Suspense>
                    </ProtectedRoute>
                  </ErrorBoundary>
                }
              />
              <Route
                path="/admin/email-templates/new"
                element={
                  <ErrorBoundary>
                    <ProtectedRoute requiredRole="admin">
                      <Suspense fallback={<RouteLoader />}>
                        <LazyAdminEmailTemplateEditorPage />
                      </Suspense>
                    </ProtectedRoute>
                  </ErrorBoundary>
                }
              />
              <Route
                path="/admin/email-templates/file/:sourceId"
                element={
                  <ErrorBoundary>
                    <ProtectedRoute requiredRole="admin">
                      <Suspense fallback={<RouteLoader />}>
                        <LazyAdminFileEmailTemplatePreviewPage />
                      </Suspense>
                    </ProtectedRoute>
                  </ErrorBoundary>
                }
              />
              <Route
                path="/admin/email-templates/:templateId"
                element={
                  <ErrorBoundary>
                    <ProtectedRoute requiredRole="admin">
                      <Suspense fallback={<RouteLoader />}>
                        <LazyAdminEmailTemplateEditorPage />
                      </Suspense>
                    </ProtectedRoute>
                  </ErrorBoundary>
                }
              />
              <Route
                path="/admin/articles"
                element={
                  <ErrorBoundary>
                    <ProtectedRoute requiredRole="admin">
                      <Suspense fallback={<RouteLoader />}>
                        <LazyAdminArticlesPage />
                      </Suspense>
                    </ProtectedRoute>
                  </ErrorBoundary>
                }
              />
              <Route
                path="/admin/newsletters/:weekNumber"
                element={
                  <ErrorBoundary>
                    <ProtectedRoute requiredRole="admin">
                      <Suspense fallback={<RouteLoader />}>
                        <LazyAdminArticleList />
                      </Suspense>
                    </ProtectedRoute>
                  </ErrorBoundary>
                }
              />
              <Route
                path="/admin/newsletters/id/:id"
                element={
                  <ErrorBoundary>
                    <ProtectedRoute requiredRole="admin">
                      <Suspense fallback={<RouteLoader />}>
                        <LazyAdminArticleList />
                      </Suspense>
                    </ProtectedRoute>
                  </ErrorBoundary>
                }
              />
              <Route
                path="/admin/articles/:weekNumber"
                element={
                  <ErrorBoundary>
                    <ProtectedRoute requiredRole="admin">
                      <Suspense fallback={<RouteLoader />}>
                        <LazyAdminArticleList />
                      </Suspense>
                    </ProtectedRoute>
                  </ErrorBoundary>
                }
              />
              <Route
                path="/admin/articles/:weekNumber/:articleId"
                element={
                  <ErrorBoundary>
                    <ProtectedRoute requiredRole="admin">
                      <Suspense fallback={<RouteLoader />}>
                        <LazyArticleEditorPage />
                      </Suspense>
                    </ProtectedRoute>
                  </ErrorBoundary>
                }
              />
              <Route
                path="/admin/articles/id/:id"
                element={
                  <ErrorBoundary>
                    <ProtectedRoute requiredRole="admin">
                      <Suspense fallback={<RouteLoader />}>
                        <LazyAdminArticleList />
                      </Suspense>
                    </ProtectedRoute>
                  </ErrorBoundary>
                }
              />
              <Route
                path="/admin/articles/id/:id/:articleId"
                element={
                  <ErrorBoundary>
                    <ProtectedRoute requiredRole="admin">
                      <Suspense fallback={<RouteLoader />}>
                        <LazyArticleEditorPage />
                      </Suspense>
                    </ProtectedRoute>
                  </ErrorBoundary>
                }
              />
              <Route
                path="/admin/classes"
                element={
                  <ErrorBoundary>
                    <ProtectedRoute requiredRole="admin">
                      <Suspense fallback={<RouteLoader />}>
                        <LazyClassManagementPage />
                      </Suspense>
                    </ProtectedRoute>
                  </ErrorBoundary>
                }
              />
              <Route
                path="/admin/teachers"
                element={
                  <ErrorBoundary>
                    <ProtectedRoute requiredRole="admin">
                      <Suspense fallback={<RouteLoader />}>
                        <LazyTeacherManagementPage />
                      </Suspense>
                    </ProtectedRoute>
                  </ErrorBoundary>
                }
              />
              <Route
                path="/admin/families"
                element={
                  <ErrorBoundary>
                    <ProtectedRoute requiredRole="admin">
                      <Suspense fallback={<RouteLoader />}>
                        <LazyFamilyManagementPage />
                      </Suspense>
                    </ProtectedRoute>
                  </ErrorBoundary>
                }
              />
              <Route
                path="/admin/parents"
                element={
                  <ErrorBoundary>
                    <ProtectedRoute requiredRole="admin">
                      <Suspense fallback={<RouteLoader />}>
                        <LazyParentManagementPage />
                      </Suspense>
                    </ProtectedRoute>
                  </ErrorBoundary>
                }
              />
              <Route
                path="/admin/students"
                element={
                  <ErrorBoundary>
                    <ProtectedRoute requiredRole="admin">
                      <Suspense fallback={<RouteLoader />}>
                        <LazyStudentManagementPage />
                      </Suspense>
                    </ProtectedRoute>
                  </ErrorBoundary>
                }
              />
              <Route
                path="/admin/media"
                element={
                  <ErrorBoundary>
                    <ProtectedRoute requiredRole="admin">
                      <Suspense fallback={<RouteLoader />}>
                        <LazyAdminMediaPage />
                      </Suspense>
                    </ProtectedRoute>
                  </ErrorBoundary>
                }
              />
              <Route
                path="/admin/relationships"
                element={
                  <ErrorBoundary>
                    <ProtectedRoute requiredRole="admin">
                      <Suspense fallback={<RouteLoader />}>
                        <LazyParentStudentPage />
                      </Suspense>
                    </ProtectedRoute>
                  </ErrorBoundary>
                }
              />
              <Route
                path="/admin/analytics"
                element={
                  <ErrorBoundary>
                    <ProtectedRoute requiredRole="admin">
                      <Suspense fallback={<RouteLoader />}>
                        <LazyAnalyticsDashboardPage />
                      </Suspense>
                    </ProtectedRoute>
                  </ErrorBoundary>
                }
              />
              <Route
                path="/admin/analytics/week/:weekNumber"
                element={
                  <ErrorBoundary>
                    <ProtectedRoute requiredRole="admin">
                      <Suspense fallback={<RouteLoader />}>
                        <LazyAnalyticsDashboardPage />
                      </Suspense>
                    </ProtectedRoute>
                  </ErrorBoundary>
                }
              />
              <Route
                path="/admin/analytics/class/:className"
                element={
                  <ErrorBoundary>
                    <ProtectedRoute requiredRole="admin">
                      <Suspense fallback={<RouteLoader />}>
                        <LazyClassAnalyticsPage />
                      </Suspense>
                    </ProtectedRoute>
                  </ErrorBoundary>
                }
              />
              <Route
                path="/admin/analytics/article/:articleId"
                element={
                  <ErrorBoundary>
                    <ProtectedRoute requiredRole="admin">
                      <Suspense fallback={<RouteLoader />}>
                        <LazyArticleAnalyticsPage />
                      </Suspense>
                    </ProtectedRoute>
                  </ErrorBoundary>
                }
              />
              <Route
                path="/admin/analytics/article/:articleId/readers"
                element={
                  <ErrorBoundary>
                    <ProtectedRoute requiredRole="admin">
                      <ArticleReadersPage />
                    </ProtectedRoute>
                  </ErrorBoundary>
                }
              />
              <Route path="/error" element={<ErrorPage />} />
              {/* 404 Catch-all Route - Must be last */}
              <Route path="*" element={<ErrorPage errorCode="NOT_FOUND" errorMessage="頁面不存在" title="404 - 找不到頁面" />} />
            </Routes>
            <AnalyticsFooter />
          </Router>
          </AnalyticsProvider>
        </NavigationProvider>
      </AuthProvider>
    </ErrorBoundary>
  )
}
