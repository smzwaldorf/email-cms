import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AdminLayout } from '@/components/admin/AdminLayout'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { emailTemplateService } from '@/services/emailTemplateService'
import type { EmailTemplate } from '@/types/emailTemplate'

export function AdminEmailTemplatesPage() {
  const navigate = useNavigate()
  const [templates, setTemplates] = useState<EmailTemplate[]>([])
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const loadTemplates = async () => {
    try {
      setIsLoading(true)
      setError(null)
      const data = await emailTemplateService.listTemplates()
      setTemplates(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load templates')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    void loadTemplates()
  }, [])

  return (
    <ErrorBoundary>
      <AdminLayout activeTab="email-templates">
        <div className="space-y-6">
          {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
          <div className="rounded-xl border border-waldorf-cream-200 bg-white p-4">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-waldorf-clay-700">Email Templates</h2>
              <button
                type="button"
                onClick={() => navigate('/admin/email-templates/new')}
                className="rounded-lg bg-waldorf-sage-600 px-3 py-2 text-sm text-white hover:opacity-90"
              >
                New Template
              </button>
            </div>

            {isLoading ? (
              <p className="text-sm text-waldorf-clay-500">Loading...</p>
            ) : templates.length === 0 ? (
              <p className="text-sm text-waldorf-clay-600">No templates yet. Create your first template.</p>
            ) : (
              <div className="space-y-2">
                {templates.map((template) => (
                  <button
                    key={template.id}
                    onClick={() => navigate(`/admin/email-templates/${template.id}`)}
                    className="w-full rounded-lg border border-waldorf-cream-200 bg-white px-3 py-3 text-left text-sm hover:bg-waldorf-cream-50"
                  >
                    <p className="font-medium text-waldorf-clay-700">{template.name}</p>
                    <p className="mt-1 text-xs text-waldorf-clay-500">Updated: {new Date(template.updatedAt).toLocaleString()}</p>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </AdminLayout>
    </ErrorBoundary>
  )
}

export default AdminEmailTemplatesPage

