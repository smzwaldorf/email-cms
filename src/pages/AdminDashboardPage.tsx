/**
 * Admin Dashboard Page
 * Main page for admin users to manage newsletters
 *
 * Features:
 * - Display all newsletters in a table
 * - Filter and sort newsletters
 * - Create new newsletter
 * - Edit, publish, archive, delete newsletters
 * - Error handling and loading states
 */

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { AdminNewsletter, NewsletterFilterOptions } from '@/types/admin'
import { adminService, AdminServiceError } from '@/services/adminService'
import NewsletterTable from '@/components/admin/NewsletterTable'
import ErrorBoundary from '@/components/admin/ErrorBoundary'
import LoadingSpinner from '@/components/admin/LoadingSpinner'

/**
 * Admin Dashboard Page Component
 */
export function AdminDashboardPage() {
  const navigate = useNavigate()
  const [newsletters, setNewsletters] = useState<AdminNewsletter[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  /**
   * Load newsletters on component mount
   */
  useEffect(() => {
    loadNewsletters()
  }, [])

  /**
   * Clear success message after 3 seconds
   */
  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(null), 3000)
      return () => clearTimeout(timer)
    }
  }, [successMessage])

  /**
   * Load newsletters from service
   */
  const loadNewsletters = async () => {
    try {
      setIsLoading(true)
      setError(null)
      const data = await adminService.fetchNewsletters()
      setNewsletters(data)
    } catch (err) {
      const message =
        err instanceof AdminServiceError
          ? err.message
          : err instanceof Error
            ? err.message
            : '無法載入電子報'
      setError(message)
      console.error('Failed to load newsletters:', err)
    } finally {
      setIsLoading(false)
    }
  }

  /**
   * Handle creating new newsletter
   */
  const handleCreateNewsletter = () => {
    navigate('/admin/newsletter/create')
  }

  /**
   * Handle editing newsletter
   */
  const handleEdit = (id: string) => {
    const newsletter = newsletters.find((n) => n.id === id)
    if (newsletter) {
      navigate(`/admin/articles/${newsletter.weekNumber}`, {
        state: { newsletterId: id },
      })
    }
  }

  /**
   * Handle publishing newsletter
   */
  const handlePublish = async (id: string) => {
    try {
      setError(null)
      const updated = await adminService.publishNewsletter(id)
      setNewsletters(newsletters.map((n) => (n.id === id ? updated : n)))
      setSuccessMessage('電子報已發布')
    } catch (err) {
      const message =
        err instanceof AdminServiceError
          ? err.message
          : err instanceof Error
            ? err.message
            : '發布失敗'
      setError(message)
      console.error('Failed to publish newsletter:', err)
    }
  }

  /**
   * Handle archiving newsletter
   */
  const handleArchive = async (id: string) => {
    try {
      setError(null)
      const updated = await adminService.archiveNewsletter(id)
      setNewsletters(newsletters.map((n) => (n.id === id ? updated : n)))
      setSuccessMessage('電子報已封存')
    } catch (err) {
      const message =
        err instanceof AdminServiceError
          ? err.message
          : err instanceof Error
            ? err.message
            : '封存失敗'
      setError(message)
      console.error('Failed to archive newsletter:', err)
    }
  }

  /**
   * Handle deleting newsletter
   */
  const handleDelete = async (id: string) => {
    if (!window.confirm('確定要刪除這份電子報嗎？')) {
      return
    }

    try {
      setError(null)
      await adminService.deleteNewsletter(id)
      setNewsletters(newsletters.filter((n) => n.id !== id))
      setSuccessMessage('電子報已刪除')
    } catch (err) {
      const message =
        err instanceof AdminServiceError
          ? err.message
          : err instanceof Error
            ? err.message
            : '刪除失敗'
      setError(message)
      console.error('Failed to delete newsletter:', err)
    }
  }

  /**
   * Handle filter change
   */
  const handleFilterChange = (filters: NewsletterFilterOptions) => {
    // Reload newsletters with filters
    // Note: In a real app, this would pass filters to fetchNewsletters
    // For now, we filter on the client side in NewsletterTable
    console.log('Filter change:', filters)
  }

  if (isLoading && newsletters.length === 0) {
    return <LoadingSpinner />
  }

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-gray-100 py-8 px-4">
        <div className="max-w-7xl mx-auto">
          {/* Page Header */}
          <div className="mb-8">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">電子報管理</h1>
                <p className="mt-1 text-gray-600">管理所有電子報、文章、分類和用戶</p>
              </div>
              <button
                onClick={handleCreateNewsletter}
                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors font-medium"
                data-testid="create-newsletter-btn"
              >
                + 建立新電子報
              </button>
            </div>
          </div>

          {/* Success Message */}
          {successMessage && (
            <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-green-800 font-medium">{successMessage}</p>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-800 font-medium">錯誤</p>
              <p className="text-red-600 text-sm">{error}</p>
            </div>
          )}

          {/* Newsletter Table */}
          <NewsletterTable
            newsletters={newsletters}
            isLoading={isLoading}
            error={error}
            onEdit={handleEdit}
            onPublish={handlePublish}
            onArchive={handleArchive}
            onDelete={handleDelete}
            onFilterChange={handleFilterChange}
          />
        </div>
      </div>
    </ErrorBoundary>
  )
}

export default AdminDashboardPage
