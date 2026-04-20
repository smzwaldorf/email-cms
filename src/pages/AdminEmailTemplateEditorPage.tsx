import { useEffect, useMemo, useState, type ChangeEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import type { Editor } from '@tiptap/react'
import { AdminLayout } from '@/components/admin/AdminLayout'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { SimpleEditor } from '@/components/tiptap-templates/simple/simple-editor'
import { detectCanvaSections, type CanvaEmailImportIssue } from '@/services/canvaEmailImport'
import { createDefaultBlock } from '@/services/emailTemplateBlocks'
import { emailTemplateService } from '@/services/emailTemplateService'
import { EMAIL_TEMPLATE_TOKENS, validateEmailTemplate } from '@/services/emailTemplateTokens'
import type { EmailTemplateBlock, EmailTemplateRevision } from '@/types/emailTemplate'
import { EmailTemplateBlockList } from '@/components/admin/EmailTemplateBlockList'

const TOKEN_EXAMPLES = {
  'guardian.id': 'guardian-demo',
  'guardian.email': 'guardian@example.com',
  'family.id': 'family-001',
  'newsletter.id': 'newsletter-demo',
  'newsletter.revisionId': 'newsletter-rev-1',
  'classes.count': '2',
  'classes.list': 'A1, B1',
} as const satisfies Record<(typeof EMAIL_TEMPLATE_TOKENS)[number], string>

export function AdminEmailTemplateEditorPage() {
  const { templateId } = useParams<{ templateId: string }>()
  const navigate = useNavigate()
  const isNew = !templateId

  const [editingRevision, setEditingRevision] = useState<EmailTemplateRevision | null>(null)
  const [name, setName] = useState('')
  const [subjectTemplate, setSubjectTemplate] = useState('')
  const [bodyTemplate, setBodyTemplate] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [bodyEditor, setBodyEditor] = useState<Editor | null>(null)
  const [previewSubject, setPreviewSubject] = useState('')
  const [previewBody, setPreviewBody] = useState('')
  const [previewWarnings, setPreviewWarnings] = useState<string[]>([])
  const [importIssues, setImportIssues] = useState<CanvaEmailImportIssue[]>([])
  const [showImportPanel, setShowImportPanel] = useState(false)
  const [importHtml, setImportHtml] = useState('')
  const [rawImportedHtml, setRawImportedHtml] = useState<string | null>(null)
  const [bodyEditorMode, setBodyEditorMode] = useState<'tiptap' | 'html'>('tiptap')
  // Block list snapshot. When non-empty, persisted to `email_template_revisions.blocks`
  // and rendered through the block walker; otherwise the legacy single-body path is used.
  const [editorBlocks, setEditorBlocks] = useState<EmailTemplateBlock[] | null>(null)
  const [importDetectionMessage, setImportDetectionMessage] = useState<string | null>(null)

  const importResult = useMemo(
    () => (rawImportedHtml !== null ? emailTemplateService.normalizeImportedBodyHtml(rawImportedHtml) : null),
    [rawImportedHtml],
  )
  const effectiveBodyTemplate = importResult?.normalizedHtml ?? bodyTemplate

  // The template view defaults to the typed block list when the loaded
  // revision has any block beyond a single legacy `custom-html` block. Legacy
  // single-body revisions stay on the single-body editor until the admin
  // clicks "Convert to blocks".
  const isLegacySingleBlock =
    editorBlocks !== null && editorBlocks.length === 1 && editorBlocks[0].type === 'custom-html'
  const showBlockList = editorBlocks !== null && !isLegacySingleBlock

  const validation = useMemo(
    () => validateEmailTemplate(subjectTemplate, effectiveBodyTemplate, editorBlocks ?? undefined),
    [subjectTemplate, effectiveBodyTemplate, editorBlocks],
  )
  const hasValidationIssues = validation.issues.length > 0 || (importResult?.hasBlockingIssues ?? false)

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
        setEditorBlocks(current.revision.blocks.length > 0 ? current.revision.blocks : null)
        setImportDetectionMessage(null)
        setEditingRevision(current.revision)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load template')
      } finally {
        setIsLoading(false)
      }
    }

    void loadTemplate()
  }, [isNew, templateId])

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

  const handleInsertToken = (token: string) => {
    if (!bodyEditor) return
    bodyEditor.chain().focus().insertContent(`{{${token}}}`).run()
  }

  const truncateValue = (value: string, max = 20): string =>
    value.length > max ? `${value.slice(0, max)}...` : value

  const handlePreview = () => {
    const preview = emailTemplateService.previewRevision(
      {
        subjectTemplate,
        bodyTemplate: effectiveBodyTemplate,
      },
      {
        guardian: {
          id: truncateValue('guardian-demo-very-long-id-123456789'),
          email: truncateValue('guardian.very.long.email@example.com'),
        },
        family: {
          id: truncateValue('family-very-long-id-987654321'),
        },
        newsletter: {
          id: truncateValue('newsletter-demo-long-id'),
          revisionId: truncateValue('newsletter-revision-long-id'),
        },
        classes: {
          ids: ['A1', 'B1', 'C1'],
        },
      },
    )

    setPreviewSubject(preview.subject)
    setPreviewBody(preview.body)
    setPreviewWarnings(preview.warnings.map((warning) => warning.message))
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
      setEditorBlocks(null)
      setImportDetectionMessage(null)
      return
    }
    // detectCanvaSections returns null when fewer than 3 sections match, in
    // which case the importer falls back to a single `custom-html` block by
    // leaving `editorBlocks` null (the service backfills custom-html on save).
    const detected = detectCanvaSections(nextImportResult.normalizedHtml)
    if (detected && detected.length >= 3) {
      setEditorBlocks(detected)
      setImportDetectionMessage(
        `Detected ${detected.length} sections from imported HTML and mapped them to typed blocks.`,
      )
    } else {
      setEditorBlocks(null)
      setImportDetectionMessage(
        'Could not detect three or more sections; saved as a single custom-html block.',
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

  const getRenderedPreviewBody = (value: string): string => {
    if (!value) return '<p>(empty)</p>'
    // If editor content includes escaped tags (e.g. &lt;table&gt;), decode once for visual preview rendering.
    if (value.includes('&lt;') || value.includes('&gt;')) {
      const textarea = document.createElement('textarea')
      textarea.innerHTML = value
      return textarea.value || value
    }
    return value
  }

  return (
    <ErrorBoundary>
      <AdminLayout activeTab="email-templates">
        <div className="space-y-6">
          {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
          {success && <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{success}</div>}

          <div className="rounded-xl border border-waldorf-cream-200 bg-white p-4">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-waldorf-clay-700">
                {isNew ? 'Create Email Template' : 'Edit Email Template'}
              </h2>
              <button
                type="button"
                onClick={() => navigate('/admin/email-templates')}
                className="rounded-lg border border-waldorf-cream-300 px-3 py-2 text-sm text-waldorf-clay-700 hover:bg-waldorf-cream-100"
              >
                Back to List
              </button>
            </div>

            {isLoading ? (
              <p className="text-sm text-waldorf-clay-500">Loading...</p>
            ) : (
              <>
                <div className="space-y-3">
                  <div>
                    <p className="mb-2 text-xs font-medium text-waldorf-clay-600">Template Name</p>
                    <input
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      placeholder="Template name"
                      className="w-full rounded-lg border border-waldorf-cream-300 px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <p className="mb-2 text-xs font-medium text-waldorf-clay-600">Subject Template</p>
                    <textarea
                      value={subjectTemplate}
                      onChange={(event) => setSubjectTemplate(event.target.value)}
                      placeholder="Subject template"
                      rows={2}
                      className="w-full rounded-lg border border-waldorf-cream-300 px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <div className="mb-2 flex items-center justify-between">
                      <p className="text-xs font-medium text-waldorf-clay-600">
                        {showBlockList ? 'Template blocks' : 'Body template'}
                      </p>
                      {!showBlockList && (
                        <div className="inline-flex overflow-hidden rounded-lg border border-waldorf-cream-300 text-xs">
                          <button
                            type="button"
                            onClick={() => {
                              setRawImportedHtml(null)
                              setImportIssues([])
                              setBodyEditorMode('tiptap')
                            }}
                            className={`px-2 py-1 ${bodyEditorMode === 'tiptap' ? 'bg-waldorf-peach-100 text-waldorf-clay-700' : 'bg-white text-waldorf-clay-600'}`}
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
                            className={`border-l border-waldorf-cream-300 px-2 py-1 ${bodyEditorMode === 'html' ? 'bg-waldorf-peach-100 text-waldorf-clay-700' : 'bg-white text-waldorf-clay-600'}`}
                          >
                            HTML
                          </button>
                        </div>
                      )}
                    </div>
                    {showBlockList ? (
                      <EmailTemplateBlockList
                        blocks={editorBlocks ?? []}
                        onChange={(next) => setEditorBlocks(next.length > 0 ? next : null)}
                        scopeKey={`${templateId || 'new'}:${editingRevision?.id ?? 'unsaved'}`}
                      />
                    ) : null}
                    {!showBlockList && isLegacySingleBlock && (
                      <div className="mb-2 flex items-center justify-between rounded border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-800">
                        <span>This template stores its body as a single legacy block. Convert to use the typed block editor.</span>
                        <button
                          type="button"
                          onClick={() => {
                            const existing = editorBlocks?.[0]
                            const existingBody = existing?.bodyHtml ?? effectiveBodyTemplate
                            const seed: EmailTemplateBlock[] = [
                              createDefaultBlock('header', 0),
                              {
                                ...createDefaultBlock('custom-html', 1),
                                bodyHtml: existingBody,
                              },
                              createDefaultBlock('footer', 2),
                            ]
                            setEditorBlocks(seed)
                          }}
                          className="rounded border border-sky-300 bg-white px-2 py-1 text-xs text-sky-800"
                        >
                          Convert to blocks
                        </button>
                      </div>
                    )}
                    {!showBlockList && rawImportedHtml !== null && (
                      <div className="mb-2 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
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
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  {isNew ? (
                    <button
                      onClick={handleCreate}
                      disabled={isSaving || hasValidationIssues}
                      className="rounded-lg bg-waldorf-sage-600 px-3 py-2 text-sm text-white disabled:opacity-50"
                    >
                      Create
                    </button>
                  ) : (
                    <>
                      <button
                        onClick={handleSave}
                        disabled={isSaving || hasValidationIssues}
                        className="rounded-lg bg-waldorf-peach-600 px-3 py-2 text-sm text-white disabled:opacity-50"
                      >
                        Save
                      </button>
                      <button
                        onClick={handleDuplicate}
                        disabled={isSaving}
                        className="rounded-lg border border-waldorf-cream-300 px-3 py-2 text-sm text-waldorf-clay-700 disabled:opacity-50"
                      >
                        Duplicate
                      </button>
                      <button
                        onClick={handleDelete}
                        disabled={isSaving}
                        className="rounded-lg bg-red-600 px-3 py-2 text-sm text-white disabled:opacity-50"
                      >
                        Delete
                      </button>
                    </>
                  )}
                  <button
                    onClick={handlePreview}
                    disabled={isSaving}
                    className="rounded-lg border border-waldorf-cream-300 px-3 py-2 text-sm text-waldorf-clay-700 disabled:opacity-50"
                  >
                    Preview
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setImportHtml(bodyTemplate)
                      setShowImportPanel((prev) => !prev)
                    }}
                    disabled={isSaving}
                    className="rounded-lg border border-waldorf-cream-300 px-3 py-2 text-sm text-waldorf-clay-700 disabled:opacity-50"
                  >
                    Import HTML
                  </button>
                  <label className="cursor-pointer rounded-lg border border-waldorf-cream-300 px-3 py-2 text-sm text-waldorf-clay-700 hover:bg-waldorf-cream-100">
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
                    <h3 className="mb-2 text-sm font-semibold text-waldorf-clay-700">Import HTML</h3>
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
                        className="rounded-lg bg-waldorf-sage-600 px-3 py-2 text-sm text-white hover:opacity-90"
                      >
                        Apply Imported HTML
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowImportPanel(false)}
                        className="rounded-lg border border-waldorf-cream-300 px-3 py-2 text-sm text-waldorf-clay-700 hover:bg-white"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {validation.issues.length > 0 && (
                  <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
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
                  <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    <p className="font-semibold">Imported HTML compatibility issues</p>
                    {importIssues.map((issue, index) => (
                      <p key={`${issue.code}-${index}`}>- {issue.message}</p>
                    ))}
                  </div>
                )}

                {(previewSubject || previewBody || previewWarnings.length > 0) && (
                  <div className="mt-4 rounded-lg border border-waldorf-cream-200 bg-waldorf-cream-50 p-4">
                    <h3 className="mb-2 text-sm font-semibold text-waldorf-clay-700">Preview Result (tokens truncated)</h3>
                    <p className="mb-2 text-xs text-waldorf-clay-500">Subject</p>
                    <p className="mb-3 text-sm text-waldorf-clay-700">{previewSubject || '(empty)'}</p>
                    <p className="mb-2 text-xs text-waldorf-clay-500">HTML Body</p>
                    <div
                      className="prose max-w-none rounded border border-waldorf-cream-200 bg-white p-3 text-sm"
                      dangerouslySetInnerHTML={{ __html: getRenderedPreviewBody(previewBody) }}
                    />
                    {previewWarnings.length > 0 && (
                      <div className="mt-3 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                        {previewWarnings.map((warning) => (
                          <p key={warning}>- {warning}</p>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>

          <div className="rounded-xl border border-waldorf-cream-200 bg-white p-4">
            <h3 className="mb-2 text-sm font-semibold text-waldorf-clay-700">Allowed Tokens</h3>
            <ul className="space-y-1 text-sm text-waldorf-clay-600">
              {EMAIL_TEMPLATE_TOKENS.map((token) => (
                <li key={token}>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onMouseDown={(event) => {
                        event.preventDefault()
                        handleInsertToken(token)
                      }}
                      className="rounded border border-waldorf-cream-300 bg-white px-2 py-1 text-left text-sm text-waldorf-clay-700 hover:bg-waldorf-cream-100"
                    >
                      {`{{${token}}}`}
                    </button>
                    <span className="text-xs text-waldorf-clay-500">{`e.g. ${TOKEN_EXAMPLES[token]}`}</span>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </AdminLayout>
    </ErrorBoundary>
  )
}

export default AdminEmailTemplateEditorPage
