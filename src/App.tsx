import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
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
import '@/styles/globals.css'

// Lazy load editor and admin pages - only loaded when route is accessed
// Reduces initial bundle size and improves Time to Interactive (TTI)
const LazyEditorPage = lazy(() => import('@/pages/EditorPage').then(m => ({ default: m.EditorPage })))
const LazyAdminDashboard = lazy(() => import('@/pages/AdminDashboardPage').then(m => ({ default: m.AdminDashboardPage })))
const LazyAdminArticleList = lazy(() => import('@/pages/AdminArticleListPage').then(m => ({ default: m.AdminArticleListPage })))
const LazyArticleEditorPage = lazy(() => import('@/pages/ArticleEditorPage').then(m => ({ default: m.ArticleEditorPage })))
const LazyNewsletterCreatePage = lazy(() => import('@/pages/NewsletterCreatePage').then(m => ({ default: m.NewsletterCreatePage })))
const LazyClassManagementPage = lazy(() => import('@/pages/ClassManagementPage').then(m => ({ default: m.ClassManagementPage })))
const LazyFamilyManagementPage = lazy(() => import('@/pages/FamilyManagementPage').then(m => ({ default: m.FamilyManagementPage })))
const LazyParentStudentPage = lazy(() => import('@/pages/ParentStudentPage').then(m => ({ default: m.ParentStudentPage })))

// Loading component shown while lazy route is loading
const RouteLoader = () => (
  <div className="flex items-center justify-center h-screen bg-gray-50">
    <div className="text-center">
      <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mb-4"></div>
      <p className="text-gray-600">読み込み中...</p>
    </div>
  </div>
)

// Placeholder pages
const HomePage = () => (
  <div className="flex items-center justify-center h-screen bg-gray-50">
    <div className="text-center">
      <h1 className="text-3xl font-bold text-gray-900 mb-4">電子報閱讀器</h1>
      <p className="text-gray-600 mb-4">Newsletter Viewer</p>
      <a
        href="/login"
        className="inline-block px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
      >
        登入查看週報
      </a>
    </div>
  </div>
)

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <NavigationProvider>
          <Router>
            <Routes>
              <Route path="/" element={<HomePage />} />
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
                path="/newsletter/:weekNumber"
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
              <Route path="/error" element={<ErrorPage />} />
              {/* 404 Catch-all Route - Must be last */}
              <Route path="*" element={<ErrorPage errorCode="NOT_FOUND" errorMessage="頁面不存在" title="404 - 找不到頁面" />} />
            </Routes>
            <AnalyticsFooter />
          </Router>
        </NavigationProvider>
      </AuthProvider>
    </ErrorBoundary>
  )
}
