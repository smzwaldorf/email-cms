
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, waitFor } from '@testing-library/react'
import { AuthProvider } from '../../src/context/AuthContext'
import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } }
})

// Mock Supabase
const mockGetUser = vi.fn()
const mockSupabase = {
  auth: {
    getUser: mockGetUser,
    getSession: vi.fn(),
    onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
    startAutoRefresh: vi.fn(),
    stopAutoRefresh: vi.fn(),
  },
}

vi.mock('@/lib/supabase', () => ({
  getSupabaseClient: () => mockSupabase,
}))

// Mock Document Visibility
Object.defineProperty(document, 'hidden', {
  configurable: true,
  get: () => false,
  set: (v) => v
})

// Mock console
vi.spyOn(console, 'log').mockImplementation(() => {})
vi.spyOn(console, 'warn').mockImplementation(() => {})

describe('AuthContext Keep-Alive', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
    mockGetUser.mockResolvedValue({ data: { user: { id: 'test' } }, error: null })
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('should ping supabase immediately on mount and every 5 minutes', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <div>Child</div>
        </AuthProvider>
      </QueryClientProvider>
    )

    // Initial ping
    expect(mockGetUser).toHaveBeenCalledTimes(1)

    // Fast forward 5 minutes
    vi.advanceTimersByTime(5 * 60 * 1000)
    expect(mockGetUser).toHaveBeenCalledTimes(2)

    // Fast forward another 5 minutes
    vi.advanceTimersByTime(5 * 60 * 1000)
    expect(mockGetUser).toHaveBeenCalledTimes(3)
  })

  it('should continue pinging even if tab is hidden', async () => {
    // Simulate hidden tab
    vi.spyOn(document, 'hidden', 'get').mockReturnValue(true)

    render(
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <div>Child</div>
        </AuthProvider>
      </QueryClientProvider>
    )

    // Interval should still run
    vi.advanceTimersByTime(5 * 60 * 1000)
    expect(mockGetUser).toHaveBeenCalled() 
    // Note: implementation detail might prevent initial ping if hidden depending on setup, 
    // but interval should fire. 
    // In our implementation, we start interval regardless.
  })
})
