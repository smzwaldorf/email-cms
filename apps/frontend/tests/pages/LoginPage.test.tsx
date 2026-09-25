import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ isLoading: false }),
}))

vi.mock('@/components/GoogleButton', () => ({
  GoogleButton: ({ redirectTo }: { redirectTo?: string }) => (
    <button type="button">SMZ Identity {redirectTo || 'home'}</button>
  ),
}))

import { LoginPage } from '@/pages/LoginPage'

describe('LoginPage', () => {
  it('offers the central identity login', () => {
    render(<MemoryRouter initialEntries={['/login']}><LoginPage /></MemoryRouter>)
    expect(screen.getByRole('button', { name: 'SMZ Identity home' })).toBeInTheDocument()
    expect(screen.getByText(/只有已核准、啟用且具備 Email CMS 存取權的學校帳號/)).toBeInTheDocument()
  })

  it('passes through a safe requested destination', () => {
    render(<MemoryRouter initialEntries={['/login?redirect_to=%2Fweek%2F2025-W47']}><LoginPage /></MemoryRouter>)
    expect(screen.getByRole('button', { name: 'SMZ Identity /week/2025-W47' })).toBeInTheDocument()
  })

  it('drops an external requested destination', () => {
    render(<MemoryRouter initialEntries={['/login?redirect_to=https%3A%2F%2Fevil.example']}><LoginPage /></MemoryRouter>)
    expect(screen.getByRole('button', { name: 'SMZ Identity home' })).toBeInTheDocument()
  })
})
