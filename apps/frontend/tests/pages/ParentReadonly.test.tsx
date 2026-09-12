import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({
  user: { id: 'parent', email: 'synthetic-parent@example.test', role: 'parent', roles: ['parent'] },
  isAuthenticated: true, isLoading: false, signOut: vi.fn(),
}) }))
import { ProtectedRoute } from '@/components/ProtectedRoute'
import { UserMenu } from '@/components/UserMenu'
describe('parent UI boundary', () => {
  it('redirects a parent away from the admin panel without rendering its controls', () => {
    render(<MemoryRouter initialEntries={['/admin']}><Routes>
      <Route path="/admin" element={<ProtectedRoute requiredRole="admin"><button>Publish newsletter</button></ProtectedRoute>} />
      <Route path="/" element={<p>Reader home</p>} />
    </Routes></MemoryRouter>)
    expect(screen.getByText('Reader home')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Publish newsletter' })).not.toBeInTheDocument()
  })
  it('offers no administrator navigation in the parent menu', () => {
    render(<UserMenu />)
    fireEvent.click(screen.getByRole('button', { name: 'User menu' }))
    expect(screen.getByText('parent')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Admin Dashboard' })).not.toBeInTheDocument()
  })
})
