import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
const mocks = vi.hoisted(() => ({ clear: vi.fn(), postMessage: vi.fn() }))
vi.mock('@/services/authService', () => ({ authService: { clearSessionForGlobalLogout: mocks.clear } }))
vi.mock('@/services/smzAuth', () => ({ smzAuthIssuer: () => 'http://localhost:3000/api/auth' }))
import { LocalLogoutPage } from '@/pages/LocalLogoutPage'
const parentDescriptor = Object.getOwnPropertyDescriptor(window, 'parent')!
beforeEach(() => {
  vi.clearAllMocks(); vi.spyOn(document, 'referrer', 'get').mockReturnValue('http://localhost:3000/'); mocks.clear.mockResolvedValue(undefined)
  window.history.replaceState(null, '', '/logout/local?logout_state=10000000-0000-4000-8000-000000000001&returnTo=https://evil.example')
  Object.defineProperty(window, 'parent', { configurable: true, value: { postMessage: mocks.postMessage } })
})
afterEach(() => {
  Object.defineProperty(window, 'parent', parentDescriptor)
  window.history.replaceState(null, '', '/')
  vi.restoreAllMocks()
})
describe('front-channel local logout', () => {
  it('acknowledges cleanup only to configured Auth origin and never follows caller redirects', async () => {
    render(<LocalLogoutPage />)
    await waitFor(() => expect(screen.getByText('Signed out of Email CMS.')).toBeInTheDocument())
    expect(mocks.postMessage).toHaveBeenCalledWith({ type: 'smz:logout-complete', state: '10000000-0000-4000-8000-000000000001' }, 'http://localhost:3000')
    expect(window.location.pathname).toBe('/logout/local')
  })
  it('does not falsely acknowledge failed cleanup', async () => {
    mocks.clear.mockRejectedValue(new Error('cleanup failed'))
    render(<LocalLogoutPage />)
    await waitFor(() => expect(mocks.clear).toHaveBeenCalledOnce())
    expect(mocks.postMessage).not.toHaveBeenCalled()
  })
  it('rejects an untrusted parent origin without clearing sessions', async () => {
    vi.spyOn(document, 'referrer', 'get').mockReturnValue('https://evil.example/')
    render(<LocalLogoutPage />)
    await waitFor(() => expect(screen.getByText('Invalid logout request.')).toBeInTheDocument())
    expect(mocks.clear).not.toHaveBeenCalled()
    expect(mocks.postMessage).not.toHaveBeenCalled()
  })
  it('rejects a malformed coordinator state', async () => {
    window.history.replaceState(null, '', '/logout/local?logout_state=bad')
    render(<LocalLogoutPage />)
    await waitFor(() => expect(screen.getByText('Invalid logout request.')).toBeInTheDocument())
    expect(mocks.clear).not.toHaveBeenCalled()
  })

})
