import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter, useNavigate } from 'react-router-dom'
import { beforeEach, expect, it, vi } from 'vitest'
import { CmsVisitTracker } from '@/components/CmsVisitTracker'
const m = vi.hoisted(() => ({ request: vi.fn(), auth: { user: { id: 'u', role: 'admin', roles: ['admin'] }, isLoading: false } }))
vi.mock('@/context/AuthContext', () => ({ useAuth: () => m.auth }))
vi.mock('@/services/backendApi', () => ({ backendRequest: m.request }))
function Navigation() {
 const navigate = useNavigate()
 return <><button onClick={() => navigate('/admin/articles?q=garden')}>Filter</button><button onClick={() => navigate('/admin/media')}>Media</button><button onClick={() => navigate('/admin/articles')}>Articles</button></>
}
beforeEach(() => { m.request.mockReset().mockResolvedValue({}); sessionStorage.clear() })
it('deduplicates StrictMode replay but counts returning to a route', () => {
 render(<React.StrictMode><MemoryRouter initialEntries={['/admin/articles']}><CmsVisitTracker /><Navigation /></MemoryRouter></React.StrictMode>)
 expect(m.request).toHaveBeenCalledTimes(1)
 fireEvent.click(screen.getByText('Filter'))
 expect(m.request).toHaveBeenCalledTimes(1)
 fireEvent.click(screen.getByText('Media'))
 fireEvent.click(screen.getByText('Articles'))
 expect(m.request).toHaveBeenCalledTimes(3)
 const payloads = m.request.mock.calls.map(call => JSON.parse(call[1].body))
 expect(new Set(payloads.map(p => p.id)).size).toBe(3)
 expect(new Set(payloads.map(p => p.sessionId)).size).toBe(1)
})
it.each(['/week/2026-W41', '/newsletter/n/a', '/article/a', '/login', '/auth/callback'])('leaves %s to its own tracking policy', path => {
 render(<MemoryRouter initialEntries={[path]}><CmsVisitTracker /></MemoryRouter>)
 expect(m.request).not.toHaveBeenCalled()
})
