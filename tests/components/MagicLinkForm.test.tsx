/**
 * MagicLinkForm Component Tests
 * Tests for magic link form with redirect URL handling
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MagicLinkForm } from '@/components/MagicLinkForm'

// Mock useAuth hook
const mockSendMagicLink = vi.fn()
const mockUseAuth = vi.fn()

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}))

describe('MagicLinkForm - Redirect URL Handling', () => {
  const mockOnSuccess = vi.fn()
  const testEmail = 'test@example.com'
  const testRedirectUrl = '/week/2025-W43/a001'

  beforeEach(() => {
    vi.clearAllMocks()
    mockSendMagicLink.mockResolvedValue(true)
    mockUseAuth.mockReturnValue({
      sendMagicLink: mockSendMagicLink,
    })

    // Mock localStorage
    const localStorageMock = {
      getItem: vi.fn(),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
    }
    global.localStorage = localStorageMock as any
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('basic rendering', () => {
    it('should render email input field', () => {
      render(<MagicLinkForm onSuccess={mockOnSuccess} />)
      const emailInput = screen.getByPlaceholderText('your-email@example.com')
      expect(emailInput).toBeInTheDocument()
    })

    it('should render submit button', () => {
      render(<MagicLinkForm onSuccess={mockOnSuccess} />)
      const submitButton = screen.getByRole('button', { name: /發送登入連結/i })
      expect(submitButton).toBeInTheDocument()
    })
  })

  describe('magic link sending without redirect', () => {
    it('should send magic link without redirectTo prop', async () => {
      const user = userEvent.setup()
      render(<MagicLinkForm onSuccess={mockOnSuccess} />)

      const emailInput = screen.getByPlaceholderText('your-email@example.com')
      await user.type(emailInput, testEmail)

      const submitButton = screen.getByRole('button', { name: /發送登入連結/i })
      await user.click(submitButton)

      await waitFor(() => {
        expect(mockSendMagicLink).toHaveBeenCalledWith(testEmail, undefined)
      })
    })
  })

  describe('magic link sending with redirectTo prop', () => {
    it('should send magic link with provided redirectTo prop', async () => {
      const user = userEvent.setup()
      render(<MagicLinkForm onSuccess={mockOnSuccess} redirectTo={testRedirectUrl} />)

      const emailInput = screen.getByPlaceholderText('your-email@example.com')
      await user.type(emailInput, testEmail)

      const submitButton = screen.getByRole('button', { name: /發送登入連結/i })
      await user.click(submitButton)

      await waitFor(() => {
        expect(mockSendMagicLink).toHaveBeenCalledWith(testEmail, testRedirectUrl)
      })
    })

    it('should prioritize redirectTo prop over localStorage', async () => {
      const user = userEvent.setup()
      const localStorageMock = global.localStorage as any
      localStorageMock.getItem.mockReturnValue('cached_value')

      render(<MagicLinkForm onSuccess={mockOnSuccess} redirectTo={testRedirectUrl} />)

      const emailInput = screen.getByPlaceholderText('your-email@example.com')
      await user.type(emailInput, testEmail)

      const submitButton = screen.getByRole('button', { name: /發送登入連結/i })
      await user.click(submitButton)

      await waitFor(() => {
        expect(mockSendMagicLink).toHaveBeenCalledWith(testEmail, testRedirectUrl)
      })
    })
  })

  describe('magic link sending with cached redirect', () => {
    it('should send magic link with cached shortId and weekNumber', async () => {
      const user = userEvent.setup()
      const localStorageMock = global.localStorage as any
      localStorageMock.getItem.mockImplementation((key: string) => {
        if (key === 'pending_short_id') return 'a001'
        if (key === 'pending_week_number') return '2025-W43'
        return null
      })

      render(<MagicLinkForm onSuccess={mockOnSuccess} />)

      const emailInput = screen.getByPlaceholderText('your-email@example.com')
      await user.type(emailInput, testEmail)

      const submitButton = screen.getByRole('button', { name: /發送登入連結/i })
      await user.click(submitButton)

      const expectedRedirectUrl = '/week/2025-W43/a001'
      await waitFor(() => {
        expect(mockSendMagicLink).toHaveBeenCalledWith(testEmail, expectedRedirectUrl)
      })
    })

    it('should not construct redirect URL if only shortId exists without weekNumber', async () => {
      const user = userEvent.setup()
      const localStorageMock = global.localStorage as any
      localStorageMock.getItem.mockImplementation((key: string) => {
        if (key === 'pending_short_id') return 'a001'
        return null
      })

      render(<MagicLinkForm onSuccess={mockOnSuccess} />)

      const emailInput = screen.getByPlaceholderText('your-email@example.com')
      await user.type(emailInput, testEmail)

      const submitButton = screen.getByRole('button', { name: /發送登入連結/i })
      await user.click(submitButton)

      await waitFor(() => {
        expect(mockSendMagicLink).toHaveBeenCalledWith(testEmail, undefined)
      })
    })
  })

  describe('validation', () => {
    it('should show error for empty email', async () => {
      const user = userEvent.setup()
      render(<MagicLinkForm onSuccess={mockOnSuccess} />)

      const submitButton = screen.getByRole('button', { name: /發送登入連結/i })
      await act(async () => {
        await user.click(submitButton)
      })

      expect(screen.getByText(/Please enter your email address/i)).toBeInTheDocument()
      expect(mockSendMagicLink).not.toHaveBeenCalled()
    })

    it('should show error for invalid email format', async () => {
      const user = userEvent.setup()
      const { container } = render(<MagicLinkForm onSuccess={mockOnSuccess} />)

      const emailInput = screen.getByPlaceholderText('your-email@example.com') as HTMLInputElement
      const form = container.querySelector('form')!

      // Set invalid email value
      await user.type(emailInput, 'invalidemail')

      // Dispatch form submit event to trigger handleSubmit
      await act(async () => {
        form.dispatchEvent(new Event('submit', { bubbles: true }))
      })

      expect(screen.getByText(/Please enter a valid email address/i)).toBeInTheDocument()
      expect(mockSendMagicLink).not.toHaveBeenCalled()
    })
  })

  describe('error handling', () => {
    it('should show error message when magic link send fails', async () => {
      mockSendMagicLink.mockResolvedValueOnce(false)
      const user = userEvent.setup()
      render(<MagicLinkForm onSuccess={mockOnSuccess} />)

      const emailInput = screen.getByPlaceholderText('your-email@example.com')
      await user.type(emailInput, testEmail)

      const submitButton = screen.getByRole('button', { name: /發送登入連結/i })
      await user.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText(/Failed to send magic link/i)).toBeInTheDocument()
      })
    })

    it('should handle exception during send', async () => {
      mockSendMagicLink.mockRejectedValueOnce(new Error('Network error'))
      const user = userEvent.setup()
      render(<MagicLinkForm onSuccess={mockOnSuccess} />)

      const emailInput = screen.getByPlaceholderText('your-email@example.com')
      await user.type(emailInput, testEmail)

      const submitButton = screen.getByRole('button', { name: /發送登入連結/i })
      await user.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText(/Failed to send magic link/i)).toBeInTheDocument()
      })
    })
  })

  describe('confirmation step', () => {
    it('should show confirmation step after successful send', async () => {
      const user = userEvent.setup()
      render(<MagicLinkForm onSuccess={mockOnSuccess} />)

      const emailInput = screen.getByPlaceholderText('your-email@example.com')
      await user.type(emailInput, testEmail)

      const submitButton = screen.getByRole('button', { name: /發送登入連結/i })
      await user.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText(/檢查您的電子郵件/i)).toBeInTheDocument()
      })
    })

    it('should allow user to switch back to email input', async () => {
      const user = userEvent.setup()
      render(<MagicLinkForm onSuccess={mockOnSuccess} />)

      const emailInput = screen.getByPlaceholderText('your-email@example.com')
      await user.type(emailInput, testEmail)

      const submitButton = screen.getByRole('button', { name: /發送登入連結/i })
      await user.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText(/檢查您的電子郵件/i)).toBeInTheDocument()
      })

      const backButton = screen.getByRole('button', { name: /使用不同的電子郵件/i })
      await user.click(backButton)

      expect(screen.getByPlaceholderText('your-email@example.com')).toBeInTheDocument()
    })
  })

  describe('button disabled state', () => {
    it('should disable submit button during loading', async () => {
      render(<MagicLinkForm onSuccess={mockOnSuccess} isLoading={true} />)

      const submitButton = screen.getByRole('button', { name: /發送登入連結/i })
      expect(submitButton).toBeDisabled()
    })
  })

  describe('redirect URL passed to authService', () => {
    it('should pass redirectTo to sendMagicLink when provided', async () => {
      const user = userEvent.setup()
      const customRedirectUrl = '/week/2025-W50/b001'

      render(<MagicLinkForm onSuccess={mockOnSuccess} redirectTo={customRedirectUrl} />)

      const emailInput = screen.getByPlaceholderText('your-email@example.com')
      await user.type(emailInput, testEmail)

      const submitButton = screen.getByRole('button', { name: /發送登入連結/i })
      await user.click(submitButton)

      await waitFor(() => {
        expect(mockSendMagicLink).toHaveBeenCalledWith(testEmail, customRedirectUrl)
      })
    })

    it('should construct redirect from localStorage and pass to sendMagicLink', async () => {
      const user = userEvent.setup()
      const localStorageMock = global.localStorage as any
      localStorageMock.getItem.mockImplementation((key: string) => {
        if (key === 'pending_short_id') return 'c001'
        if (key === 'pending_week_number') return '2025-W45'
        return null
      })

      render(<MagicLinkForm onSuccess={mockOnSuccess} />)

      const emailInput = screen.getByPlaceholderText('your-email@example.com')
      await user.type(emailInput, testEmail)

      const submitButton = screen.getByRole('button', { name: /發送登入連結/i })
      await user.click(submitButton)

      await waitFor(() => {
        expect(mockSendMagicLink).toHaveBeenCalledWith(testEmail, '/week/2025-W45/c001')
      })
    })
  })
})
