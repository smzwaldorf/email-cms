import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { AuthProvider } from '@/context/AuthContext'
import { NavigationProvider } from '@/context/NavigationContext'
import { LoginPage } from '@/pages/LoginPage'
import { WeeklyReaderPage } from '@/pages/WeeklyReaderPage'
import { ErrorPage } from '@/pages/ErrorPage'
import { EditorPage } from '@/pages/EditorPage'
import { UnauthorizedPage } from '@/pages/UnauthorizedPage'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { AdminRoute } from '@/components/admin/AdminRoute'
import { AdminLayout } from '@/components/admin/AdminLayout'
import { AdminDashboardPage } from '@/pages/admin/AdminDashboardPage'
import { UserManagementPage } from '@/pages/admin/UserManagementPage'
import { WeekManagementPage } from '@/pages/admin/WeekManagementPage'
import { ArticleManagementPage } from '@/pages/admin/ArticleManagementPage'
import { ClassManagementPage } from '@/pages/admin/ClassManagementPage'
import { FamilyManagementPage } from '@/pages/admin/FamilyManagementPage'
import { AuditLogPage } from '@/pages/admin/AuditLogPage'
import '@/styles/globals.css'

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
                    <EditorPage />
                  </ProtectedRoute>
                }
              />
              {/* Admin Routes */}
              <Route
                path="/admin"
                element={
                  <AdminRoute>
                    <AdminLayout />
                  </AdminRoute>
                }
              >
                <Route index element={<AdminDashboardPage />} />
                <Route path="users" element={<UserManagementPage />} />
                <Route path="weeks" element={<WeekManagementPage />} />
                <Route path="articles" element={<ArticleManagementPage />} />
                <Route path="classes" element={<ClassManagementPage />} />
                <Route path="families" element={<FamilyManagementPage />} />
                <Route path="audit" element={<AuditLogPage />} />
              </Route>
              <Route path="/unauthorized" element={<UnauthorizedPage />} />
              <Route path="/error" element={<ErrorPage />} />
            </Routes>
          </Router>
        </NavigationProvider>
      </AuthProvider>
    </ErrorBoundary>
  )
}
