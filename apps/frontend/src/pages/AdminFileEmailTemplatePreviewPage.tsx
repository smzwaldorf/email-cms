import { useEffect, useState } from 'react'
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
  const [isLoadingPreview, setIsLoadingPreview] = useState(false)
  const [preview, setPreview] = useState<Awaited<ReturnType<typeof previewFileEmailTemplateSource>>>(null)

  useEffect(() => {
    if (!sourceId) {
      setPreview(null)
      return
    }
    let cancelled = false
    setIsLoadingPreview(true)
    setError(null)
    previewFileEmailTemplateSource(sourceId, createDefaultFileEmailTemplateRenderContext())
      .then((result) => {
        if (!cancelled) {
          setPreview(result)
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setPreview(null)
          setError(err instanceof Error ? err.message : '無法載入檔案範本預覽')
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoadingPreview(false)
        }
      })
    return () => {
      cancelled = true
    }
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
      setError(err instanceof Error ? err.message : '無法同步檔案範本')
    } finally {
      setIsSyncing(false)
    }
  }

  return (
    <ErrorBoundary>
      <AdminLayout
        activeTab="email-templates"
        contentVariant="plain"
        title="檔案範本預覽"
        description="以範例資料預覽唯讀範本。同步後會建立可供電子報使用的資料庫版本。"
        backLink={{ to: '/admin/email-templates', label: '返回範本列表' }}
      >
        <div className="space-y-6">
          {error && <div className="rounded-xl border border-waldorf-rose-200 bg-waldorf-rose-50 px-4 py-3 text-sm font-medium text-waldorf-rose-700">{error}</div>}

          {isLoadingPreview ? (
            <p className="text-sm text-waldorf-clay-500">正在載入預覽...</p>
          ) : !preview ? (
            <div className="rounded-xl border border-waldorf-rose-200 bg-waldorf-rose-50 p-4 text-sm text-waldorf-rose-700">
              找不到檔案範本來源： {sourceId}
            </div>
          ) : (
            <>
              <div className="rounded-2xl border border-waldorf-cream-200 bg-white/90 p-5 shadow-sm">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-lg font-semibold text-waldorf-clay-700">
                        {preview.source.displayName}
                      </h2>
                      <span className="rounded-full bg-waldorf-cream-200 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-waldorf-clay-600">
                        唯讀檔案來源
                      </span>
                    </div>
                    {preview.source.description && (
                      <p className="mt-1 text-sm text-waldorf-clay-500">{preview.source.description}</p>
                    )}
                    <p className="mt-2 text-xs text-waldorf-clay-400">
                      請在程式碼中編輯來源檔案： <code>{preview.source.folderPath}</code>.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleSync()}
                    disabled={!preview.valid || isSyncing}
                    className="rounded-lg bg-waldorf-sage-600 px-3 py-2 text-sm font-medium text-white hover:opacity-90 disabled:cursor-not-allowed disabled:bg-waldorf-cream-300"
                  >
                    {isSyncing ? '同步中...' : '同步為資料庫版本'}
                  </button>
                </div>
              </div>

              {(blockingIssues.length > 0 || warnings.length > 0) && (
                <div className="rounded-2xl border border-waldorf-cream-200 bg-white/90 p-5 shadow-sm">
                  <h3 className="text-sm font-semibold text-waldorf-clay-700">驗證結果</h3>
                  {blockingIssues.length > 0 && (
                    <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3">
                      <p className="text-sm font-medium text-red-700">阻擋錯誤</p>
                      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-red-700">
                        {blockingIssues.map((issue, index) => (
                          <li key={`${issue.code}-${index}`}>{issue.message}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {warnings.length > 0 && (
                    <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
                      <p className="text-sm font-medium text-amber-800">警告</p>
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
                <div className="rounded-2xl border border-waldorf-cream-200 bg-white/90 p-5 shadow-sm">
                  <h3 className="text-sm font-semibold text-waldorf-clay-700">產生的主旨</h3>
                  <p className="mt-3 rounded-lg bg-waldorf-cream-50 p-3 text-sm text-waldorf-clay-700">
                    {preview.renderedSubject}
                  </p>
                  <h3 className="mt-5 text-sm font-semibold text-waldorf-clay-700">區塊摘要</h3>
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
                          {blockPreview.manifestBlock.mode} · {blockPreview.renderedFragments.length} 產生的片段{blockPreview.renderedFragments.length === 1 ? '' : 's'}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-2xl border border-waldorf-cream-200 bg-white/90 p-5 shadow-sm">
                  <h3 className="text-sm font-semibold text-waldorf-clay-700">產生的 HTML 內文</h3>
                  <iframe
                    title="檔案電子郵件範本預覽"
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
