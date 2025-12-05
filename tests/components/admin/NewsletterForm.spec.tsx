import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { NewsletterForm } from '@/components/admin/NewsletterForm'
import { adminService } from '@/services/adminService'
import { BrowserRouter } from 'react-router-dom'

// Mock adminService
vi.mock('@/services/adminService', () => ({
  adminService: {
    createNewsletter: vi.fn(),
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
        '2025-11-30'
      )
      expect(mockNavigate).toHaveBeenCalledWith('/admin')
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
