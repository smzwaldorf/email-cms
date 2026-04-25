import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AdminLayout } from '@/components/admin/AdminLayout'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { emailTemplateService } from '@/services/emailTemplateService'
import {
  listFileEmailTemplateSources,
  previewFileEmailTemplateSource,
} from '@/services/fileEmailTemplateLoader'
import { createDefaultFileEmailTemplateRenderContext } from '@/services/fileEmailTemplatePreviewContext'
import type { EmailTemplate } from '@/types/emailTemplate'
import type { FileEmailTemplateSourceMetadata } from '@/types/fileEmailTemplate'

export function AdminEmailTemplatesPage() {
  const navigate = useNavigate()
  const [templates, setTemplates] = useState<EmailTemplate[]>([])
  const [fileSources, setFileSources] = useState<FileEmailTemplateSourceMetadata[]>([])
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [activatingId, setActivatingId] = useState<string | null>(null)
  const [syncingSourceId, setSyncingSourceId] = useState<string | null>(null)

  const loadTemplates = async () => {
    try {
      setIsLoading(true)
      setError(null)
      const data = await emailTemplateService.listTemplates()
      setTemplates(data)
      setFileSources(listFileEmailTemplateSources())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load templates')
    } finally {
      setIsLoading(false)
    }
  }

  const handleSyncFileSource = async (source: FileEmailTemplateSourceMetadata) => {
    try {
      setSyncingSourceId(source.sourceId)
      setError(null)
      const preview = previewFileEmailTemplateSource(
        source.sourceId,
        createDefaultFileEmailTemplateRenderContext(),
      )
      if (!preview) {
        setError(`File template source not found: ${source.sourceId}`)
        return
      }
      if (!preview.valid) {
        setError(preview.issues.map((issue) => issue.message).join(' '))
        return
      }
      await emailTemplateService.syncFileTemplate({ preview })
      await loadTemplates()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to sync file template')
    } finally {
      setSyncingSourceId(null)
    }
  }

  useEffect(() => {
    void loadTemplates()
  }, [])

  const handleSetActive = async (template: EmailTemplate) => {
    if (template.state === 'active') return
    if (!template.currentRevisionId) {
      setError('Save the template at least once before marking it as active.')
      return
    }
    try {
      setActivatingId(template.id)
      setError(null)
      await emailTemplateService.setActiveTemplate(template.id)
      // Reload so the badge moves and the previously-active row is demoted.
      await loadTemplates()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update active template')
    } finally {
      setActivatingId(null)
    }
  }

  return (
    <ErrorBoundary>
      <AdminLayout activeTab="email-templates">
        <div className="space-y-6">
          {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
          <div className="rounded-xl border border-waldorf-cream-200 bg-white p-4">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-waldorf-clay-700">Email Templates</h2>
                <p className="mt-1 text-xs text-waldorf-clay-500">
                  Newsletters publish using the template marked <span className="font-medium">In use</span>.
                </p>
              </div>
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
                {templates.map((template) => {
                  const isActive = template.state === 'active'
                  const canActivate = !isActive && Boolean(template.currentRevisionId)
                  return (
                    <div
                      key={template.id}
                      className={`flex items-center gap-3 rounded-lg border px-3 py-3 text-sm ${
                        isActive
                          ? 'border-waldorf-sage-300 bg-waldorf-sage-50/40'
                          : 'border-waldorf-cream-200 bg-white'
                      }`}
                    >
                      <button
                        onClick={() => navigate(`/admin/email-templates/${template.id}`)}
                        className="flex-1 text-left hover:opacity-80"
                      >
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-waldorf-clay-700">{template.name}</p>
                          {isActive ? (
                            <span className="rounded-full bg-waldorf-sage-600 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                              In use
                            </span>
                          ) : template.state === 'draft' ? (
                            <span className="rounded-full bg-waldorf-cream-200 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-waldorf-clay-600">
                              Draft
                            </span>
                          ) : (
                            <span className="rounded-full bg-waldorf-cream-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-waldorf-clay-500">
                              Inactive
                            </span>
                          )}
                        </div>
                        <p className="mt-1 text-xs text-waldorf-clay-500">Updated: {new Date(template.updatedAt).toLocaleString()}</p>
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleSetActive(template)}
                        disabled={!canActivate || activatingId === template.id}
                        title={
                          isActive
                            ? 'Already in use for newsletter publishing'
                            : !template.currentRevisionId
                              ? 'Save the template at least once before marking it as active'
                              : 'Use this template for newsletter publishing'
                        }
                        className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
                          isActive
                            ? 'cursor-default bg-waldorf-sage-100 text-waldorf-sage-700'
                            : canActivate
                              ? 'border border-waldorf-sage-300 bg-white text-waldorf-sage-700 hover:bg-waldorf-sage-50'
                              : 'cursor-not-allowed border border-waldorf-cream-300 bg-waldorf-cream-50 text-waldorf-clay-400'
                        }`}
                      >
                        {isActive
                          ? 'In use'
                          : activatingId === template.id
                            ? 'Activating…'
                            : 'Use this template'}
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          <div className="rounded-xl border border-waldorf-cream-200 bg-white p-4">
            <div className="mb-4">
              <h2 className="text-sm font-semibold text-waldorf-clay-700">File Template Sources</h2>
              <p className="mt-1 text-xs text-waldorf-clay-500">
                Read-only templates bundled from <code>templates/email</code>. Edit files externally, then preview
                and sync a database revision snapshot.
              </p>
            </div>

            {fileSources.length === 0 ? (
              <p className="text-sm text-waldorf-clay-600">No file template sources found.</p>
            ) : (
              <div className="space-y-2">
                {fileSources.map((source) => (
                  <div
                    key={source.sourceId}
                    className="flex items-center gap-3 rounded-lg border border-waldorf-cream-200 bg-waldorf-cream-50/40 px-3 py-3 text-sm"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-waldorf-clay-700">{source.displayName}</p>
                        <span className="rounded-full bg-waldorf-cream-200 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-waldorf-clay-600">
                          Read-only file source
                        </span>
                      </div>
                      {source.description && (
                        <p className="mt-1 text-xs text-waldorf-clay-500">{source.description}</p>
                      )}
                      <p className="mt-1 text-xs text-waldorf-clay-400">{source.folderPath}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => navigate(`/admin/email-templates/file/${source.sourceId}`)}
                      className="rounded-lg border border-waldorf-clay-200 bg-white px-3 py-1.5 text-xs font-medium text-waldorf-clay-700 hover:bg-waldorf-cream-50"
                    >
                      Preview
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleSyncFileSource(source)}
                      disabled={syncingSourceId === source.sourceId}
                      className="rounded-lg border border-waldorf-sage-300 bg-white px-3 py-1.5 text-xs font-medium text-waldorf-sage-700 hover:bg-waldorf-sage-50 disabled:cursor-wait disabled:opacity-60"
                    >
                      {syncingSourceId === source.sourceId ? 'Syncing...' : 'Sync now'}
                    </button>
                  </div>
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
