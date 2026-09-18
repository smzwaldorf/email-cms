import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { AdminLayout } from '@/components/admin/AdminLayout'
import { NewsletterWorkflowSteps } from '@/components/admin/NewsletterWorkflowSteps'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { adminService } from '@/services/adminService'
import { emailTemplateService } from '@/services/emailTemplateService'
import { newsletterDeliveryService } from '@/services/newsletterDeliveryService'
import { fetchSmzDirectoryFamilies } from '@/services/smzDirectoryService'
import type { AdminNewsletter, Class } from '@/types/admin'
import type { DeliveryAudienceSelection } from '@/types/emailDelivery'
import type { EmailTemplate } from '@/types/emailTemplate'
import type { PersonalizationWarning } from '@/types/personalization'
import type { PreparationFinding } from '@/types/emailPreparation'
import { getAdminNewsletterPath } from '@/utils/adminNewsletterRoutes'

interface PreviewResult {
  templateRevisionId: string | null
  audience: DeliveryAudienceSelection
  eligibleCount: number | null
  renderedSubject: string
  renderedBody: string
  warnings: PersonalizationWarning[]
  guardianEmail: string | null
  templateLabel: string
}

interface PreviewFamily {
  id: string
  name: string
}

type PreviewDevice = 'desktop' | 'mobile'

const NEWSLETTER_QUERY_PARAM = 'newsletter'

const STATUS_BADGE: Record<string, string> = {
  draft: 'bg-waldorf-peach-100 text-waldorf-peach-700',
  published: 'bg-waldorf-sage-100 text-waldorf-sage-700',
  archived: 'bg-waldorf-cream-200 text-waldorf-clay-600',
}

const fieldClass =
  'w-full rounded-lg border border-waldorf-cream-300 bg-white px-3 py-2.5 text-sm text-waldorf-clay-700 focus:border-waldorf-sage-400 focus:outline-none focus:ring-2 focus:ring-waldorf-sage-200 disabled:cursor-not-allowed disabled:bg-waldorf-cream-50'
const labelClass = 'flex flex-col gap-1.5 text-xs text-waldorf-clay-600'

/**
 * Admin "Apply for merge" preview page.
 *
 * Picks a newsletter + family + email template, runs
 * `composePersonalizedEmails` through `previewPersonalizationForFamily`
 * (no batch is created), and renders the resulting per-recipient HTML
 * inline. The "Confirm and publish" action publishes via
 * `newsletterDeliveryService.createPublishBatch` only after the admin
 * has approved the rendered output.
 *
 * Accepts `?newsletter=<id>` so the compose page can deep-link straight here.
 */
export function NewsletterEmailPreviewPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const requestedNewsletterId = searchParams.get(NEWSLETTER_QUERY_PARAM)

  const [newsletters, setNewsletters] = useState<AdminNewsletter[]>([])
  const [families, setFamilies] = useState<PreviewFamily[]>([])
  const [templates, setTemplates] = useState<EmailTemplate[]>([])
  const [classes, setClasses] = useState<Class[]>([])
  const [audienceMode, setAudienceMode] = useState<'family' | 'classes' | 'all'>('family')
  const [classIds, setClassIds] = useState<string[]>([])
  const [selectedNewsletterId, setSelectedNewsletterId] = useState<string>('')
  const [selectedFamilyId, setSelectedFamilyId] = useState<string>('')
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [preview, setPreview] = useState<PreviewResult | null>(null)
  const [isPreviewing, setIsPreviewing] = useState(false)
  const [isPublishing, setIsPublishing] = useState(false)
  const [device, setDevice] = useState<PreviewDevice>('desktop')

  useEffect(() => {
    const load = async () => {
      try {
        setIsLoading(true)
        setError(null)
        const [nl, directoryFamilies, tmpl, cls] = await Promise.all([
          adminService.fetchNewsletters(),
          fetchSmzDirectoryFamilies(),
          emailTemplateService.listTemplates(),
          adminService.fetchClasses(),
        ])
        const fam = directoryFamilies.map<PreviewFamily>((directoryFamily) => ({
          id: directoryFamily.id,
          name: directoryFamily.displayName || directoryFamily.code,
        }))
        setNewsletters(nl)
        setFamilies(fam)
        setTemplates(tmpl)
        setClasses(cls)
        const requested = requestedNewsletterId ? nl.find((item) => item.id === requestedNewsletterId) : undefined
        if (requested) {
          setSelectedNewsletterId(requested.id)
        } else if (nl.length > 0) {
          setSelectedNewsletterId(nl[0].id)
        }
        if (fam.length > 0) setSelectedFamilyId(fam[0].id)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load preview inputs')
      } finally {
        setIsLoading(false)
      }
    }
    void load()
    // Initial load only; the query param is read once to seed the selection.
  }, [])

  const selectedNewsletter = useMemo(
    () => newsletters.find((nl) => nl.id === selectedNewsletterId) ?? null,
    [newsletters, selectedNewsletterId],
  )
  const selectedFamily = useMemo(
    () => families.find((family) => family.id === selectedFamilyId) ?? null,
    [families, selectedFamilyId],
  )
  const selectedTemplate = useMemo(
    () => templates.find((tmpl) => tmpl.id === selectedTemplateId) ?? null,
    [templates, selectedTemplateId],
  )
  const activeTemplate = useMemo(() => templates.find((tmpl) => tmpl.state === 'active') ?? null, [templates])

  const canPreview = Boolean(selectedNewsletterId && selectedFamilyId)
  const canPublishSelectedNewsletter = selectedNewsletter?.status === 'draft'
  const hasIncompleteClassMapping = preview?.warnings.some((warning) => warning.code === 'missing_class_mapping') ?? false
  useEffect(() => { setPreview(null) }, [selectedNewsletterId, selectedFamilyId, selectedTemplateId, audienceMode, classIds])

  const handleSelectNewsletter = (nextId: string) => {
    setSelectedNewsletterId(nextId)
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        if (nextId) next.set(NEWSLETTER_QUERY_PARAM, nextId)
        else next.delete(NEWSLETTER_QUERY_PARAM)
        return next
      },
      { replace: true },
    )
  }

  const handlePreview = async () => {
    if (!canPreview) return
    setIsPreviewing(true)
    setError(null)
    setSuccess(null)
    try {
      const result = await newsletterDeliveryService.previewPersonalizationForFamily({
        newsletterId: selectedNewsletterId,
        familyId: selectedFamilyId,
        templateId: selectedTemplateId || undefined,
      })
      const audience: DeliveryAudienceSelection = audienceMode === 'family'
        ? { mode: 'family', familyId: selectedFamilyId }
        : audienceMode === 'classes' ? { mode: 'classes', classIds } : { mode: 'all' }
      // Ask the delivery API for every mode, including one-family previews, so
      // the visible count is the Auth-derived audience that would be sent.
      const summary = await newsletterDeliveryService.previewAudience(audience)
      setPreview({
        templateRevisionId: result.template?.templateRevisionId ?? null,
        audience,
        eligibleCount: summary.eligibleRecipientCount ?? summary.eligibleCount,
        renderedSubject: result.renderedSubject,
        renderedBody: result.renderedBody,
        warnings: result.warnings,
        guardianEmail: result.guardianEmail,
        templateLabel: selectedTemplate?.name ?? (activeTemplate ? `${activeTemplate.name} (active)` : 'Active template'),
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to render preview')
      setPreview(null)
    } finally {
      setIsPreviewing(false)
    }
  }

  const handlePublish = async () => {
    if (!selectedNewsletterId || !preview || preview.eligibleCount === null || preview.eligibleCount === 0 || hasIncompleteClassMapping) return
    const confirmed = window.confirm(
      `Publish "${selectedNewsletter?.title ?? selectedNewsletterId}" to the reviewed ${preview.audience.mode} audience (${preview.eligibleCount} eligible parents)? This creates a real delivery batch.`,
    )
    if (!confirmed) return
    setIsPublishing(true)
    setError(null)
    setSuccess(null)
    try {
      const batch = await newsletterDeliveryService.createPublishBatch({
        newsletterId: selectedNewsletterId,
        audience: preview.audience,
        templateRevisionId: preview.templateRevisionId,
      })
      setSuccess(`Published delivery batch ${batch.id} (state: ${batch.state}).`)
      setPreview(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to publish newsletter')
    } finally {
      setIsPublishing(false)
    }
  }

  const findings = useMemo<PreparationFinding[]>(() => {
    if (!preview) return []
    return preview.warnings.map((warning) => ({
      code: warning.code === 'missing_template_value' ? 'missing_required_value' : warning.code,
      severity: warning.code === 'missing_template_value' ? 'error' : 'warning',
      guardianId: warning.guardianId,
      message: warning.message,
      details: warning.details,
    })) as PreparationFinding[]
  }, [preview])
  const hasBlockingFindings = findings.some((finding) => finding.severity === 'error')

  const publishDisabledReason = hasBlockingFindings
    ? 'Resolve preparation errors before publishing.'
    : hasIncompleteClassMapping
      ? 'Resolve Auth class mappings before publishing.'
      : !canPublishSelectedNewsletter
        ? 'Only draft newsletters can be published.'
        : !preview
          ? 'Render a preview first.'
          : preview.eligibleCount === null || preview.eligibleCount === 0
            ? 'No eligible recipients for this audience.'
            : undefined

  const isBusy = isPreviewing || isPublishing

  return (
    <ErrorBoundary>
      <AdminLayout
        activeTab="email-preview"
        contentVariant="plain"
        title="Email Preview"
        description="Render exactly what one recipient family will receive, then publish to the reviewed audience."
        backLink={selectedNewsletter ? { to: getAdminNewsletterPath(selectedNewsletter), label: '返回電子報編排' } : undefined}
      >
        <div className="space-y-6">
          <NewsletterWorkflowSteps current="preview" newsletter={selectedNewsletter} />

          {error && <div className="rounded-xl border border-waldorf-rose-200 bg-waldorf-rose-50 px-4 py-3 text-sm font-medium text-waldorf-rose-700">{error}</div>}
          {success && <div className="rounded-xl border border-waldorf-sage-200 bg-waldorf-sage-50 px-4 py-3 text-sm font-medium text-waldorf-sage-700">{success}</div>}

          <div className="grid gap-6 lg:grid-cols-[360px_minmax(0,1fr)] lg:items-start">
            {/* Setup */}
            <aside className="space-y-6 lg:sticky lg:top-6">
              <section className="rounded-2xl border border-waldorf-cream-200 bg-white/90 backdrop-blur-sm p-5 shadow-sm">
                <h2 className="font-display text-xl font-semibold text-waldorf-clay-800">Preview setup</h2>
                <p className="mt-1 text-xs text-waldorf-clay-500">Choose what to render, then who should receive the publication.</p>

                {isLoading ? (
                  <p className="mt-4 text-sm text-waldorf-clay-500">Loading...</p>
                ) : (
                  <div className="mt-5 space-y-4">
                    <label className={labelClass}>
                      <span className="font-medium">Newsletter</span>
                      <select
                        value={selectedNewsletterId}
                        disabled={isBusy}
                        onChange={(event) => handleSelectNewsletter(event.target.value)}
                        className={fieldClass}
                      >
                        <option value="">Select newsletter</option>
                        {newsletters.map((newsletter) => (
                          <option key={newsletter.id} value={newsletter.id}>
                            {newsletter.title || newsletter.weekNumber || newsletter.id} ({newsletter.status})
                          </option>
                        ))}
                      </select>
                      {selectedNewsletter && (
                        <span className="flex flex-wrap items-center gap-2 text-[11px] text-waldorf-clay-500">
                          <span className={`rounded-full px-2 py-0.5 font-semibold ${STATUS_BADGE[selectedNewsletter.status] ?? STATUS_BADGE.archived}`}>
                            {selectedNewsletter.status}
                          </span>
                          {selectedNewsletter.weekNumber && <span>{selectedNewsletter.weekNumber}</span>}
                          <span>{selectedNewsletter.articleCount} articles</span>
                        </span>
                      )}
                    </label>

                    <label className={labelClass}>
                      <span className="font-medium">Family</span>
                      <select
                        value={selectedFamilyId}
                        disabled={isBusy}
                        onChange={(event) => setSelectedFamilyId(event.target.value)}
                        className={fieldClass}
                      >
                        <option value="">Select family</option>
                        {families.map((family) => (
                          <option key={family.id} value={family.id}>
                            {family.name}
                          </option>
                        ))}
                      </select>
                      <span className="text-[11px] text-waldorf-clay-400">The rendered email uses this family's class articles and guardian.</span>
                    </label>

                    <label className={labelClass}>
                      <span className="font-medium">Email template (optional)</span>
                      <select
                        value={selectedTemplateId}
                        disabled={isBusy}
                        onChange={(event) => setSelectedTemplateId(event.target.value)}
                        className={fieldClass}
                      >
                        <option value="">{activeTemplate ? `Use active template (${activeTemplate.name})` : 'Use active template'}</option>
                        {templates.map((template) => (
                          <option key={template.id} value={template.id}>
                            {template.name}{template.state === 'active' ? ' · in use' : ''}
                          </option>
                        ))}
                      </select>
                    </label>

                    <div className="border-t border-waldorf-cream-200 pt-4">
                      <label className={labelClass}>
                        <span className="font-medium">Delivery audience</span>
                        <select
                          disabled={isBusy}
                          value={audienceMode}
                          onChange={(event) => setAudienceMode(event.target.value as typeof audienceMode)}
                          className={fieldClass}
                        >
                          <option value="family">Selected family only</option>
                          <option value="classes">Selected classes</option>
                          <option value="all">All eligible families</option>
                        </select>
                      </label>
                      {audienceMode === 'classes' && (
                        <div className="mt-2 max-h-40 space-y-1 overflow-y-auto rounded-lg border border-waldorf-cream-200 bg-waldorf-cream-50/60 p-2">
                          {classes.length === 0 && <p className="text-xs text-waldorf-clay-500">No classes available.</p>}
                          {classes.map((item) => (
                            <label key={item.id} className="flex items-center gap-2 rounded px-1 py-0.5 text-xs text-waldorf-clay-700 hover:bg-white">
                              <input
                                disabled={isBusy}
                                type="checkbox"
                                className="accent-waldorf-sage-600"
                                checked={classIds.includes(item.id)}
                                onChange={(event) => setClassIds(event.target.checked ? [...classIds, item.id] : classIds.filter((id) => id !== item.id))}
                              />
                              {item.name}
                            </label>
                          ))}
                        </div>
                      )}
                      {preview && (
                        <p
                          className={`mt-3 rounded-lg px-3 py-2 text-xs font-medium ${
                            preview.eligibleCount ? 'bg-waldorf-sage-50 text-waldorf-sage-700' : 'bg-waldorf-rose-50 text-waldorf-rose-700'
                          }`}
                        >
                          Eligible parents from SMZ Auth: {preview.eligibleCount ?? 0}{preview.eligibleCount === 0 ? ' — delivery blocked; check audience eligibility.' : ''}
                        </p>
                      )}
                      {hasIncompleteClassMapping && (
                        <p role="alert" className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                          Preview incomplete — one or more Auth class codes have no unique CMS class mapping. Class-targeted articles may be omitted; publication is disabled until the mapping is corrected.
                        </p>
                      )}
                    </div>

                    <div className="flex flex-col gap-2 border-t border-waldorf-cream-200 pt-4">
                      <button
                        type="button"
                        onClick={handlePreview}
                        disabled={!canPreview || isPreviewing}
                        className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-waldorf-sage-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-waldorf-sage-700 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {isPreviewing ? 'Rendering...' : 'Render preview'}
                      </button>
                      <button
                        type="button"
                        onClick={handlePublish}
                        disabled={Boolean(publishDisabledReason) || isBusy}
                        title={publishDisabledReason}
                        className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-waldorf-peach-500 to-waldorf-peach-600 px-4 py-2.5 text-sm font-medium text-white shadow-lg shadow-waldorf-peach-200/50 transition-all hover:from-waldorf-peach-600 hover:to-waldorf-peach-700 disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none"
                      >
                        {isPublishing ? 'Publishing...' : 'Confirm and publish'}
                      </button>
                      {publishDisabledReason && !isBusy && (
                        <p className="text-center text-[11px] text-waldorf-clay-400">{publishDisabledReason}</p>
                      )}
                    </div>
                  </div>
                )}
              </section>

              {findings.length > 0 && (
                <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                  <h3 className="text-sm font-semibold text-amber-900">
                    Preparation findings ({findings.length})
                  </h3>
                  <ul className="mt-2 space-y-1.5 text-xs text-amber-900">
                    {findings.map((finding, index) => (
                      <li key={`${finding.code}-${index}`} className="flex gap-2">
                        <span className={`mt-0.5 inline-flex flex-shrink-0 rounded px-1.5 font-mono text-[10px] uppercase ${finding.severity === 'error' ? 'bg-waldorf-rose-100 text-waldorf-rose-700' : 'bg-amber-100 text-amber-800'}`}>
                          {finding.severity}
                        </span>
                        <span>
                          <span className="font-medium">{finding.code}</span> — {finding.message}
                        </span>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </aside>

            {/* Rendered output */}
            <section className="rounded-2xl border border-waldorf-cream-200 bg-white/90 backdrop-blur-sm shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-waldorf-cream-200 px-5 py-4">
                <div>
                  <h2 className="font-display text-xl font-semibold text-waldorf-clay-800">Rendered email</h2>
                  <p className="mt-0.5 text-xs text-waldorf-clay-500">Exactly what the selected family's guardian would receive.</p>
                </div>
                <div className="inline-flex overflow-hidden rounded-lg border border-waldorf-cream-300 text-xs" role="group" aria-label="Preview width">
                  {(['desktop', 'mobile'] as PreviewDevice[]).map((option) => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => setDevice(option)}
                      aria-pressed={device === option}
                      className={`px-3 py-1.5 font-medium capitalize transition-colors ${
                        device === option ? 'bg-waldorf-clay-700 text-white' : 'bg-white text-waldorf-clay-600 hover:bg-waldorf-cream-50'
                      } ${option === 'mobile' ? 'border-l border-waldorf-cream-300' : ''}`}
                    >
                      {option}
                    </button>
                  ))}
                </div>
              </div>

              {preview ? (
                <div className="p-5">
                  <dl className="grid grid-cols-1 gap-3 text-xs text-waldorf-clay-600 sm:grid-cols-3">
                    <div className="rounded-lg bg-waldorf-cream-50 px-3 py-2">
                      <dt className="font-medium text-waldorf-clay-500">Recipient</dt>
                      <dd className="mt-0.5 truncate text-waldorf-clay-800" title={preview.guardianEmail ?? undefined}>
                        {preview.guardianEmail ?? 'Family preview — recipient emails checked separately'}
                      </dd>
                    </div>
                    <div className="rounded-lg bg-waldorf-cream-50 px-3 py-2">
                      <dt className="font-medium text-waldorf-clay-500">Template</dt>
                      <dd className="mt-0.5 truncate text-waldorf-clay-800">{preview.templateLabel}</dd>
                    </div>
                    <div className="rounded-lg bg-waldorf-cream-50 px-3 py-2">
                      <dt className="font-medium text-waldorf-clay-500">Recipient family</dt>
                      <dd className="mt-0.5 truncate text-waldorf-clay-800">{selectedFamily?.name ?? selectedFamilyId}</dd>
                    </div>
                  </dl>

                  <div className="mt-4 rounded-xl border border-waldorf-cream-200 bg-white">
                    <div className="flex items-baseline gap-3 border-b border-waldorf-cream-200 px-4 py-3">
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-waldorf-clay-400">Subject</span>
                      <span className="text-sm font-medium text-waldorf-clay-800">{preview.renderedSubject || '(empty)'}</span>
                    </div>
                    <div className="flex justify-center bg-waldorf-cream-100/70 p-4">
                      <iframe
                        title="Newsletter email preview"
                        srcDoc={preview.renderedBody || '<p>(empty body)</p>'}
                        className={`h-[720px] rounded-lg border border-waldorf-cream-200 bg-white shadow-sm transition-all ${
                          device === 'mobile' ? 'w-[390px] max-w-full' : 'w-full'
                        }`}
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex min-h-[420px] flex-col items-center justify-center px-6 py-16 text-center">
                  <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-full bg-waldorf-cream-100">
                    <svg className="h-7 w-7 text-waldorf-clay-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <p className="font-medium text-waldorf-clay-600">
                    {isPreviewing ? 'Rendering preview…' : 'No preview rendered yet'}
                  </p>
                  <p className="mt-1 max-w-sm text-sm text-waldorf-clay-400">
                    Pick a newsletter and a family on the left, then click <span className="font-medium text-waldorf-clay-500">Render preview</span> to see the personalized email here.
                  </p>
                </div>
              )}
            </section>
          </div>
        </div>
      </AdminLayout>
    </ErrorBoundary>
  )
}

export default NewsletterEmailPreviewPage
