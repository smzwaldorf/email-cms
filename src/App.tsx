import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { AuthProvider } from '@/context/AuthContext'
import { NavigationProvider } from '@/context/NavigationContext'
import { LoginPage } from '@/pages/LoginPage'
import { WeeklyReaderPage } from '@/pages/WeeklyReaderPage'
import { ErrorPage } from '@/pages/ErrorPage'
import { EditorPage } from '@/pages/EditorPage'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import { ErrorBoundary } from '@/components/ErrorBoundary'
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
              <Route path="/error" element={<ErrorPage />} />
            </Routes>
          </Router>
        </NavigationProvider>
      </AuthProvider>
    </ErrorBoundary>
  )
}
