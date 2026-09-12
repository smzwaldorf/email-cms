import React from 'react'
import { act, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthProvider, useAuth } from '../../src/context/AuthContext'

const mocks = vi.hoisted(() => ({
  ensureInitialized: vi.fn(),
  getCurrentUser: vi.fn(),
  onAuthStateChange: vi.fn(),
  unsubscribe: vi.fn(),
}))

vi.mock('@/services/authService', () => ({
  authService: {
    ensureInitialized: mocks.ensureInitialized,
    getCurrentUser: mocks.getCurrentUser,
    onAuthStateChange: mocks.onAuthStateChange,
    startSessionMonitoring: () => () => {},
  },
}))

vi.mock('@/services/tokenManager', () => ({
  tokenManager: { onLogout: vi.fn() },
}))

vi.mock('@/services/PermissionService', () => ({
  clearPermissionCache: vi.fn(),
}))

const SessionState = () => {
  const { isAuthenticated, isLoading, user } = useAuth()

  return (
    <div>
      <span data-testid="loading">{String(isLoading)}</span>
      <span data-testid="authenticated">{String(isAuthenticated)}</span>
      <span data-testid="email">{user?.email ?? ''}</span>
    </div>
  )
}

describe('AuthContext SMZ session', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.ensureInitialized.mockResolvedValue(undefined)
    mocks.getCurrentUser.mockReturnValue({
      id: 'local-user-id',
      email: 'parent@example.com',
      role: 'parent',
    })
    mocks.onAuthStateChange.mockReturnValue(mocks.unsubscribe)
  })

  it('restores the central OIDC session and exposes the mapped local user', async () => {
    render(
      <AuthProvider>
        <SessionState />
      </AuthProvider>,
    )

    expect(screen.getByTestId('loading')).toHaveTextContent('true')

    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('false')
    })

    expect(mocks.ensureInitialized).toHaveBeenCalledOnce()
    expect(mocks.onAuthStateChange).toHaveBeenCalledOnce()
    expect(screen.getByTestId('authenticated')).toHaveTextContent('true')
    expect(screen.getByTestId('email')).toHaveTextContent('parent@example.com')
  })

  it('shows renewal notice without unmounting the authenticated page', async () => {
    render(<AuthProvider><SessionState /></AuthProvider>)
    await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('false'))
    act(() => { window.dispatchEvent(new Event('cms-auth-renewal-required')) })
    expect(screen.getByRole('alert')).toHaveTextContent('目前頁面會保留')
    expect(screen.getByTestId('authenticated')).toHaveTextContent('true')
    act(() => { window.dispatchEvent(new Event('cms-auth-renewed')) })
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('uses the SMZ auth subscription and removes it on unmount', async () => {
    const { unmount } = render(
      <AuthProvider>
        <SessionState />
      </AuthProvider>,
    )

    await waitFor(() => expect(mocks.onAuthStateChange).toHaveBeenCalledOnce())

    act(() => unmount())

    expect(mocks.unsubscribe).toHaveBeenCalledOnce()
  })
})
