/**
 * LoginPage Component Tests
 * Tests for email/password authentication form and quick-fill buttons
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import { LoginPage } from '@/pages/LoginPage'
import { useAuth } from '@/context/AuthContext'

// Mock useAuth hook
vi.mock('@/context/AuthContext', () => ({
  useAuth: vi.fn(),
}))

// Mock useNavigate
const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

describe('LoginPage Component', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockNavigate.mockClear()
    ;(useAuth as any).mockReturnValue({
      signIn: vi.fn().mockResolvedValue(true),
      isLoading: false,
    })
  })

  it('should render login form with email and password inputs', () => {
    render(
      <BrowserRouter>
        <LoginPage />
      </BrowserRouter>,
    )

    expect(screen.getByLabelText(/email/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /login/i })).toBeInTheDocument()
  })

  it('should show error when submitting empty form', async () => {
    render(
      <BrowserRouter>
        <LoginPage />
      </BrowserRouter>,
    )

    const submitButton = screen.getByRole('button', { name: /login/i })
    fireEvent.click(submitButton)

    await waitFor(() => {
      expect(screen.getByText(/please enter both email and password/i)).toBeInTheDocument()
    })
  })

  it('should show quick-fill buttons in dev mode', () => {
    render(
      <BrowserRouter>
        <LoginPage />
      </BrowserRouter>,
    )

    // Check for test user buttons
    expect(screen.getByRole('button', { name: /parent 1/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /parent 2/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /admin/i })).toBeInTheDocument()
  })

  it('should fill credentials when Parent 1 button is clicked', async () => {
    render(
      <BrowserRouter>
        <LoginPage />
      </BrowserRouter>,
    )

    const parent1Button = screen.getByRole('button', { name: /parent 1/i })
    fireEvent.click(parent1Button)

    await waitFor(() => {
      const emailInput = screen.getByDisplayValue('parent1@example.com')
      const passwordInput = screen.getByDisplayValue('parent1password123')
      expect(emailInput).toBeInTheDocument()
      expect(passwordInput).toBeInTheDocument()
    })
  })

  it('should fill credentials when Parent 2 button is clicked', async () => {
    render(
      <BrowserRouter>
        <LoginPage />
      </BrowserRouter>,
    )

    const parent2Button = screen.getByRole('button', { name: /parent 2/i })
    fireEvent.click(parent2Button)

    await waitFor(() => {
      const emailInput = screen.getByDisplayValue('parent2@example.com')
      const passwordInput = screen.getByDisplayValue('parent2password123')
      expect(emailInput).toBeInTheDocument()
      expect(passwordInput).toBeInTheDocument()
    })
  })

  it('should fill credentials when Admin button is clicked', async () => {
    render(
      <BrowserRouter>
        <LoginPage />
      </BrowserRouter>,
    )

    const adminButton = screen.getByRole('button', { name: /admin/i })
    fireEvent.click(adminButton)

    await waitFor(() => {
      const emailInput = screen.getByDisplayValue('admin@example.com')
      const passwordInput = screen.getByDisplayValue('admin123456')
      expect(emailInput).toBeInTheDocument()
      expect(passwordInput).toBeInTheDocument()
    })
  })

  it('should submit form after 1 second delay when quick-fill button is clicked', async () => {
    const mockSignIn = vi.fn().mockResolvedValue(true)
    ;(useAuth as any).mockReturnValue({
      signIn: mockSignIn,
      isLoading: false,
    })

    render(
      <BrowserRouter>
        <LoginPage />
      </BrowserRouter>,
    )

    const parent1Button = screen.getByRole('button', { name: /parent 1/i })
    fireEvent.click(parent1Button)

    // Wait for the 1 second delay + form submission
    await waitFor(
      () => {
        expect(mockSignIn).toHaveBeenCalledWith('parent1@example.com', 'parent1password123')
      },
      { timeout: 2000 },
    )
  })

  it('should clear error message when quick-fill button is clicked', async () => {
    render(
      <BrowserRouter>
        <LoginPage />
      </BrowserRouter>,
    )

    // First, create an error
    const submitButton = screen.getByRole('button', { name: /login/i })
    fireEvent.click(submitButton)

    await waitFor(() => {
      expect(screen.getByText(/please enter both email and password/i)).toBeInTheDocument()
    })

    // Now click quick-fill button
    const parent1Button = screen.getByRole('button', { name: /parent 1/i })
    fireEvent.click(parent1Button)

    // Error should be cleared
    await waitFor(() => {
      expect(screen.queryByText(/please enter both email and password/i)).not.toBeInTheDocument()
    })
  })

  it('should disable quick-fill buttons when sign-in is in progress', () => {
    ;(useAuth as any).mockReturnValue({
      signIn: vi.fn(),
      isLoading: true,
    })

    render(
      <BrowserRouter>
        <LoginPage />
      </BrowserRouter>,
    )

    const parent1Button = screen.getByRole('button', { name: /parent 1/i })
    expect(parent1Button).toBeDisabled()
  })

  it('should navigate to /week/2025-W47 on successful login', async () => {
    const mockSignIn = vi.fn().mockResolvedValue(true)
    ;(useAuth as any).mockReturnValue({
      signIn: mockSignIn,
      isLoading: false,
    })

    render(
      <BrowserRouter>
        <LoginPage />
      </BrowserRouter>,
    )

    const emailInput = screen.getByLabelText(/email/i)
    const passwordInput = screen.getByLabelText(/password/i)
    const submitButton = screen.getByRole('button', { name: /login/i })

    fireEvent.change(emailInput, { target: { value: 'parent1@example.com' } })
    fireEvent.change(passwordInput, { target: { value: 'parent1password123' } })
    fireEvent.click(submitButton)

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/week/2025-W47')
    })
  })

  it('should show error message on failed login', async () => {
    const mockSignIn = vi.fn().mockResolvedValue(false)
    ;(useAuth as any).mockReturnValue({
      signIn: mockSignIn,
      isLoading: false,
    })

    render(
      <BrowserRouter>
        <LoginPage />
      </BrowserRouter>,
    )

    const emailInput = screen.getByLabelText(/email/i)
    const passwordInput = screen.getByLabelText(/password/i)
    const submitButton = screen.getByRole('button', { name: /login/i })

    fireEvent.change(emailInput, { target: { value: 'invalid@example.com' } })
    fireEvent.change(passwordInput, { target: { value: 'wrongpassword' } })
    fireEvent.click(submitButton)

    await waitFor(() => {
      expect(screen.getByText(/invalid email or password/i)).toBeInTheDocument()
    })
  })
})
