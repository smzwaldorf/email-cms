import { useEffect, useMemo, useState, type ChangeEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import type { Editor } from '@tiptap/react'
import { AdminLayout } from '@/components/admin/AdminLayout'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { SimpleEditor } from '@/components/tiptap-templates/simple/simple-editor'
import { detectCanvaSections, type CanvaEmailImportIssue } from '@/services/canvaEmailImport'
import { createStarterEmailBlocks, getEmailBlockTypeDefinition } from '@/services/emailTemplateBlocks'
import { emailTemplateService } from '@/services/emailTemplateService'
import {
  EMAIL_TEMPLATE_TOKENS,
  renderEmailTemplatePreview,
  validateEmailTemplate,
  type EmailTemplateRenderContext,
} from '@/services/emailTemplateTokens'
import type { EmailTemplate, EmailTemplateBlock, EmailTemplateRevision } from '@/types/emailTemplate'
import { EmailTemplateBlockList } from '@/components/admin/EmailTemplateBlockList'
import { replaceStorageTokens } from '@/utils/contentParser'

const TOKEN_EXAMPLES = {
  'guardian.id': 'guardian-demo',
  'guardian.email': 'guardian@example.com',
  'family.id': 'family-001',
  'newsletter.id': 'newsletter-demo',
  'newsletter.title': '每週電子報',
  'newsletter.revisionId': 'newsletter-rev-1',
  'newsletter.url': 'https://example.com/week/2025-W38',
  'classes.count': '2',
  'classes.list': 'A1, B1',
} as const satisfies Record<(typeof EMAIL_TEMPLATE_TOKENS)[number], string>

function buildDemoEmailPreviewContext(): EmailTemplateRenderContext {
  const truncate = (value: string, max = 20): string =>
    value.length > max ? `${value.slice(0, max)}...` : value
  return {
    guardian: {
      id: truncate('guardian-demo-very-long-id-123456789'),
      email: truncate('guardian.very.long.email@example.com'),
    },
    family: {
      id: truncate('family-very-long-id-987654321'),
    },
    newsletter: {
      id: truncate('newsletter-demo-long-id'),
      title: truncate('每週電子報範例'),
      revisionId: truncate('newsletter-revision-long-id'),
      url: 'https://example.com/week/2025-W38',
    },
    classes: {
      ids: ['A1', 'B1', 'C1'],
    },
  }
}

function EmailPreviewFrame({ html, decode }: { html: string; decode: (value: string) => string }) {
  const raw = decode(html)
  if (!raw.trim()) {
    return <p className="py-8 text-center text-sm text-waldorf-clay-500">（空白）</p>
  }
  const isFullDoc = /^\s*<!doctype/i.test(raw) || /<html[\s>]/i.test(raw.trim())
  if (isFullDoc) {
    return (
      <iframe
        title="電子郵件預覽"
        sandbox="allow-same-origin"
        srcDoc={raw}
        className="h-[min(640px,70vh)] w-full rounded-lg border border-waldorf-cream-200 bg-white shadow-sm"
      />
    )
  }
  return (
    <div
      className="prose max-h-[min(640px,70vh)] max-w-none overflow-y-auto rounded-lg border border-waldorf-cream-200 bg-white p-4 text-sm shadow-sm"
      dangerouslySetInnerHTML={{ __html: raw || '<p>(empty)</p>' }}
    />
  )
}

export function AdminEmailTemplateEditorPage() {
  const { templateId } = useParams<{ templateId: string }>()
  const navigate = useNavigate()
  const isNew = !templateId

  const [editingRevision, setEditingRevision] = useState<EmailTemplateRevision | null>(null)
  const [editingTemplate, setEditingTemplate] = useState<EmailTemplate | null>(null)
  const [isActivating, setIsActivating] = useState(false)
  const [name, setName] = useState('')
  const [subjectTemplate, setSubjectTemplate] = useState('')
  const [bodyTemplate, setBodyTemplate] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [bodyEditor, setBodyEditor] = useState<Editor | null>(null)
  const [importIssues, setImportIssues] = useState<CanvaEmailImportIssue[]>([])
  const [showImportPanel, setShowImportPanel] = useState(false)
  const [importHtml, setImportHtml] = useState('')
  const [rawImportedHtml, setRawImportedHtml] = useState<string | null>(null)
  const [bodyEditorMode, setBodyEditorMode] = useState<'tiptap' | 'html'>('tiptap')
  // Block list snapshot. When non-empty, persisted to `email_template_revisions.blocks`
  // and rendered through the block walker; otherwise the legacy single-body path is used.
  const [editorBlocks, setEditorBlocks] = useState<EmailTemplateBlock[] | null>(() =>
    !templateId ? createStarterEmailBlocks() : null,
  )
  const [importDetectionMessage, setImportDetectionMessage] = useState<string | null>(null)
  /** Combined = full walker output with document shell; block = one block fragment with sample repeater data. */
  const [previewScope, setPreviewScope] = useState<'combined' | 'block'>('combined')
  const [previewBlockIndex, setPreviewBlockIndex] = useState(0)
  const [copiedToken, setCopiedToken] = useState<string | null>(null)

  const importResult = useMemo(
    () => (rawImportedHtml !== null ? emailTemplateService.normalizeImportedBodyHtml(rawImportedHtml) : null),
    [rawImportedHtml],
  )
  const effectiveBodyTemplate = importResult?.normalizedHtml ?? bodyTemplate

  // Block-based layout is the default (see `createStarterEmailBlocks`). The single-body
  // editor appears only when the template is exactly one `custom-html` block (legacy shape).
  const isLegacySingleBlock =
    editorBlocks !== null && editorBlocks.length === 1 && editorBlocks[0].type === 'custom-html'
  const showBlockList = editorBlocks !== null && !isLegacySingleBlock

  const validation = useMemo(
    () => validateEmailTemplate(subjectTemplate, effectiveBodyTemplate, editorBlocks ?? undefined),
    [subjectTemplate, effectiveBodyTemplate, editorBlocks],
  )
  const hasValidationIssues = validation.issues.length > 0 || (importResult?.hasBlockingIssues ?? false)

  const livePreview = useMemo(() => {
    const context = buildDemoEmailPreviewContext()
    const legacySingle =
      editorBlocks !== null && editorBlocks.length === 1 && editorBlocks[0].type === 'custom-html'
    const listMode = editorBlocks !== null && !legacySingle

    if (listMode && editorBlocks && editorBlocks.length > 0) {
      if (previewScope === 'block') {
        const idx = Math.min(Math.max(0, previewBlockIndex), editorBlocks.length - 1)
        const block = editorBlocks[idx]
        const blockPreview = emailTemplateService.previewBlock(block, context)
        const subjectPreview = renderEmailTemplatePreview(subjectTemplate, '', context)
        return {
          subject: subjectPreview.subject,
          body: blockPreview.body,
          warnings: [
            ...subjectPreview.warnings.map((w) => w.message),
            ...blockPreview.warnings.map((w) => w.message),
          ],
        }
      }
      const preview = emailTemplateService.previewRevision(
        {
          subjectTemplate,
          bodyTemplate: effectiveBodyTemplate,
          blocks: editorBlocks,
        },
        context,
      )
      return {
        subject: preview.subject,
        body: preview.body,
        warnings: preview.warnings.map((w) => w.message),
      }
    }

    const preview = emailTemplateService.previewRevision(
      {
        subjectTemplate,
        bodyTemplate: effectiveBodyTemplate,
      },
      context,
    )
    return {
      subject: preview.subject,
      body: preview.body,
      warnings: preview.warnings.map((w) => w.message),
    }
  }, [subjectTemplate, effectiveBodyTemplate, editorBlocks, previewScope, previewBlockIndex])

  const [resolvedLivePreviewBody, setResolvedLivePreviewBody] = useState<string | null>(null)

  useEffect(() => {
    const raw = livePreview.body
    if (!raw.includes('storage://')) {
      setResolvedLivePreviewBody(raw)
      return
    }
    setResolvedLivePreviewBody(null)
    let cancelled = false
    void replaceStorageTokens(raw, 60 * 60).then((out) => {
      if (!cancelled) setResolvedLivePreviewBody(out)
    })
    return () => {
      cancelled = true
    }
  }, [livePreview.body])

  const livePreviewFrameHtml = livePreview.body.includes('storage://')
    ? (resolvedLivePreviewBody ?? '')
    : livePreview.body
  const livePreviewResolvingGallery =
    livePreview.body.includes('storage://') && resolvedLivePreviewBody === null

  useEffect(() => {
    if (isNew || !templateId) return

    const loadTemplate = async () => {
      try {
        setIsLoading(true)
        setError(null)
        const current = await emailTemplateService.getCurrentRevision(templateId)
        setName(current.template.name)
        setSubjectTemplate(current.revision.subjectTemplate)
        setBodyTemplate(current.revision.bodyTemplate)
        setRawImportedHtml(null)
        setImportIssues([])
        const loadedBlocks = current.revision.blocks
        if (loadedBlocks.length === 1 && loadedBlocks[0].type === 'custom-html') {
          setEditorBlocks(
            createStarterEmailBlocks({
              mainBodyHtml: loadedBlocks[0].bodyHtml,
              mainConfig: loadedBlocks[0].config,
            }),
          )
        } else if (loadedBlocks.length > 0) {
          setEditorBlocks(loadedBlocks)
        } else {
          setEditorBlocks(createStarterEmailBlocks())
        }
        setImportDetectionMessage(null)
        setEditingRevision(current.revision)
        setEditingTemplate(current.template)
      } catch (err) {
        setError(err instanceof Error ? err.message : '無法載入範本')
      } finally {
        setIsLoading(false)
      }
    }

    void loadTemplate()
  }, [isNew, templateId])

  useEffect(() => {
    if (!editorBlocks?.length) return
    if (previewBlockIndex >= editorBlocks.length) {
      setPreviewBlockIndex(Math.max(0, editorBlocks.length - 1))
    }
  }, [editorBlocks, previewBlockIndex])

  const handleCreate = async () => {
    if (hasValidationIssues) {
      setError('請先修正範本驗證錯誤，再儲存。')
      return
    }

    setIsSaving(true)
    setError(null)
    try {
      const created = await emailTemplateService.createTemplate({
        name: name || '未命名範本',
        subjectTemplate,
        bodyTemplate: effectiveBodyTemplate,
        blocks: editorBlocks ?? undefined,
        importedBodyHtml: rawImportedHtml,
      })
      setSuccess('範本已建立。')
      navigate(`/admin/email-templates/${created.template.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : '無法建立範本')
    } finally {
      setIsSaving(false)
    }
  }

  const handleSave = async () => {
    if (!templateId) return
    if (hasValidationIssues) {
      setError('請先修正範本驗證錯誤，再儲存。')
      return
    }

    setIsSaving(true)
    setError(null)
    try {
      const updated = await emailTemplateService.updateTemplateRevision(templateId, {
        name,
        subjectTemplate,
        bodyTemplate: effectiveBodyTemplate,
        blocks: editorBlocks ?? undefined,
        importedBodyHtml: rawImportedHtml,
      })
      setEditingRevision(updated.revision)
      setEditingTemplate(updated.template)
      setEditorBlocks(updated.revision.blocks.length > 0 ? updated.revision.blocks : null)
      setSuccess(`Saved revision v${updated.revision.revisionNumber}.`)
    } catch (err) {
      setError(err instanceof Error ? err.message : '無法儲存範本')
    } finally {
      setIsSaving(false)
    }
  }

  const handleDuplicate = async () => {
    if (!templateId) return
    setIsSaving(true)
    setError(null)
    try {
      const duplicated = await emailTemplateService.duplicateTemplate(templateId)
      setSuccess('範本已複製。')
      navigate(`/admin/email-templates/${duplicated.template.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : '無法複製範本')
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!templateId) return
    const confirmed = window.confirm('確定要刪除此範本嗎？此操作無法復原。')
    if (!confirmed) return

    setIsSaving(true)
    setError(null)
    try {
      await emailTemplateService.deleteTemplate(templateId)
      navigate('/admin/email-templates')
    } catch (err) {
      setError(err instanceof Error ? err.message : '無法刪除範本')
    } finally {
      setIsSaving(false)
    }
  }

  const handleSetActive = async () => {
    if (!templateId) return
    if (!editingTemplate?.currentRevisionId) {
      setError('請先儲存範本，再設為使用中。')
      return
    }
    setIsActivating(true)
    setError(null)
    try {
      const updated = await emailTemplateService.setActiveTemplate(templateId)
      setEditingTemplate(updated)
      setSuccess('此範本現已用於發布電子報。')
    } catch (err) {
      setError(err instanceof Error ? err.message : '無法將範本設為使用中')
    } finally {
      setIsActivating(false)
    }
  }

  const handleInsertToken = (token: string) => {
    if (!bodyEditor) return
    bodyEditor.chain().focus().insertContent(`{{${token}}}`).run()
  }

  const handleApplyImportedHtml = () => {
    const nextImportResult = emailTemplateService.normalizeImportedBodyHtml(importHtml)
    setRawImportedHtml(importHtml)
    setBodyTemplate(nextImportResult.normalizedHtml)
    setImportIssues(nextImportResult.issues)
    setBodyEditorMode('html')
    setShowImportPanel(false)
    if (nextImportResult.hasBlockingIssues) {
      setError('匯入的 HTML 有相容性問題。請先修正再儲存。')
      setSuccess(null)
      setEditorBlocks(createStarterEmailBlocks({ mainBodyHtml: nextImportResult.normalizedHtml }))
      setImportDetectionMessage(null)
      return
    }
    // If fewer than three Canva-style sections match, place markup in the middle custom-html block.
    const detected = detectCanvaSections(nextImportResult.normalizedHtml)
    if (detected && detected.length >= 3) {
      setEditorBlocks(detected)
      setImportDetectionMessage(
        `Detected ${detected.length} sections from imported HTML and mapped them to typed blocks.`,
      )
    } else {
      setEditorBlocks(createStarterEmailBlocks({ mainBodyHtml: nextImportResult.normalizedHtml }))
      setImportDetectionMessage(
        '無法辨識至少三個區段；主要內容已放入頁首與頁尾之間的自訂 HTML 區塊。',
      )
    }

    setError(null)
    setSuccess('HTML 已匯入。相容的標記會保留供儲存與預覽使用。')
  }

  const handleImportFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    try {
      const text = await file.text()
      setImportHtml(text)
      setShowImportPanel(true)
      setSuccess(null)
      setError(null)
    } catch {
      setError('無法讀取 HTML 檔案。')
    } finally {
      event.target.value = ''
    }
  }

  const decodePreviewHtml = (value: string): string => {
    if (!value) return ''
    if (value.includes('&lt;') || value.includes('&gt;')) {
      const textarea = document.createElement('textarea')
      textarea.innerHTML = value
      return textarea.value || value
    }
    return value
  }


  const handleTokenChipClick = (token: string) => {
    if (bodyEditor) {
      handleInsertToken(token)
      return
    }
    // Block editors manage their own TipTap instances, so fall back to the clipboard.
    void navigator.clipboard?.writeText(`{{${token}}}`)
    setCopiedToken(token)
    window.setTimeout(() => setCopiedToken((current) => (current === token ? null : current)), 1500)
  }

  const stateBadge = editingTemplate
    ? editingTemplate.state === 'active'
      ? { label: '使用中', className: 'bg-waldorf-sage-600 text-white' }
      : editingTemplate.state === 'draft'
        ? { label: 'Draft', className: 'bg-waldorf-cream-200 text-waldorf-clay-600' }
        : { label: 'Inactive', className: 'bg-waldorf-cream-100 text-waldorf-clay-500' }
    : null

  const cardClass = 'rounded-2xl border border-waldorf-cream-200 bg-white/90 backdrop-blur-sm shadow-sm'
  const cardTitleClass = 'font-display text-lg font-semibold text-waldorf-clay-800'
  const inputClass =
    'w-full rounded-lg border border-waldorf-cream-300 bg-white px-3 py-2.5 text-sm text-waldorf-clay-700 focus:border-waldorf-sage-400 focus:outline-none focus:ring-2 focus:ring-waldorf-sage-200'
  const secondaryButtonClass =
    'rounded-lg border border-waldorf-cream-300 bg-white px-3 py-2 text-sm font-medium text-waldorf-clay-700 transition-colors hover:bg-waldorf-cream-100 disabled:cursor-not-allowed disabled:opacity-50'

  return (
    <ErrorBoundary>
      <AdminLayout
        activeTab="email-templates"
        contentVariant="plain"
        title={isNew ? '新增電子郵件範本' : '編輯電子郵件範本'}
        description={
          isNew
            ? '編寫主旨與內文區塊，檢查即時預覽後再建立範本。'
            : '每次儲存都會建立新版本。電子報使用發布時的範本版本。'
        }
        backLink={{ to: '/admin/email-templates', label: '返回範本列表' }}
      >
        <div className="space-y-6">
          {/* Action bar */}
          <div className={`${cardClass} flex flex-wrap items-center justify-between gap-4 px-5 py-4`}>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="truncate font-display text-xl font-semibold text-waldorf-clay-800">
                  {name.trim() || '未命名範本'}
                </h2>
                {stateBadge && (
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${stateBadge.className}`}>
                    {stateBadge.label}
                  </span>
                )}
              </div>
              <p className="mt-0.5 text-xs text-waldorf-clay-500">
                {isNew
                  ? '尚未儲存'
                  : editingRevision
                    ? `版本 v${editingRevision.revisionNumber} · 儲存於 ${new Date(editingRevision.createdAt).toLocaleString('zh-TW')}`
                    : '正在載入版本…'}
                {hasValidationIssues && <span className="ml-2 font-medium text-amber-700">· 請先解決驗證問題才能儲存</span>}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {!isNew && editingTemplate && editingTemplate.state !== 'active' && (
                <button
                  type="button"
                  onClick={() => void handleSetActive()}
                  disabled={isActivating || !editingTemplate.currentRevisionId}
                  title={
                    !editingTemplate.currentRevisionId
                      ? '請先儲存範本，再設為使用中'
                      : '使用此範本發布電子報'
                  }
                  className="rounded-lg border border-waldorf-sage-300 bg-white px-3 py-2 text-sm font-medium text-waldorf-sage-700 transition-colors hover:bg-waldorf-sage-50 disabled:opacity-50"
                >
                  {isActivating ? 'Activating…' : '使用此範本'}
                </button>
              )}
              {!isNew && (
                <>
                  <button onClick={handleDuplicate} disabled={isSaving} className={secondaryButtonClass}>
                    複製
                  </button>
                  <button
                    onClick={handleDelete}
                    disabled={isSaving}
                    className="rounded-lg border border-waldorf-rose-200 bg-white px-3 py-2 text-sm font-medium text-waldorf-rose-700 transition-colors hover:bg-waldorf-rose-50 disabled:opacity-50"
                  >
                    刪除
                  </button>
                </>
              )}
              {isNew ? (
                <button
                  onClick={handleCreate}
                  disabled={isSaving || hasValidationIssues}
                  className="rounded-lg bg-gradient-to-r from-waldorf-sage-500 to-waldorf-sage-600 px-4 py-2 text-sm font-medium text-white shadow-lg shadow-waldorf-sage-200/50 transition-all hover:from-waldorf-sage-600 hover:to-waldorf-sage-700 disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none"
                >
                  {isSaving ? 'Creating…' : 'Create'}
                </button>
              ) : (
                <button
                  onClick={handleSave}
                  disabled={isSaving || hasValidationIssues}
                  className="rounded-lg bg-gradient-to-r from-waldorf-peach-500 to-waldorf-peach-600 px-4 py-2 text-sm font-medium text-white shadow-lg shadow-waldorf-peach-200/50 transition-all hover:from-waldorf-peach-600 hover:to-waldorf-peach-700 disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none"
                >
                  {isSaving ? '儲存中…' : '儲存'}
                </button>
              )}
            </div>
          </div>

          {error && <div className="rounded-xl border border-waldorf-rose-200 bg-waldorf-rose-50 px-4 py-3 text-sm font-medium text-waldorf-rose-700">{error}</div>}
          {success && <div className="rounded-xl border border-waldorf-sage-200 bg-waldorf-sage-50 px-4 py-3 text-sm font-medium text-waldorf-sage-700">{success}</div>}

          {isLoading ? (
            <div className={`${cardClass} p-8 text-sm text-waldorf-clay-500`}>載入中...</div>
          ) : (
            <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(380px,42%)] xl:items-start">
              {/* Editor column */}
              <div className="space-y-6">
                <section className={`${cardClass} p-5`}>
                  <h3 className={cardTitleClass}>範本詳細資料</h3>
                  <div className="mt-4 space-y-4">
                    <label className="block">
                      <span className="mb-1.5 block text-xs font-medium text-waldorf-clay-600">範本名稱</span>
                      <input
                        value={name}
                        onChange={(event) => setName(event.target.value)}
                        placeholder="範本名稱"
                        className={inputClass}
                      />
                    </label>
                    <label className="block">
                      <span className="mb-1.5 flex items-center justify-between text-xs font-medium text-waldorf-clay-600">
                        <span>主旨範本</span>
                        <span className="font-normal text-waldorf-clay-400">支援這類變數： {'{{newsletter.title}}'}</span>
                      </span>
                      <textarea
                        value={subjectTemplate}
                        onChange={(event) => setSubjectTemplate(event.target.value)}
                        placeholder="主旨範本"
                        rows={2}
                        className={inputClass}
                      />
                    </label>
                  </div>
                </section>

                <section className={`${cardClass} p-5`}>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h3 className={cardTitleClass}>{showBlockList ? '範本區塊' : '內文範本'}</h3>
                      <p className="mt-0.5 text-xs text-waldorf-clay-500">
                        {showBlockList
                          ? '區塊依序由上至下呈現。隱藏區塊可略過內容而不刪除。'
                          : '單一內文範本。可使用視覺化編輯器或貼上 HTML。'}
                      </p>
                    </div>
                    {!showBlockList && (
                      <div className="inline-flex overflow-hidden rounded-lg border border-waldorf-cream-300 text-xs">
                        <button
                          type="button"
                          onClick={() => {
                            setRawImportedHtml(null)
                            setImportIssues([])
                            setBodyEditorMode('tiptap')
                          }}
                          className={`px-3 py-1.5 font-medium ${bodyEditorMode === 'tiptap' ? 'bg-waldorf-clay-700 text-white' : 'bg-white text-waldorf-clay-600 hover:bg-waldorf-cream-50'}`}
                        >
                          TipTap
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setRawImportedHtml(effectiveBodyTemplate)
                            setImportIssues([])
                            setBodyEditorMode('html')
                          }}
                          className={`border-l border-waldorf-cream-300 px-3 py-1.5 font-medium ${bodyEditorMode === 'html' ? 'bg-waldorf-clay-700 text-white' : 'bg-white text-waldorf-clay-600 hover:bg-waldorf-cream-50'}`}
                        >
                          HTML
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="mt-4 space-y-3">
                    {showBlockList ? (
                      <EmailTemplateBlockList
                        blocks={editorBlocks ?? []}
                        onChange={(next) => setEditorBlocks(next.length > 0 ? next : null)}
                        scopeKey={`${templateId || 'new'}:${editingRevision?.id ?? 'unsaved'}`}
                      />
                    ) : null}
                    {!showBlockList && isLegacySingleBlock && (
                      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-800">
                        <span>此範本以單一舊版區塊儲存內文。請轉換後使用區塊編輯器。</span>
                        <button
                          type="button"
                          onClick={() => {
                            const existing = editorBlocks?.[0]
                            const existingBody = existing?.bodyHtml ?? effectiveBodyTemplate
                            setEditorBlocks(
                              createStarterEmailBlocks({
                                mainBodyHtml: existingBody,
                                mainConfig: existing?.config,
                              }),
                            )
                          }}
                          className="rounded border border-sky-300 bg-white px-2 py-1 text-xs text-sky-800"
                        >
                          轉換為區塊
                        </button>
                      </div>
                    )}
                    {!showBlockList && rawImportedHtml !== null && (
                      <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                        已啟用匯入 HTML 保留模式。儲存與預覽會原樣使用匯入的 HTML。
                        <button
                          type="button"
                          onClick={() => {
                            setRawImportedHtml(null)
                            setImportIssues([])
                          }}
                          className="ml-2 underline"
                        >
                          改用視覺化編輯器輸出
                        </button>
                      </div>
                    )}
                    {!showBlockList && bodyEditorMode === 'tiptap' && (
                      <div className="overflow-hidden rounded-lg border border-waldorf-cream-300">
                        <SimpleEditor
                          key={`${templateId || 'new'}:${editingRevision?.id ?? 'unsaved'}`}
                          content={bodyTemplate}
                          contentType="html"
                          onChange={(html) => setBodyTemplate(html)}
                          onEditorReady={(editor) => setBodyEditor(editor)}
                          placeholder="輸入郵件內文模板..."
                        />
                      </div>
                    )}
                    {!showBlockList && bodyEditorMode === 'html' && (
                      <textarea
                        value={rawImportedHtml ?? effectiveBodyTemplate}
                        onChange={(event) => {
                          const nextHtml = event.target.value
                          setRawImportedHtml(nextHtml)
                          const nextImportResult = emailTemplateService.normalizeImportedBodyHtml(nextHtml)
                          setBodyTemplate(nextImportResult.normalizedHtml)
                          setImportIssues(nextImportResult.issues)
                        }}
                        rows={16}
                        className="w-full rounded-lg border border-waldorf-cream-300 bg-white px-3 py-2 font-mono text-xs text-waldorf-clay-700"
                        placeholder="<html>...</html>"
                      />
                    )}
                  </div>

                  {validation.issues.length > 0 && (
                    <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                      <p className="mb-1 font-semibold">驗證結果</p>
                      {validation.issues.map((issue, index) => (
                        <p key={`${issue.field}-${index}`}>- {issue.message}</p>
                      ))}
                    </div>
                  )}

                  {importDetectionMessage && (
                    <div className="mt-4 rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-800">
                      {importDetectionMessage}
                    </div>
                  )}

                  {importIssues.length > 0 && (
                    <div className="mt-4 rounded-lg border border-waldorf-rose-200 bg-waldorf-rose-50 px-4 py-3 text-sm text-waldorf-rose-700">
                      <p className="font-semibold">匯入 HTML 的相容性問題</p>
                      {importIssues.map((issue, index) => (
                        <p key={`${issue.code}-${index}`}>- {issue.message}</p>
                      ))}
                    </div>
                  )}

                  {/* Import tools stay at the bottom of the editor column so the paste area is the last text field. */}
                  <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-waldorf-cream-200 pt-4">
                    <span className="mr-1 text-xs font-medium text-waldorf-clay-500">匯入現有 HTML（例如 Canva 匯出檔）：</span>
                    <button
                      type="button"
                      onClick={() => {
                        setImportHtml(bodyTemplate)
                        setShowImportPanel((prev) => !prev)
                      }}
                      disabled={isSaving}
                      className={secondaryButtonClass}
                    >
                      匯入 HTML
                    </button>
                    <label className={`cursor-pointer ${secondaryButtonClass}`}>
                      上傳 .html 檔
                      <input
                        type="file"
                        accept=".html,text/html"
                        className="hidden"
                        onChange={(event) => void handleImportFile(event)}
                      />
                    </label>
                  </div>

                  {showImportPanel && (
                    <div className="mt-4 rounded-lg border border-waldorf-cream-200 bg-waldorf-cream-50 p-4">
                      <h4 className="mb-1 text-sm font-semibold text-waldorf-clay-700">匯入 HTML</h4>
                      <p className="mb-2 text-xs text-waldorf-clay-500">貼上完整 HTML 標記，再套用以取代編輯器內文。</p>
                      <textarea
                        value={importHtml}
                        onChange={(event) => setImportHtml(event.target.value)}
                        rows={10}
                        className="w-full rounded-lg border border-waldorf-cream-300 bg-white px-3 py-2 font-mono text-xs text-waldorf-clay-700"
                      />
                      <div className="mt-3 flex gap-2">
                        <button
                          type="button"
                          onClick={handleApplyImportedHtml}
                          className="rounded-lg bg-waldorf-sage-600 px-3 py-2 text-sm font-medium text-white hover:bg-waldorf-sage-700"
                        >
                          套用匯入的 HTML
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowImportPanel(false)}
                          className={secondaryButtonClass}
                        >
                          取消
                        </button>
                      </div>
                    </div>
                  )}
                </section>
              </div>

              {/* Preview column */}
              <div className="space-y-6 xl:sticky xl:top-6">
                <section className={`${cardClass} overflow-hidden`}>
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-waldorf-cream-200 px-5 py-4">
                    <div>
                      <h3 className={cardTitleClass}>即時預覽</h3>
                      <p className="mt-0.5 text-xs text-waldorf-clay-500">
                        使用範例資料，編輯時同步更新。{' '}
                        {showBlockList && previewScope === 'block'
                          ? '僅顯示選取的區塊。'
                          : showBlockList
                            ? '依順序顯示可見區塊，並以寄出郵件的版面呈現。'
                            : '使用範例變數呈現主旨與內文。'}
                      </p>
                    </div>
                    {showBlockList && editorBlocks && editorBlocks.length > 0 && (
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <div className="inline-flex overflow-hidden rounded-lg border border-waldorf-cream-300">
                          <button
                            type="button"
                            onClick={() => setPreviewScope('combined')}
                            aria-pressed={previewScope === 'combined'}
                            className={`px-3 py-1.5 font-medium ${previewScope === 'combined' ? 'bg-waldorf-clay-700 text-white' : 'bg-white text-waldorf-clay-600 hover:bg-waldorf-cream-50'}`}
                          >
                            合併預覽
                          </button>
                          <button
                            type="button"
                            onClick={() => setPreviewScope('block')}
                            aria-pressed={previewScope === 'block'}
                            className={`border-l border-waldorf-cream-300 px-3 py-1.5 font-medium ${previewScope === 'block' ? 'bg-waldorf-clay-700 text-white' : 'bg-white text-waldorf-clay-600 hover:bg-waldorf-cream-50'}`}
                          >
                            單一區塊
                          </button>
                        </div>
                        {previewScope === 'block' && (
                          <select
                            value={Math.min(previewBlockIndex, editorBlocks.length - 1)}
                            onChange={(event) => setPreviewBlockIndex(Number(event.target.value))}
                            aria-label="選擇預覽區塊"
                            className="rounded-lg border border-waldorf-cream-300 bg-white px-2 py-1.5 text-xs text-waldorf-clay-700"
                          >
                            {editorBlocks.map((block, index) => (
                              <option key={`${block.type}-${index}`} value={index}>
                                {index + 1}. {getEmailBlockTypeDefinition(block.type).label}
                              </option>
                            ))}
                          </select>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="flex items-baseline gap-3 border-b border-waldorf-cream-200 bg-waldorf-cream-50/60 px-5 py-3">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-waldorf-clay-400">主旨</span>
                    <span className="text-sm font-medium text-waldorf-clay-800">{livePreview.subject || '(empty)'}</span>
                  </div>

                  <div className="bg-waldorf-cream-100/60 p-4">
                    {livePreviewResolvingGallery ? (
                      <p className="py-8 text-center text-xs text-waldorf-clay-500">正在載入圖片預覽（圖庫網址）…</p>
                    ) : (
                      <EmailPreviewFrame html={livePreviewFrameHtml} decode={decodePreviewHtml} />
                    )}
                  </div>

                  {livePreview.warnings.length > 0 && (
                    <div className="border-t border-amber-200 bg-amber-50 px-5 py-3 text-xs text-amber-700">
                      {livePreview.warnings.map((warning, index) => (
                        <p key={`${index}-${warning}`}>- {warning}</p>
                      ))}
                    </div>
                  )}
                </section>

                <section className={`${cardClass} p-5`}>
                  <div className="flex items-baseline justify-between gap-3">
                    <h3 className={cardTitleClass}>變數</h3>
                    <span className="text-[11px] text-waldorf-clay-400">
                      {bodyEditor ? '點擊後插入游標位置' : '點擊後複製'}
                    </span>
                  </div>
                  <ul className="mt-3 grid gap-1.5 sm:grid-cols-2">
                    {EMAIL_TEMPLATE_TOKENS.map((token) => (
                      <li key={token}>
                        <button
                          type="button"
                          onMouseDown={(event) => {
                            event.preventDefault()
                            handleTokenChipClick(token)
                          }}
                          title={`e.g. ${TOKEN_EXAMPLES[token]}`}
                          className="group flex w-full flex-col items-start rounded-lg border border-waldorf-cream-200 bg-white px-2.5 py-1.5 text-left transition-colors hover:border-waldorf-sage-300 hover:bg-waldorf-sage-50"
                        >
                          <span className="font-mono text-xs text-waldorf-clay-800">
                            {copiedToken === token ? '已複製！' : `{{${token}}}`}
                          </span>
                          <span className="truncate text-[11px] text-waldorf-clay-400 group-hover:text-waldorf-clay-500">{`e.g. ${TOKEN_EXAMPLES[token]}`}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              </div>
            </div>
          )}
        </div>
      </AdminLayout>
    </ErrorBoundary>
  )
}

export default AdminEmailTemplateEditorPage
