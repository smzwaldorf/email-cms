import { useEffect, useMemo, useState } from 'react'
import { AdminLayout } from '@/components/admin/AdminLayout'
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

/**
 * Admin "Apply for merge" preview page.
 *
 * Picks a newsletter + family + email template, runs
 * `composePersonalizedEmails` through `previewPersonalizationForFamily`
 * (no batch is created), and renders the resulting per-recipient HTML
 * inline. The "Confirm and publish" action publishes via
 * `newsletterDeliveryService.createPublishBatch` only after the admin
 * has approved the rendered output.
 */
export function NewsletterEmailPreviewPage() {
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
        if (nl.length > 0) setSelectedNewsletterId(nl[0].id)
        if (fam.length > 0) setSelectedFamilyId(fam[0].id)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load preview inputs')
      } finally {
        setIsLoading(false)
      }
    }
    void load()
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

  const canPreview = Boolean(selectedNewsletterId && selectedFamilyId)
  const canPublishSelectedNewsletter = selectedNewsletter?.status === 'draft'
  const hasIncompleteClassMapping = preview?.warnings.some((warning) => warning.code === 'missing_class_mapping') ?? false
  useEffect(() => { setPreview(null) }, [selectedNewsletterId, selectedFamilyId, selectedTemplateId, audienceMode, classIds])

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
        templateLabel: selectedTemplate?.name ?? 'Active template',
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

  return (
    <ErrorBoundary>
      <AdminLayout activeTab="email-preview">
        <div className="space-y-6">
          {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
          {success && <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{success}</div>}

          <div className="rounded-xl border border-waldorf-cream-200 bg-white p-4">
            <h2 className="mb-3 text-sm font-semibold text-waldorf-clay-700">Apply for merge — Newsletter Email Preview</h2>
            <p className="mb-4 text-xs text-waldorf-clay-500">
              Render exactly what one recipient family will receive before publishing the newsletter.
            </p>

            {isLoading ? (
              <p className="text-sm text-waldorf-clay-500">Loading...</p>
            ) : (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <label className="flex flex-col gap-1 text-xs text-waldorf-clay-600">
                  <span className="font-medium">Newsletter</span>
                  <select
                    value={selectedNewsletterId}
                    disabled={isPreviewing || isPublishing}
                    onChange={(event) => setSelectedNewsletterId(event.target.value)}
                    className="rounded border border-waldorf-cream-300 px-2 py-1 text-sm text-waldorf-clay-700"
                  >
                    <option value="">Select newsletter</option>
                    {newsletters.map((newsletter) => (
                      <option key={newsletter.id} value={newsletter.id}>
                        {newsletter.title || newsletter.weekNumber || newsletter.id} ({newsletter.status})
                      </option>
                    ))}
                  </select>
                </label>

                <label className="flex flex-col gap-1 text-xs text-waldorf-clay-600">
                  <span className="font-medium">Family</span>
                  <select
                    value={selectedFamilyId}
                    disabled={isPreviewing || isPublishing}
                    onChange={(event) => setSelectedFamilyId(event.target.value)}
                    className="rounded border border-waldorf-cream-300 px-2 py-1 text-sm text-waldorf-clay-700"
                  >
                    <option value="">Select family</option>
                    {families.map((family) => (
                      <option key={family.id} value={family.id}>
                        {family.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="flex flex-col gap-1 text-xs text-waldorf-clay-600">
                  <span className="font-medium">Email template (optional)</span>
                  <select
                    value={selectedTemplateId}
                    disabled={isPreviewing || isPublishing}
                    onChange={(event) => setSelectedTemplateId(event.target.value)}
                    className="rounded border border-waldorf-cream-300 px-2 py-1 text-sm text-waldorf-clay-700"
                  >
                    <option value="">Use active template</option>
                    {templates.map((template) => (
                      <option key={template.id} value={template.id}>
                        {template.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            )}

            <div className="mt-4 flex flex-wrap gap-2">
              <label>Delivery audience
                <select disabled={isPreviewing || isPublishing} value={audienceMode} onChange={(event) => setAudienceMode(event.target.value as typeof audienceMode)}>
                  <option value="family">Selected family only</option>
                  <option value="classes">Selected classes</option>
                  <option value="all">All eligible families</option>
                </select>
              </label>
              {audienceMode === 'classes' && classes.map((item) => (
                <label key={item.id}><input disabled={isPreviewing || isPublishing} type="checkbox" checked={classIds.includes(item.id)} onChange={(event) => setClassIds(event.target.checked ? [...classIds, item.id] : classIds.filter((id) => id !== item.id))} />{item.name}</label>
              ))}
              {preview && <p>Eligible parents from SMZ Auth: {preview.eligibleCount ?? 0}{preview.eligibleCount === 0 ? ' — delivery blocked; check audience eligibility.' : ''}</p>}
              {hasIncompleteClassMapping && <p role="alert" className="text-amber-700">
                Preview incomplete — one or more Auth class codes have no unique CMS class mapping. Class-targeted articles may be omitted; publication is disabled until the mapping is corrected.
              </p>}
              <button
                type="button"
                onClick={handlePreview}
                disabled={!canPreview || isPreviewing}
                className="rounded-lg bg-waldorf-sage-600 px-3 py-2 text-sm text-white disabled:opacity-50"
              >
                {isPreviewing ? 'Rendering...' : 'Render preview'}
              </button>
              <button
                type="button"
                onClick={handlePublish}
                disabled={!preview || !canPublishSelectedNewsletter || preview.eligibleCount === null || preview.eligibleCount === 0 || hasBlockingFindings || hasIncompleteClassMapping || isPublishing || isPreviewing}
                title={hasBlockingFindings
                  ? 'Resolve preparation errors before publishing.'
                  : hasIncompleteClassMapping
                    ? 'Resolve Auth class mappings before publishing.'
                    : !canPublishSelectedNewsletter ? 'Only draft newsletters can be published.' : undefined}
                className="rounded-lg bg-waldorf-peach-600 px-3 py-2 text-sm text-white disabled:opacity-50"
              >
                {isPublishing ? 'Publishing...' : 'Confirm and publish'}
              </button>
            </div>
          </div>

          {preview && (
            <div className="rounded-xl border border-waldorf-cream-200 bg-white p-4">
              <h3 className="mb-2 text-sm font-semibold text-waldorf-clay-700">Preview</h3>
              <div className="mb-3 grid grid-cols-1 gap-2 text-xs text-waldorf-clay-600 sm:grid-cols-3">
                <div>
                  <p className="font-medium">Recipient</p>
                  <p>{preview.guardianEmail ?? 'Family preview — recipient emails checked separately'}</p>
                </div>
                <div>
                  <p className="font-medium">Template</p>
                  <p>{preview.templateLabel}</p>
                </div>
                <div>
                  <p className="font-medium">Family</p>
                  <p>{selectedFamily?.name ?? selectedFamilyId}</p>
                </div>
              </div>
              <p className="mb-1 text-xs text-waldorf-clay-500">Subject</p>
              <p className="mb-3 rounded border border-waldorf-cream-200 bg-waldorf-cream-50 px-3 py-2 text-sm text-waldorf-clay-700">
                {preview.renderedSubject || '(empty)'}
              </p>
              <p className="mb-1 text-xs text-waldorf-clay-500">HTML body (rendered as recipient sees it)</p>
              <iframe
                title="Newsletter email preview"
                srcDoc={preview.renderedBody || '<p>(empty body)</p>'}
                className="h-[640px] w-full rounded border border-waldorf-cream-200 bg-white"
              />
            </div>
          )}

          {findings.length > 0 && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
              <h3 className="mb-2 text-sm font-semibold text-amber-900">
                Preparation findings ({findings.length})
              </h3>
              <ul className="space-y-1 text-xs text-amber-900">
                {findings.map((finding, index) => (
                  <li key={`${finding.code}-${index}`}>
                    <span className="font-mono uppercase">[{finding.severity}]</span>{' '}
                    <span className="font-medium">{finding.code}</span> — {finding.message}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </AdminLayout>
    </ErrorBoundary>
  )
}

export default NewsletterEmailPreviewPage
