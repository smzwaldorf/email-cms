import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { AdminNewsletter, NewsletterFilterOptions } from '@/types/admin'
import { adminService, AdminServiceError } from '@/services/adminService'
import NewsletterTable from '@/components/admin/NewsletterTable'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { AdminLayout } from '@/components/admin/AdminLayout'
import { getAdminNewsletterPath } from '@/utils/adminNewsletterRoutes'

export function AdminTemplatesPage() {
  const navigate = useNavigate()
  const [templates, setTemplates] = useState<AdminNewsletter[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void loadTemplates()
  }, [])

  const loadTemplates = async () => {
    try {
      setIsLoading(true)
      setError(null)
      const data = await adminService.fetchNewsletterTemplates()
      setTemplates(data)
    } catch (err) {
      const message = err instanceof AdminServiceError
        ? err.message
        : err instanceof Error
          ? err.message
          : '無法載入模板'
      setError(message)
    } finally {
      setIsLoading(false)
    }
  }

  const handleEdit = (id: string) => {
    const template = templates.find((item) => item.id === id)
    if (!template) return
    navigate(getAdminNewsletterPath(template), { state: { newsletterId: id } })
  }

  const handleDelete = async (id: string) => {
    if (!window.confirm('確定要刪除此模板嗎？')) return
    try {
      await adminService.deleteNewsletter(id)
      setTemplates((current) => current.filter((item) => item.id !== id))
    } catch (err) {
      const message = err instanceof AdminServiceError
        ? err.message
        : err instanceof Error
          ? err.message
          : '刪除模板失敗'
      setError(message)
    }
  }

  const handleFilterChange = (_filters: NewsletterFilterOptions) => {
    // table keeps local filter state; no-op for now.
  }

  return (
    <ErrorBoundary>
      <AdminLayout
        activeTab="templates"
        headerAction={
          <button
            onClick={() => navigate('/admin/newsletter/create?sourceNewsletter=')}
            className="group px-5 py-2.5 bg-gradient-to-r from-waldorf-peach-500 to-waldorf-peach-600 text-white rounded-xl hover:from-waldorf-peach-600 hover:to-waldorf-peach-700 transition-all duration-300 font-medium shadow-lg shadow-waldorf-peach-200/50 flex items-center space-x-2"
          >
            <svg className="w-5 h-5 transform group-hover:rotate-90 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            <span>Create Template</span>
          </button>
        }
      >
        {error && (
          <div className="mb-6 p-4 bg-waldorf-rose-50 border border-waldorf-rose-200 rounded-xl">
            <p className="text-waldorf-rose-800 font-semibold">Error</p>
            <p className="text-waldorf-rose-600 text-sm mt-1">{error}</p>
          </div>
        )}
        <NewsletterTable
          newsletters={templates}
          isLoading={isLoading}
          error={error}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onFilterChange={handleFilterChange}
        />
      </AdminLayout>
    </ErrorBoundary>
  )
}

export default AdminTemplatesPage
