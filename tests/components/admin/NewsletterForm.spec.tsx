import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { NewsletterForm } from '@/components/admin/NewsletterForm'
import { adminService } from '@/services/adminService'
import { BrowserRouter } from 'react-router-dom'

// Mock adminService
vi.mock('@/services/adminService', () => ({
  adminService: {
    createNewsletter: vi.fn(),
    createNewsletterFromTemplate: vi.fn(),
    updateNewsletter: vi.fn(),
    fetchNewsletters: vi.fn(),
  },
  AdminServiceError: class extends Error {},
}))

// Mock useNavigate
const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

describe('NewsletterForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(adminService.fetchNewsletters).mockResolvedValue([])
  })

  it('renders form fields correctly', () => {
    render(
      <BrowserRouter>
        <NewsletterForm />
      </BrowserRouter>
    )

    expect(screen.getByLabelText(/週次/)).toBeInTheDocument()
    expect(screen.getByLabelText(/預計發布日期/)).toBeInTheDocument()
    expect(screen.getByText('建立電子報')).toBeInTheDocument()
  })

  it('validates week number format', async () => {
    render(
      <BrowserRouter>
        <NewsletterForm />
      </BrowserRouter>
    )

    const weekInput = screen.getByLabelText(/週次/)
    const dateInput = screen.getByLabelText(/預計發布日期/)
    const submitBtn = screen.getByText('建立電子報')

    fireEvent.change(weekInput, { target: { value: 'invalid-format' } })
    fireEvent.change(dateInput, { target: { value: '2025-01-01' } })
    fireEvent.click(submitBtn)

    await waitFor(() => {
      expect(screen.getByText(/週次格式錯誤/)).toBeInTheDocument()
    })
    expect(adminService.createNewsletter).not.toHaveBeenCalled()
  })

  it('submits form with valid data', async () => {
    vi.mocked(adminService.createNewsletter).mockResolvedValueOnce({
      id: 'newsletter-1',
      weekNumber: '2025-W48',
      title: null,
      description: null,
      releaseDate: '2025-11-30',
      status: 'draft',
      articleCount: 0,
      createdAt: '2025-11-01',
      updatedAt: '2025-11-01',
      publishedAt: null,
      isPublished: false,
    })

    render(
      <BrowserRouter>
        <NewsletterForm />
      </BrowserRouter>
    )

    const weekInput = screen.getByLabelText(/週次/)
    const dateInput = screen.getByLabelText(/預計發布日期/)
    const submitBtn = screen.getByText('建立電子報')

    fireEvent.change(weekInput, { target: { value: '2025-W48' } })
    fireEvent.change(dateInput, { target: { value: '2025-11-30' } })
    fireEvent.click(submitBtn)

    await waitFor(() => {
      expect(adminService.createNewsletter).toHaveBeenCalledWith(
        '2025-W48',
        '2025-11-30',
        {
          title: '',
          description: '',
        }
      )
      expect(mockNavigate).toHaveBeenCalledWith('/admin/newsletters/2025-W48')
    })
  })

  it('submits form with template selection', async () => {
    vi.mocked(adminService.fetchNewsletters).mockResolvedValueOnce([
      {
        id: 'template-1',
        weekNumber: '2025-W47',
        title: 'Week 47',
        description: null,
        releaseDate: '2025-11-23',
        status: 'published',
        articleCount: 3,
        createdAt: '2025-11-20',
        updatedAt: '2025-11-20',
        publishedAt: '2025-11-23',
        isPublished: true,
      },
    ])
    vi.mocked(adminService.createNewsletterFromTemplate).mockResolvedValueOnce({
      id: 'newsletter-2',
      weekNumber: '2025-W48',
      title: 'Week 48',
      description: 'Copied',
      releaseDate: '2025-11-30',
      status: 'draft',
      articleCount: 3,
      createdAt: '2025-11-25',
      updatedAt: '2025-11-25',
      publishedAt: null,
      isPublished: false,
    })

    render(
      <BrowserRouter>
        <NewsletterForm />
      </BrowserRouter>
    )

    await waitFor(() => {
      expect(adminService.fetchNewsletters).toHaveBeenCalled()
    })

    fireEvent.change(screen.getByTestId('template-select'), { target: { value: 'template-1' } })
    fireEvent.change(screen.getByLabelText(/週次/), { target: { value: '2025-W48' } })
    fireEvent.change(screen.getByLabelText(/預計發布日期/), { target: { value: '2025-11-30' } })
    fireEvent.click(screen.getByText('建立電子報'))

    await waitFor(() => {
      expect(adminService.createNewsletterFromTemplate).toHaveBeenCalledWith('template-1', {
        weekNumber: '2025-W48',
        title: '',
        description: '',
        releaseDate: '2025-11-30',
      })
    })
  })

  it('submits draft metadata updates in edit mode', async () => {
    const onSuccess = vi.fn()
    vi.mocked(adminService.updateNewsletter).mockResolvedValueOnce({
      id: 'newsletter-1',
      weekNumber: '2025-W48',
      title: 'Updated title',
      description: 'Updated description',
      releaseDate: '2025-11-30',
      status: 'draft',
      articleCount: 1,
      createdAt: '2025-11-01',
      updatedAt: '2025-11-02',
      publishedAt: null,
      isPublished: false,
    })

    render(
      <BrowserRouter>
        <NewsletterForm
          mode="edit"
          newsletter={{
            id: 'newsletter-1',
            weekNumber: '2025-W48',
            title: 'Original title',
            description: 'Original description',
            releaseDate: '2025-11-29',
            status: 'draft',
            articleCount: 1,
            createdAt: '2025-11-01',
            updatedAt: '2025-11-01',
            publishedAt: null,
            isPublished: false,
          }}
          onSuccess={onSuccess}
        />
      </BrowserRouter>
    )

    fireEvent.change(screen.getByLabelText(/標題/), { target: { value: 'Updated title' } })
    fireEvent.change(screen.getByLabelText(/摘要/), { target: { value: 'Updated description' } })
    fireEvent.change(screen.getByLabelText(/預計發布日期/), { target: { value: '2025-11-30' } })
    fireEvent.click(screen.getByText('儲存電子報'))

    await waitFor(() => {
      expect(adminService.updateNewsletter).toHaveBeenCalledWith('newsletter-1', {
        weekNumber: '2025-W48',
        title: 'Updated title',
        description: 'Updated description',
        releaseDate: '2025-11-30',
      })
      expect(onSuccess).toHaveBeenCalled()
    })
  })

  it('handles API errors', async () => {
    const errorMsg = 'Failed to create'
    vi.mocked(adminService.createNewsletter).mockRejectedValueOnce(new Error(errorMsg))

    render(
      <BrowserRouter>
        <NewsletterForm />
      </BrowserRouter>
    )

    const weekInput = screen.getByLabelText(/週次/)
    const dateInput = screen.getByLabelText(/預計發布日期/)
    const submitBtn = screen.getByText('建立電子報')

    fireEvent.change(weekInput, { target: { value: '2025-W48' } })
    fireEvent.change(dateInput, { target: { value: '2025-11-30' } })
    fireEvent.click(submitBtn)

    await waitFor(() => {
      expect(screen.getByText(errorMsg)).toBeInTheDocument()
    })
  })
})
