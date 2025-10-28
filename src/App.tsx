import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { NavigationProvider } from '@/context/NavigationContext'
import { WeeklyReaderPage } from '@/pages/WeeklyReaderPage'
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

const EditorPage = () => (
  <div className="flex items-center justify-center h-screen bg-gray-50">
    <p className="text-gray-600">編輯功能 - 待實現</p>
  </div>
)

export default function App() {
  return (
    <NavigationProvider>
      <Router>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/week/:weekNumber" element={<WeeklyReaderPage />} />
          <Route path="/article/:articleId" element={<WeeklyReaderPage />} />
          <Route path="/editor" element={<EditorPage />} />
        </Routes>
      </Router>
    </NavigationProvider>
  )
}
