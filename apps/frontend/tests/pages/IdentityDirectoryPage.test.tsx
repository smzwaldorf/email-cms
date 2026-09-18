import { render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { IdentityDirectoryPage } from '../../src/pages/IdentityDirectoryPage'
import { backendRequest } from '../../src/services/backendApi'
vi.mock('../../src/services/backendApi', () => ({ backendRequest: vi.fn() }))
vi.mock('../../src/components/admin/AdminLayout', () => ({ AdminLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }))
const graph = { families: [{id:'f', displayName:'Auth family',code:'F'}], classes: [], people: [], familyMemberships: [], classMemberships: [] }
beforeEach(() => vi.resetAllMocks())
describe('central identity directory', () => {
  it('fetches Auth records and provides management link without mutation controls', async () => {
    vi.mocked(backendRequest).mockResolvedValue(graph)
    render(<IdentityDirectoryPage kind="families" />)
    expect(await screen.findByText('Auth family')).toBeTruthy()
    expect(backendRequest).toHaveBeenCalledWith('/api/admin/directory/families')
    expect(screen.getByRole('link', { name: 'Manage in SMZ Auth' }).getAttribute('href')).toMatch(/\/admin$/)
    expect(screen.queryAllByRole('button')).toHaveLength(0)
  })
  it('shows API failures instead of a local fallback', async () => {
    vi.mocked(backendRequest).mockRejectedValue(new Error('Directory unavailable'))
    render(<IdentityDirectoryPage kind="families" />)
    await waitFor(() => expect(screen.getByRole('alert').textContent).toBe('Directory unavailable'))
    expect(screen.queryByText('Auth family')).toBeNull()
  })
})

it('keeps people and relationships in Auth without fetching a browser graph', () => {
  render(<IdentityDirectoryPage kind="relationships" />)
  expect(screen.getByRole('link', { name: 'Manage in SMZ Auth' })).toBeTruthy()
  expect(backendRequest).not.toHaveBeenCalled()
})
