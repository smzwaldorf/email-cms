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
  'newsletter.title': 'Weekly Newsletter',
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
      title: truncate('Weekly Newsletter Demo'),
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
    return <p className="py-8 text-center text-sm text-waldorf-clay-500">(empty)</p>
  }
  const isFullDoc = /^\s*<!doctype/i.test(raw) || /<html[\s>]/i.test(raw.trim())
  if (isFullDoc) {
    return (
      <iframe
        title="Email preview"
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
        setError(err instanceof Error ? err.message : 'Failed to load template')
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
      setError('Resolve template validation errors before saving.')
      return
    }

    setIsSaving(true)
    setError(null)
    try {
      const created = await emailTemplateService.createTemplate({
        name: name || 'Untitled template',
        subjectTemplate,
        bodyTemplate: effectiveBodyTemplate,
        blocks: editorBlocks ?? undefined,
        importedBodyHtml: rawImportedHtml,
      })
      setSuccess('Template created.')
      navigate(`/admin/email-templates/${created.template.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create template')
    } finally {
      setIsSaving(false)
    }
  }

  const handleSave = async () => {
    if (!templateId) return
    if (hasValidationIssues) {
      setError('Resolve template validation errors before saving.')
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
      setError(err instanceof Error ? err.message : 'Failed to save template')
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
      setSuccess('Template duplicated.')
      navigate(`/admin/email-templates/${duplicated.template.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to duplicate template')
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!templateId) return
    const confirmed = window.confirm('Delete this template? This cannot be undone.')
    if (!confirmed) return

    setIsSaving(true)
    setError(null)
    try {
      await emailTemplateService.deleteTemplate(templateId)
      navigate('/admin/email-templates')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete template')
    } finally {
      setIsSaving(false)
    }
  }

  const handleSetActive = async () => {
    if (!templateId) return
    if (!editingTemplate?.currentRevisionId) {
      setError('Save the template at least once before marking it as active.')
      return
    }
    setIsActivating(true)
    setError(null)
    try {
      const updated = await emailTemplateService.setActiveTemplate(templateId)
      setEditingTemplate(updated)
      setSuccess('This template is now used for newsletter publishing.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to mark template as active')
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
      setError('Imported HTML has compatibility issues. Resolve them before saving.')
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
        'Could not detect three or more sections; main content was placed in the middle custom-html block with header and footer.',
      )
    }

    setError(null)
    setSuccess('HTML imported. Compatible markup will be preserved for save and preview.')
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
      setError('Failed to read HTML file.')
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
      ? { label: 'In use', className: 'bg-waldorf-sage-600 text-white' }
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
        title={isNew ? 'New Email Template' : 'Edit Email Template'}
        description={
          isNew
            ? 'Compose the subject and body blocks, check the live preview, then create the template.'
            : 'Every save creates a new revision. Newsletters use the revision that was current when they were published.'
        }
        backLink={{ to: '/admin/email-templates', label: 'Back to templates' }}
      >
        <div className="space-y-6">
          {/* Action bar */}
          <div className={`${cardClass} flex flex-wrap items-center justify-between gap-4 px-5 py-4`}>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="truncate font-display text-xl font-semibold text-waldorf-clay-800">
                  {name.trim() || 'Untitled template'}
                </h2>
                {stateBadge && (
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${stateBadge.className}`}>
                    {stateBadge.label}
                  </span>
                )}
              </div>
              <p className="mt-0.5 text-xs text-waldorf-clay-500">
                {isNew
                  ? 'Not saved yet'
                  : editingRevision
                    ? `Revision v${editingRevision.revisionNumber} · saved ${new Date(editingRevision.createdAt).toLocaleString()}`
                    : 'Loading revision…'}
                {hasValidationIssues && <span className="ml-2 font-medium text-amber-700">· resolve validation issues to save</span>}
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
                      ? 'Save the template at least once before marking it as active'
                      : 'Use this template for newsletter publishing'
                  }
                  className="rounded-lg border border-waldorf-sage-300 bg-white px-3 py-2 text-sm font-medium text-waldorf-sage-700 transition-colors hover:bg-waldorf-sage-50 disabled:opacity-50"
                >
                  {isActivating ? 'Activating…' : 'Use this template'}
                </button>
              )}
              {!isNew && (
                <>
                  <button onClick={handleDuplicate} disabled={isSaving} className={secondaryButtonClass}>
                    Duplicate
                  </button>
                  <button
                    onClick={handleDelete}
                    disabled={isSaving}
                    className="rounded-lg border border-waldorf-rose-200 bg-white px-3 py-2 text-sm font-medium text-waldorf-rose-700 transition-colors hover:bg-waldorf-rose-50 disabled:opacity-50"
                  >
                    Delete
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
                  {isSaving ? 'Saving…' : 'Save'}
                </button>
              )}
            </div>
          </div>

          {error && <div className="rounded-xl border border-waldorf-rose-200 bg-waldorf-rose-50 px-4 py-3 text-sm font-medium text-waldorf-rose-700">{error}</div>}
          {success && <div className="rounded-xl border border-waldorf-sage-200 bg-waldorf-sage-50 px-4 py-3 text-sm font-medium text-waldorf-sage-700">{success}</div>}

          {isLoading ? (
            <div className={`${cardClass} p-8 text-sm text-waldorf-clay-500`}>Loading...</div>
          ) : (
            <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(380px,42%)] xl:items-start">
              {/* Editor column */}
              <div className="space-y-6">
                <section className={`${cardClass} p-5`}>
                  <h3 className={cardTitleClass}>Template details</h3>
                  <div className="mt-4 space-y-4">
                    <label className="block">
                      <span className="mb-1.5 block text-xs font-medium text-waldorf-clay-600">Template name</span>
                      <input
                        value={name}
                        onChange={(event) => setName(event.target.value)}
                        placeholder="Template name"
                        className={inputClass}
                      />
                    </label>
                    <label className="block">
                      <span className="mb-1.5 flex items-center justify-between text-xs font-medium text-waldorf-clay-600">
                        <span>Subject template</span>
                        <span className="font-normal text-waldorf-clay-400">Supports tokens like {'{{newsletter.title}}'}</span>
                      </span>
                      <textarea
                        value={subjectTemplate}
                        onChange={(event) => setSubjectTemplate(event.target.value)}
                        placeholder="Subject template"
                        rows={2}
                        className={inputClass}
                      />
                    </label>
                  </div>
                </section>

                <section className={`${cardClass} p-5`}>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h3 className={cardTitleClass}>{showBlockList ? 'Template blocks' : 'Body template'}</h3>
                      <p className="mt-0.5 text-xs text-waldorf-clay-500">
                        {showBlockList
                          ? 'Blocks render top to bottom. Hide a block to leave it out without deleting it.'
                          : 'Single-body template. Edit visually or paste HTML.'}
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
                        <span>This template stores its body as a single legacy block. Convert to use the typed block editor.</span>
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
                          Convert to blocks
                        </button>
                      </div>
                    )}
                    {!showBlockList && rawImportedHtml !== null && (
                      <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                        Imported HTML preservation mode is on. Save/Preview will use the original imported HTML exactly as-is.
                        <button
                          type="button"
                          onClick={() => {
                            setRawImportedHtml(null)
                            setImportIssues([])
                          }}
                          className="ml-2 underline"
                        >
                          Switch to TipTap output
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
                      <p className="mb-1 font-semibold">Validation</p>
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
                      <p className="font-semibold">Imported HTML compatibility issues</p>
                      {importIssues.map((issue, index) => (
                        <p key={`${issue.code}-${index}`}>- {issue.message}</p>
                      ))}
                    </div>
                  )}

                  {/* Import tools stay at the bottom of the editor column so the paste area is the last text field. */}
                  <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-waldorf-cream-200 pt-4">
                    <span className="mr-1 text-xs font-medium text-waldorf-clay-500">Bring in existing HTML (e.g. Canva export):</span>
                    <button
                      type="button"
                      onClick={() => {
                        setImportHtml(bodyTemplate)
                        setShowImportPanel((prev) => !prev)
                      }}
                      disabled={isSaving}
                      className={secondaryButtonClass}
                    >
                      Import HTML
                    </button>
                    <label className={`cursor-pointer ${secondaryButtonClass}`}>
                      Upload .html
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
                      <h4 className="mb-1 text-sm font-semibold text-waldorf-clay-700">Import HTML</h4>
                      <p className="mb-2 text-xs text-waldorf-clay-500">Paste full HTML markup, then apply to replace editor body content.</p>
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
                          Apply Imported HTML
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowImportPanel(false)}
                          className={secondaryButtonClass}
                        >
                          Cancel
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
                      <h3 className={cardTitleClass}>Live preview</h3>
                      <p className="mt-0.5 text-xs text-waldorf-clay-500">
                        Sample data · updates as you edit.{' '}
                        {showBlockList && previewScope === 'block'
                          ? 'Body shows the selected block only.'
                          : showBlockList
                            ? 'Visible blocks in order, wrapped like a sent message.'
                            : 'Subject and body with demo tokens.'}
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
                            Combined
                          </button>
                          <button
                            type="button"
                            onClick={() => setPreviewScope('block')}
                            aria-pressed={previewScope === 'block'}
                            className={`border-l border-waldorf-cream-300 px-3 py-1.5 font-medium ${previewScope === 'block' ? 'bg-waldorf-clay-700 text-white' : 'bg-white text-waldorf-clay-600 hover:bg-waldorf-cream-50'}`}
                          >
                            Single block
                          </button>
                        </div>
                        {previewScope === 'block' && (
                          <select
                            value={Math.min(previewBlockIndex, editorBlocks.length - 1)}
                            onChange={(event) => setPreviewBlockIndex(Number(event.target.value))}
                            aria-label="Block to preview"
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
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-waldorf-clay-400">Subject</span>
                    <span className="text-sm font-medium text-waldorf-clay-800">{livePreview.subject || '(empty)'}</span>
                  </div>

                  <div className="bg-waldorf-cream-100/60 p-4">
                    {livePreviewResolvingGallery ? (
                      <p className="py-8 text-center text-xs text-waldorf-clay-500">Loading image previews (gallery URLs)…</p>
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
                    <h3 className={cardTitleClass}>Tokens</h3>
                    <span className="text-[11px] text-waldorf-clay-400">
                      {bodyEditor ? 'Click to insert at the cursor' : 'Click to copy'}
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
                            {copiedToken === token ? 'Copied!' : `{{${token}}}`}
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
