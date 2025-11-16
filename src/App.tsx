import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { AuthProvider } from '@/contexts/AuthContext'
import { NavigationProvider } from '@/context/NavigationContext'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import { WeeklyReaderPage } from '@/pages/WeeklyReaderPage'
import { ErrorPage } from '@/pages/ErrorPage'
import { EditorPage } from '@/pages/EditorPage'
import { LoginPage } from '@/pages/LoginPage'
import { AuthCallbackPage } from '@/pages/AuthCallbackPage'
import { ProfilePage } from '@/pages/ProfilePage'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import '@/styles/globals.css'

// Placeholder pages
const HomePage = () => (
  <div className="flex items-center justify-center h-screen bg-gray-50">
    <div className="text-center">
      <h1 className="text-3xl font-bold text-gray-900 mb-4">電子報閱讀器</h1>
      <p className="text-gray-600 mb-4">Newsletter Viewer</p>
      <a
        href="/week/2025-W43"
        className="inline-block px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
      >
        查看最新週報
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
              {/* Public routes */}
              <Route path="/login" element={<LoginPage />} />
              <Route path="/auth/callback" element={<AuthCallbackPage />} />

              {/* Protected routes */}
              <Route
                path="/"
                element={
                  <ProtectedRoute>
                    <HomePage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/week/:weekNumber"
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
              <Route
                path="/profile"
                element={
                  <ProtectedRoute>
                    <ProfilePage />
                  </ProtectedRoute>
                }
              />
              <Route path="/error" element={<ErrorPage />} />
            </Routes>
          </Router>
        </NavigationProvider>
      </AuthProvider>
    </ErrorBoundary>
  )
}
