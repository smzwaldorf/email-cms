import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AdminLayout } from '@/components/admin/AdminLayout'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { emailTemplateService } from '@/services/emailTemplateService'
import {
  listFileEmailTemplateSources,
  previewFileEmailTemplateSource,
} from '@/services/fileEmailTemplateLoader'
import { createDefaultFileEmailTemplateRenderContext } from '@/services/fileEmailTemplatePreviewContext'
import type { EmailTemplate, EmailTemplateLifecycleState } from '@/types/emailTemplate'
import type { FileEmailTemplateSourceMetadata } from '@/types/fileEmailTemplate'

const STATE_BADGE: Record<EmailTemplateLifecycleState, { label: string; className: string }> = {
  active: { label: '使用中', className: 'bg-waldorf-sage-600 text-white' },
  draft: { label: 'Draft', className: 'bg-waldorf-cream-200 text-waldorf-clay-600' },
  inactive: { label: 'Inactive', className: 'bg-waldorf-cream-100 text-waldorf-clay-500' },
}

function StateBadge({ state }: { state: EmailTemplateLifecycleState }) {
  const badge = STATE_BADGE[state] ?? STATE_BADGE.inactive
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${badge.className}`}>
      {badge.label}
    </span>
  )
}

function formatUpdated(value: string): string {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('zh-TW')
}

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
      setFileSources(await listFileEmailTemplateSources())
    } catch (err) {
      setError(err instanceof Error ? err.message : '無法載入範本')
    } finally {
      setIsLoading(false)
    }
  }

  const handleSyncFileSource = async (source: FileEmailTemplateSourceMetadata) => {
    try {
      setSyncingSourceId(source.sourceId)
      setError(null)
      const preview = await previewFileEmailTemplateSource(
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
      setError(err instanceof Error ? err.message : '無法同步檔案範本')
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
      setError('請先儲存範本，再設為使用中。')
      return
    }
    try {
      setActivatingId(template.id)
      setError(null)
      await emailTemplateService.setActiveTemplate(template.id)
      // Reload so the badge moves and the previously-active row is demoted.
      await loadTemplates()
    } catch (err) {
      setError(err instanceof Error ? err.message : '無法更新使用中的範本')
    } finally {
      setActivatingId(null)
    }
  }

  const activeTemplate = useMemo(() => templates.find((template) => template.state === 'active') ?? null, [templates])
  const otherTemplates = useMemo(
    () =>
      templates
        .filter((template) => template.state !== 'active')
        .sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime()),
    [templates],
  )

  const renderActivateButton = (template: EmailTemplate, size: 'sm' | 'md' = 'sm') => {
    const isActive = template.state === 'active'
    const canActivate = !isActive && Boolean(template.currentRevisionId)
    const isActivating = activatingId === template.id
    const padding = size === 'md' ? 'px-4 py-2 text-sm' : 'px-3 py-1.5 text-xs'
    return (
      <button
        type="button"
        onClick={() => void handleSetActive(template)}
        disabled={!canActivate || isActivating}
        title={
          isActive
            ? '已用於發布電子報'
            : !template.currentRevisionId
              ? '請先儲存範本，再設為使用中'
              : '使用此範本發布電子報'
        }
        className={`rounded-lg font-medium transition-colors ${padding} ${
          isActive
            ? 'cursor-default bg-waldorf-sage-100 text-waldorf-sage-700'
            : canActivate
              ? 'border border-waldorf-sage-300 bg-white text-waldorf-sage-700 hover:bg-waldorf-sage-50'
              : 'cursor-not-allowed border border-waldorf-cream-300 bg-waldorf-cream-50 text-waldorf-clay-400'
        }`}
      >
        {isActive ? '使用中' : isActivating ? 'Activating…' : '使用此範本'}
      </button>
    )
  }

  return (
    <ErrorBoundary>
      <AdminLayout
        activeTab="email-templates"
        contentVariant="plain"
        title="電子郵件範本"
        description="電子報會使用標記為「使用中」的範本寄送。您可以在此編輯資料庫範本，或同步隨應用程式提供的唯讀檔案範本。"
        headerAction={
          <button
            type="button"
            onClick={() => navigate('/admin/email-templates/new')}
            className="group inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-waldorf-peach-500 to-waldorf-peach-600 px-5 py-2.5 font-medium text-white shadow-lg shadow-waldorf-peach-200/50 transition-all duration-300 hover:from-waldorf-peach-600 hover:to-waldorf-peach-700"
          >
            <svg className="h-5 w-5 transform transition-transform duration-300 group-hover:rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            新增範本
          </button>
        }
      >
        <div className="space-y-8">
          {error && (
            <div className="rounded-xl border border-waldorf-rose-200 bg-waldorf-rose-50 px-4 py-3 text-sm font-medium text-waldorf-rose-700">{error}</div>
          )}

          {/* Active template */}
          <section aria-labelledby="active-template-heading">
            <h2 id="active-template-heading" className="mb-3 text-xs font-semibold uppercase tracking-widest text-waldorf-clay-400">
              目前用於發布
            </h2>
            {isLoading ? (
              <div className="rounded-2xl border border-waldorf-cream-200 bg-white/80 p-6 text-sm text-waldorf-clay-500">載入中...</div>
            ) : activeTemplate ? (
              <div className="relative overflow-hidden rounded-2xl border border-waldorf-sage-300 bg-gradient-to-br from-waldorf-sage-50 via-white to-waldorf-cream-50 p-6 shadow-sm">
                <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-waldorf-sage-100/60 blur-2xl" />
                <div className="relative flex flex-wrap items-start justify-between gap-6">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-waldorf-sage-600 text-white shadow-sm">
                        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                      </span>
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-display text-2xl font-semibold text-waldorf-clay-800">{activeTemplate.name}</h3>
                          <StateBadge state={activeTemplate.state} />
                        </div>
                        <p className="mt-0.5 text-xs text-waldorf-clay-500">更新時間 {formatUpdated(activeTemplate.updatedAt)}</p>
                      </div>
                    </div>
                    {activeTemplate.description && (
                      <p className="mt-3 max-w-2xl text-sm text-waldorf-clay-600">{activeTemplate.description}</p>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      to="/admin/newsletters/preview"
                      className="rounded-lg border border-waldorf-clay-200 bg-white px-4 py-2 text-sm font-medium text-waldorf-clay-700 shadow-sm transition-colors hover:bg-waldorf-cream-50"
                    >
                      使用電子報預覽
                    </Link>
                    <button
                      type="button"
                      onClick={() => navigate(`/admin/email-templates/${activeTemplate.id}`)}
                      className="rounded-lg bg-waldorf-sage-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-waldorf-sage-700"
                    >
                      編輯範本
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-amber-200 bg-amber-50 p-5">
                <div className="flex items-start gap-3 text-sm text-amber-900">
                  <svg className="mt-0.5 h-5 w-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <div>
                    <p className="font-semibold">目前尚未啟用範本。</p>
                    <p className="mt-0.5">請先將已儲存的範本設為使用中，才能發布電子報。</p>
                  </div>
                </div>
                {templates.length === 0 && (
                  <button
                    type="button"
                    onClick={() => navigate('/admin/email-templates/new')}
                    className="rounded-lg bg-waldorf-sage-600 px-4 py-2 text-sm font-medium text-white hover:bg-waldorf-sage-700"
                  >
                    建立第一個範本
                  </button>
                )}
              </div>
            )}
          </section>

          {/* Other templates */}
          <section aria-labelledby="all-templates-heading">
            <div className="mb-3 flex items-baseline justify-between">
              <h2 id="all-templates-heading" className="text-xs font-semibold uppercase tracking-widest text-waldorf-clay-400">
                {activeTemplate ? '其他範本' : '所有範本'}
              </h2>
              {!isLoading && <span className="text-xs text-waldorf-clay-400">{otherTemplates.length} 範本{otherTemplates.length === 1 ? '' : 's'}</span>}
            </div>
            {isLoading ? null : otherTemplates.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-waldorf-cream-300 bg-white/60 p-8 text-center text-sm text-waldorf-clay-500">
                {templates.length === 0
                  ? '尚無範本。請建立第一個範本。'
                  : '沒有其他範本。可在編輯器中複製目前使用的範本，建立新版本。'}
              </div>
            ) : (
              <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {otherTemplates.map((template) => (
                  <li
                    key={template.id}
                    className="group flex flex-col rounded-2xl border border-waldorf-cream-200 bg-white/90 p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:border-waldorf-cream-300 hover:shadow-md"
                  >
                    <button
                      type="button"
                      onClick={() => navigate(`/admin/email-templates/${template.id}`)}
                      className="flex-1 text-left"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <h3 className="font-display text-lg font-semibold text-waldorf-clay-800 group-hover:text-waldorf-peach-700 transition-colors">
                          {template.name}
                        </h3>
                        <StateBadge state={template.state} />
                      </div>
                      {template.description && (
                        <p className="mt-2 line-clamp-2 text-sm text-waldorf-clay-600">{template.description}</p>
                      )}
                      <p className="mt-3 text-xs text-waldorf-clay-400">
                        更新時間 {formatUpdated(template.updatedAt)}
                        {!template.currentRevisionId && ' · 尚未儲存'}
                      </p>
                    </button>
                    <div className="mt-4 flex items-center justify-between gap-2 border-t border-waldorf-cream-200 pt-3">
                      <button
                        type="button"
                        onClick={() => navigate(`/admin/email-templates/${template.id}`)}
                        className="rounded-lg px-3 py-1.5 text-xs font-medium text-waldorf-clay-700 hover:bg-waldorf-cream-100"
                      >
                        編輯
                      </button>
                      {renderActivateButton(template)}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* File sources */}
          <section aria-labelledby="file-sources-heading" className="rounded-2xl border border-waldorf-cream-200 bg-white/80 p-6 shadow-sm">
            <div className="mb-4">
              <h2 id="file-sources-heading" className="font-display text-xl font-semibold text-waldorf-clay-800">檔案範本來源</h2>
              <p className="mt-1 text-sm text-waldorf-clay-500">
                隨程式打包的唯讀範本來源： <code className="rounded bg-waldorf-cream-100 px-1.5 py-0.5 text-xs">templates/email</code>。請在程式碼中編輯檔案，再預覽並同步資料庫版本快照。
              </p>
            </div>

            {fileSources.length === 0 ? (
              <p className="text-sm text-waldorf-clay-600">找不到檔案範本來源。</p>
            ) : (
              <ul className="grid gap-3 md:grid-cols-2">
                {fileSources.map((source) => (
                  <li
                    key={source.sourceId}
                    className="flex flex-col justify-between gap-4 rounded-xl border border-waldorf-cream-200 bg-waldorf-cream-50/50 p-4"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold text-waldorf-clay-800">{source.displayName}</p>
                        <span className="rounded-full bg-waldorf-cream-200 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-waldorf-clay-600">
                          唯讀檔案來源
                        </span>
                        {source.linkedTemplateId && (
                          <span className="rounded-full bg-waldorf-sage-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-waldorf-sage-700">
                            已同步
                          </span>
                        )}
                      </div>
                      {source.description && (
                        <p className="mt-1 text-sm text-waldorf-clay-600">{source.description}</p>
                      )}
                      <p className="mt-2 truncate font-mono text-[11px] text-waldorf-clay-400" title={source.folderPath}>{source.folderPath}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => navigate(`/admin/email-templates/file/${source.sourceId}`)}
                        className="rounded-lg border border-waldorf-clay-200 bg-white px-3 py-1.5 text-xs font-medium text-waldorf-clay-700 hover:bg-waldorf-cream-50"
                      >
                        預覽
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleSyncFileSource(source)}
                        disabled={syncingSourceId === source.sourceId}
                        className="rounded-lg border border-waldorf-sage-300 bg-white px-3 py-1.5 text-xs font-medium text-waldorf-sage-700 hover:bg-waldorf-sage-50 disabled:cursor-wait disabled:opacity-60"
                      >
                        {syncingSourceId === source.sourceId ? '同步中...' : '立即同步'}
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </AdminLayout>
    </ErrorBoundary>
  )
}

export default AdminEmailTemplatesPage
