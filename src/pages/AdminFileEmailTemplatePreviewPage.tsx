import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { AdminLayout } from '@/components/admin/AdminLayout'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { emailTemplateService } from '@/services/emailTemplateService'
import { previewFileEmailTemplateSource } from '@/services/fileEmailTemplateLoader'
import { createDefaultFileEmailTemplateRenderContext } from '@/services/fileEmailTemplatePreviewContext'

export function AdminFileEmailTemplatePreviewPage() {
  const navigate = useNavigate()
  const { sourceId } = useParams<{ sourceId: string }>()
  const [error, setError] = useState<string | null>(null)
  const [isSyncing, setIsSyncing] = useState(false)

  const preview = useMemo(() => {
    if (!sourceId) {
      return null
    }
    return previewFileEmailTemplateSource(sourceId, createDefaultFileEmailTemplateRenderContext())
  }, [sourceId])

  const blockingIssues = preview?.issues.filter((issue) => issue.severity === 'error') ?? []
  const warnings = preview?.issues.filter((issue) => issue.severity === 'warning') ?? []

  const handleSync = async () => {
    if (!preview || !preview.valid) {
      return
    }
    try {
      setIsSyncing(true)
      setError(null)
      const result = await emailTemplateService.syncFileTemplate({ preview })
      navigate(`/admin/email-templates/${result.template.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to sync file template')
    } finally {
      setIsSyncing(false)
    }
  }

  return (
    <ErrorBoundary>
      <AdminLayout activeTab="email-templates">
        <div className="space-y-6">
          <button
            type="button"
            onClick={() => navigate('/admin/email-templates')}
            className="text-sm font-medium text-waldorf-sage-700 hover:underline"
          >
            Back to email templates
          </button>

          {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

          {!preview ? (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              File template source not found: {sourceId}
            </div>
          ) : (
            <>
              <div className="rounded-xl border border-waldorf-cream-200 bg-white p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-lg font-semibold text-waldorf-clay-700">
                        {preview.source.displayName}
                      </h2>
                      <span className="rounded-full bg-waldorf-cream-200 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-waldorf-clay-600">
                        Read-only file source
                      </span>
                    </div>
                    {preview.source.description && (
                      <p className="mt-1 text-sm text-waldorf-clay-500">{preview.source.description}</p>
                    )}
                    <p className="mt-2 text-xs text-waldorf-clay-400">
                      Edit source files externally at <code>{preview.source.folderPath}</code>.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleSync()}
                    disabled={!preview.valid || isSyncing}
                    className="rounded-lg bg-waldorf-sage-600 px-3 py-2 text-sm font-medium text-white hover:opacity-90 disabled:cursor-not-allowed disabled:bg-waldorf-cream-300"
                  >
                    {isSyncing ? 'Syncing...' : 'Sync to database revision'}
                  </button>
                </div>
              </div>

              {(blockingIssues.length > 0 || warnings.length > 0) && (
                <div className="rounded-xl border border-waldorf-cream-200 bg-white p-4">
                  <h3 className="text-sm font-semibold text-waldorf-clay-700">Validation</h3>
                  {blockingIssues.length > 0 && (
                    <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3">
                      <p className="text-sm font-medium text-red-700">Blocking errors</p>
                      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-red-700">
                        {blockingIssues.map((issue, index) => (
                          <li key={`${issue.code}-${index}`}>{issue.message}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {warnings.length > 0 && (
                    <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
                      <p className="text-sm font-medium text-amber-800">Warnings</p>
                      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-amber-800">
                        {warnings.map((issue, index) => (
                          <li key={`${issue.code}-${index}`}>{issue.message}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
                <div className="rounded-xl border border-waldorf-cream-200 bg-white p-4">
                  <h3 className="text-sm font-semibold text-waldorf-clay-700">Rendered Subject</h3>
                  <p className="mt-3 rounded-lg bg-waldorf-cream-50 p-3 text-sm text-waldorf-clay-700">
                    {preview.renderedSubject}
                  </p>
                  <h3 className="mt-5 text-sm font-semibold text-waldorf-clay-700">Block Summary</h3>
                  <div className="mt-3 space-y-2">
                    {preview.blockPreviews.map((blockPreview) => (
                      <div
                        key={blockPreview.manifestBlock.id}
                        className="rounded-lg border border-waldorf-cream-200 px-3 py-2 text-xs text-waldorf-clay-600"
                      >
                        <div className="font-medium text-waldorf-clay-700">
                          {blockPreview.manifestBlock.label ?? blockPreview.manifestBlock.id}
                        </div>
                        <div>
                          {blockPreview.manifestBlock.mode} · {blockPreview.renderedFragments.length} rendered
                          fragment{blockPreview.renderedFragments.length === 1 ? '' : 's'}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-xl border border-waldorf-cream-200 bg-white p-4">
                  <h3 className="text-sm font-semibold text-waldorf-clay-700">Rendered HTML Body</h3>
                  <iframe
                    title="File email template preview"
                    srcDoc={preview.bodyHtml}
                    className="mt-3 h-[640px] w-full rounded-lg border border-waldorf-cream-200 bg-white"
                  />
                </div>
              </div>
            </>
          )}
        </div>
      </AdminLayout>
    </ErrorBoundary>
  )
}

export default AdminFileEmailTemplatePreviewPage
