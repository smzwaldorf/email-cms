/**
 * Admin Article List Page
 * Displays list of articles for a specific newsletter week
 * Shows newsletter status and allows navigation to article editor
 */

import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { adminService, AdminServiceError } from '@/services/adminService'
import type { AdminNewsletter, AdminArticle } from '@/types/admin'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import { ErrorBoundary } from '@/components/ErrorBoundary'

export function AdminArticleListPage() {
  const { weekNumber } = useParams<{ weekNumber: string }>()
  const navigate = useNavigate()

  const [newsletter, setNewsletter] = useState<AdminNewsletter | null>(null)
  const [articles, setArticles] = useState<AdminArticle[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (weekNumber) {
      loadData(weekNumber)
    }
  }, [weekNumber])

  const loadData = async (week: string) => {
    try {
      setIsLoading(true)
      setError(null)

      const [newsletterData, articlesData] = await Promise.all([
        adminService.fetchNewsletterByWeek(week),
        adminService.fetchArticlesByNewsletter(week),
      ])

      setNewsletter(newsletterData)
      setArticles(articlesData)
    } catch (err) {
      const message = err instanceof AdminServiceError ? err.message : err instanceof Error ? err.message : 'Failed to load data'
      setError(message)
      console.error('Error loading article list data:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const handleEditArticle = (articleId: string) => {
    navigate(`/admin/articles/${weekNumber}/${articleId}`)
  }

  const handleBack = () => {
    navigate('/admin')
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'published': return 'bg-green-100 text-green-800'
      case 'draft': return 'bg-yellow-100 text-yellow-800'
      case 'archived': return 'bg-gray-100 text-gray-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'published': return '已發布'
      case 'draft': return '草稿'
      case 'archived': return '已封存'
      default: return status
    }
  }

  if (isLoading) return <LoadingSpinner />

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-gray-100 py-8 px-4">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <button
              onClick={handleBack}
              className="text-blue-500 hover:text-blue-600 text-sm font-medium mb-4 flex items-center"
            >
              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Back to Dashboard
            </button>

            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">
                  Week {newsletter?.weekNumber} Articles
                </h1>
                <div className="mt-2 flex items-center space-x-4">
                  <span className="text-gray-600">
                    Release Date: {newsletter?.releaseDate ? new Date(newsletter.releaseDate).toLocaleDateString() : '-'}
                  </span>
                  {newsletter && (
                    <>
                      <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(newsletter.status)}`}>
                        {getStatusLabel(newsletter.status)}
                      </span>
                      <a
                        href={`/week/${newsletter.weekNumber}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-800 text-sm flex items-center ml-4"
                      >
                        View Public Newsletter
                        <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                      </a>
                    </>
                  )}
                </div>
              </div>
              <button
                onClick={() => navigate(`/admin/articles/${weekNumber}/create`)} // Assuming create route exists or will be handled
                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                disabled // Disable for now as create route might need adjustment
              >
                + Add Article
              </button>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-800 font-medium">Error</p>
              <p className="text-red-600 text-sm">{error}</p>
            </div>
          )}

          {/* Article List */}
          <div className="bg-white shadow rounded-lg overflow-hidden">
            {articles.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                No articles found for this week.
              </div>
            ) : (
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Order</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Title</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Author</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Last Edited</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {articles.map((article) => (
                    <tr key={article.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {article.order}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {article.title}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {article.author || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          article.status === 'published' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                        }`}>
                          {article.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {article.editedAt ? new Date(article.editedAt).toLocaleString() : '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button
                          onClick={() => handleEditArticle(article.id)}
                          className="text-blue-600 hover:text-blue-900"
                        >
                          Edit
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </ErrorBoundary>
  )
}

export default AdminArticleListPage
