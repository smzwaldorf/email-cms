import { NewsletterForm } from '@/components/admin/NewsletterForm'
import { ErrorBoundary } from '@/components/ErrorBoundary'

export function NewsletterCreatePage() {
  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-gray-100 py-8 px-4">
        <div className="max-w-7xl mx-auto">
          {/* Navigation Toolbar */}
          <div className="mb-6 flex items-center justify-between bg-white shadow-sm rounded-lg px-4 py-3 border border-gray-200">
            <a
              href="/admin"
              className="flex items-center text-gray-600 hover:text-blue-500 transition-colors"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              返回儀表板
            </a>
            <div className="text-sm text-gray-500">
              建立電子報
            </div>
          </div>

          <NewsletterForm />
        </div>
      </div>
    </ErrorBoundary>
  )
}
