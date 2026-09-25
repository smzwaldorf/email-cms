import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { NewsletterEmailPreviewPage } from '@/pages/NewsletterEmailPreviewPage'
const api = vi.hoisted(() => ({ preview: vi.fn(), audience: vi.fn(), publish: vi.fn(), newsletters: vi.fn() }))
vi.mock('@/components/admin/AdminLayout', () => ({ AdminLayout: ({ children }: { children: React.ReactNode }) => children }))
vi.mock('@/services/adminService', () => ({ adminService: {
  fetchNewsletters: api.newsletters,
  fetchClasses: async () => [{ id: 'c1', name: 'Test class' }],
} }))
vi.mock('@/services/smzDirectoryService', () => ({ fetchSmzDirectoryFamilies: async () => [{ id: 'identity-f1', code: 'F1', displayName: 'Identity family' }] }))
vi.mock('@/services/emailTemplateService', () => ({ emailTemplateService: { listTemplates: async () => [{ id: 't1', name: 'Template' }] } }))
vi.mock('@/services/newsletterDeliveryService', () => ({ newsletterDeliveryService: {
  previewPersonalizationForFamily: api.preview, previewAudience: api.audience, createPublishBatch: api.publish,
} }))
beforeEach(() => {
  vi.clearAllMocks()
  api.newsletters.mockResolvedValue([{ id: 'n1', title: 'Draft', status: 'draft' }])
  api.preview.mockResolvedValue({ renderedSubject: 'Subject', renderedBody: '<p>Article</p>', warnings: [], template: { templateRevisionId: 'revision-1' }, guardianEmail: 'test@example.test' })
  api.audience.mockResolvedValue({ eligibleCount: 1, eligibleRecipientCount: 2 })
  api.publish.mockResolvedValue({ id: 'b1', state: 'queued' })
  vi.spyOn(window, 'confirm').mockReturnValue(true)
})
const renderPage = (initialEntry = '/admin/newsletters/preview') =>
  render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <NewsletterEmailPreviewPage />
    </MemoryRouter>,
  )
describe('reviewed email publication', () => {
  it('loads the same unfiltered newsletter catalogue as the Newsletters tab', async () => {
    api.newsletters.mockResolvedValue([
      { id: 'n1', title: 'Draft', status: 'draft' },
      { id: 'n2', title: 'Published', status: 'published' },
    ])
    renderPage()
    await screen.findByRole('option', { name: 'Published (published)' })
    expect(api.newsletters).toHaveBeenCalledWith()
  })

  it('preselects the newsletter named in the ?newsletter= query param', async () => {
    api.newsletters.mockResolvedValue([
      { id: 'n1', title: 'Draft', status: 'draft' },
      { id: 'n2', title: 'Second draft', status: 'draft' },
    ])
    renderPage('/admin/newsletters/preview?newsletter=n2')
    await screen.findByRole('option', { name: 'Second draft (draft)' })
    fireEvent.click(await screen.findByRole('button', { name: '產生預覽' }))
    await waitFor(() => expect(api.preview).toHaveBeenCalledWith({ newsletterId: 'n2', familyId: 'identity-f1', templateId: undefined }))
  })

  it('uses the SMZ Identity family directory in the Family selector', async () => {
    renderPage()
    expect(await screen.findByText('家庭')).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Identity family' })).toBeInTheDocument()
    expect(screen.queryByText('Sample family')).not.toBeInTheDocument()
  })

  it('submits the Auth family to preview and preserves local delivery IDs for publication', async () => {
    renderPage()
    fireEvent.change(await screen.findByLabelText('寄送對象'), { target: { value: 'classes' } })
    fireEvent.click(screen.getByRole('checkbox'))
    fireEvent.click(await screen.findByRole('button', { name: '產生預覽' }))
    await waitFor(() => expect(api.preview).toHaveBeenCalledWith({ newsletterId: 'n1', familyId: 'identity-f1', templateId: undefined }))
    const send = screen.getByRole('button', { name: '確認並發布' })
    await waitFor(() => expect(send).toBeEnabled())
    fireEvent.click(send)
    await waitFor(() => expect(api.publish).toHaveBeenCalledWith({ newsletterId: 'n1', audience: { mode: 'classes', classIds: ['c1'] }, templateRevisionId: 'revision-1' }))
    await waitFor(() => expect(screen.getByRole('button', { name: '確認並發布' })).toBeDisabled())
  })
  it('shows the Auth-derived recipient count for a selected family', async () => {
    renderPage()
    fireEvent.click(await screen.findByRole('button', { name: '產生預覽' }))
    await waitFor(() => expect(api.preview).toHaveBeenCalledWith({ newsletterId: 'n1', familyId: 'identity-f1', templateId: undefined }))
    await waitFor(() => expect(api.audience).toHaveBeenCalledWith({ mode: 'family', familyId: 'identity-f1' }))
    expect(screen.getByText('SMZ Auth 中符合資格的家長： 2')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '確認並發布' })).toBeEnabled()
  })
  it('invalidates review when audience changes and blocks zero-recipient sends', async () => {
    renderPage()
    fireEvent.change(await screen.findByLabelText('寄送對象'), { target: { value: 'classes' } })
    fireEvent.click(screen.getByRole('checkbox'))
    fireEvent.click(await screen.findByRole('button', { name: '產生預覽' }))
    await waitFor(() => expect(screen.getByRole('button', { name: '確認並發布' })).toBeEnabled())
    fireEvent.change(screen.getByLabelText('寄送對象'), { target: { value: 'all' } })
    expect(screen.getByRole('button', { name: '確認並發布' })).toBeDisabled()
    api.audience.mockResolvedValue({ eligibleCount: 0 })
    fireEvent.click(screen.getByRole('button', { name: '產生預覽' }))
    await screen.findByText(/已阻擋寄送/)
    expect(screen.getByRole('button', { name: '確認並發布' })).toBeDisabled()
    expect(api.publish).not.toHaveBeenCalled()
  })
})
