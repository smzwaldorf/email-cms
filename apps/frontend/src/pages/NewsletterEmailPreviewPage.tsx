import { useEffect, useMemo, useState } from 'react'
import { AdminLayout } from '@/components/admin/AdminLayout'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { adminService } from '@/services/adminService'
import { emailTemplateService } from '@/services/emailTemplateService'
import { newsletterDeliveryService } from '@/services/newsletterDeliveryService'
import type { AdminNewsletter, Family } from '@/types/admin'
import type { EmailTemplate } from '@/types/emailTemplate'
import type { PersonalizationWarning } from '@/types/personalization'
import type { PreparationFinding } from '@/types/emailPreparation'

interface PreviewResult {
  renderedSubject: string
  renderedBody: string
  warnings: PersonalizationWarning[]
  guardianEmail: string | null
  templateLabel: string
}

/**
 * Admin "Apply for merge" preview page.
 *
 * Picks a newsletter + sample family + email template, runs
 * `composePersonalizedEmails` through `previewPersonalizationForFamily`
 * (no batch is created), and renders the resulting per-recipient HTML
 * inline. The "Confirm and publish" action publishes via
 * `newsletterDeliveryService.createPublishBatch` only after the admin
 * has approved the rendered output.
 */
export function NewsletterEmailPreviewPage() {
  const [newsletters, setNewsletters] = useState<AdminNewsletter[]>([])
  const [families, setFamilies] = useState<Family[]>([])
  const [templates, setTemplates] = useState<EmailTemplate[]>([])
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
        const [nl, fam, tmpl] = await Promise.all([
          adminService.fetchNewsletters({ status: 'draft' }),
          adminService.fetchFamilies(),
          emailTemplateService.listTemplates(),
        ])
        setNewsletters(nl)
        setFamilies(fam)
        setTemplates(tmpl)
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
      setPreview({
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
    if (!selectedNewsletterId) return
    const confirmed = window.confirm(
      `Publish "${selectedNewsletter?.title ?? selectedNewsletterId}" to its full audience? This creates a real delivery batch.`,
    )
    if (!confirmed) return
    setIsPublishing(true)
    setError(null)
    setSuccess(null)
    try {
      const batch = await newsletterDeliveryService.createPublishBatch({
        newsletterId: selectedNewsletterId,
        audience: { mode: 'all' },
      })
      setSuccess(`Published delivery batch ${batch.id} (state: ${batch.state}).`)
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

  return (
    <ErrorBoundary>
      <AdminLayout activeTab="email-templates">
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
                    onChange={(event) => setSelectedNewsletterId(event.target.value)}
                    className="rounded border border-waldorf-cream-300 px-2 py-1 text-sm text-waldorf-clay-700"
                  >
                    <option value="">Select newsletter</option>
                    {newsletters.map((newsletter) => (
                      <option key={newsletter.id} value={newsletter.id}>
                        {newsletter.title || newsletter.weekNumber || newsletter.id}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="flex flex-col gap-1 text-xs text-waldorf-clay-600">
                  <span className="font-medium">Sample family</span>
                  <select
                    value={selectedFamilyId}
                    onChange={(event) => setSelectedFamilyId(event.target.value)}
                    className="rounded border border-waldorf-cream-300 px-2 py-1 text-sm text-waldorf-clay-700"
                  >
                    <option value="">Select family</option>
                    {families.map((family) => (
                      <option key={family.id} value={family.id}>
                        {family.name || family.id}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="flex flex-col gap-1 text-xs text-waldorf-clay-600">
                  <span className="font-medium">Email template (optional)</span>
                  <select
                    value={selectedTemplateId}
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
                disabled={!preview || isPublishing}
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
                  <p>{preview.guardianEmail ?? '(no guardian email)'}</p>
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
