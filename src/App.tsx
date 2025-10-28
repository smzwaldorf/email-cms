import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { NavigationProvider } from '@/context/NavigationContext'
import '@/styles/globals.css'

// Pages - to be created
const HomePage = () => <div className="p-4">Home - Newsletter Viewer</div>
const WeeklyViewPage = () => <div className="p-4">Weekly View - TBD</div>
const ArticleViewPage = () => <div className="p-4">Article View - TBD</div>
const EditorPage = () => <div className="p-4">Editor - TBD</div>

export default function App() {
  return (
    <NavigationProvider>
      <Router>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/week/:weekNumber" element={<WeeklyViewPage />} />
          <Route path="/article/:articleId" element={<ArticleViewPage />} />
          <Route path="/editor" element={<EditorPage />} />
        </Routes>
      </Router>
    </NavigationProvider>
  )
}
