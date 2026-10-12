import React from 'react'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ProtectedRoute } from '@/components/ProtectedRoute'
const mocks = vi.hoisted(() => ({ signInWithGoogle: vi.fn() }))
vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ user: null, isAuthenticated: false, isLoading: true, signInWithGoogle: mocks.signInWithGoogle }) }))
afterEach(() => { vi.useRealTimers(); history.replaceState(null, '', '/'); vi.clearAllMocks() })
describe('slow session recovery', () => {
  it('starts sign-in directly and preserves the full destination instead of reloading', async () => {
    vi.useFakeTimers()
    history.replaceState(null, '', '/admin?tab=newsletters#current')
    mocks.signInWithGoogle.mockResolvedValue(undefined)
    render(<ProtectedRoute><div>Editor</div></ProtectedRoute>)
    act(() => { vi.advanceTimersByTime(8000) })
    expect(screen.queryByText('連線逾時')).toBeNull()
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: '重新連線並登入' })) })
    expect(mocks.signInWithGoogle).toHaveBeenCalledWith('/admin?tab=newsletters#current')
  })
  it('offers an explicit retry when the sign-in service is unavailable', async () => {
    vi.useFakeTimers()
    mocks.signInWithGoogle.mockRejectedValue(new Error('offline'))
    render(<ProtectedRoute><div>Editor</div></ProtectedRoute>)
    act(() => { vi.advanceTimersByTime(8000) })
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: '重新連線並登入' })) })
    expect(screen.getByRole('alert')).toHaveTextContent('目前無法連線')
    expect(screen.getByRole('button', { name: '重新連線並登入' })).toBeEnabled()
  })
})
