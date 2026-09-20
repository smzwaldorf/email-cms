import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  completeSignIn: vi.fn(),
  getLatestPublishedWeek: vi.fn(),
}))

vi.mock('@/services/authService', () => ({
  authService: { completeSignIn: mocks.completeSignIn },
}))

vi.mock('@/services/WeekService', () => ({
  default: { getLatestPublishedWeek: mocks.getLatestPublishedWeek },
}))

import { AuthCallbackPage } from '@/pages/AuthCallbackPage'

function LocationProbe() {
  return <div>{useLocation().pathname}</div>
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/auth/callback?code=code&state=state']}>
      <Routes>
        <Route path="*" element={<><AuthCallbackPage /><LocationProbe /></>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('AuthCallbackPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('restores the destination carried by OIDC state', async () => {
    mocks.completeSignIn.mockResolvedValue({
      user: { id: 'user-1', email: 'parent@example.com', role: 'parent' },
      redirectTo: '/article/article-1',
    })
    renderPage()
    await waitFor(() => expect(screen.getByText('/article/article-1')).toBeInTheDocument())
    expect(mocks.getLatestPublishedWeek).not.toHaveBeenCalled()
  })

  it('lands an administrator on the dashboard by default', async () => {
    mocks.completeSignIn.mockResolvedValue({ user: { id: 'admin', role: 'admin' } })
    renderPage()
    await waitFor(() => expect(screen.getByText('/admin')).toBeInTheDocument())
    expect(mocks.getLatestPublishedWeek).not.toHaveBeenCalled()
  })

  it('shows a retry path when the callback is rejected', async () => {
    mocks.completeSignIn.mockRejectedValue(new Error('Identity access denied'))
    renderPage()
    await waitFor(() => expect(screen.getByText('Identity access denied')).toBeInTheDocument())
    expect(screen.getByRole('button', { name: '返回登入' })).toBeInTheDocument()
  })

  it('lands an administrator on the dashboard before any newsletter is published', async () => {
    mocks.completeSignIn.mockResolvedValue({ user: { id: 'admin', roles: ['admin'] } })
    renderPage()
    await waitFor(() => expect(screen.getByText('/admin')).toBeInTheDocument())
    expect(mocks.getLatestPublishedWeek).not.toHaveBeenCalled()
  })
})
