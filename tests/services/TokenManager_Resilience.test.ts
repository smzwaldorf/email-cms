
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { TokenManager } from '../../src/services/tokenManager'

// Mock Supabase
const mockSupabase = {
  auth: {
    refreshSession: vi.fn(),
    getSession: vi.fn(),
  },
}

vi.mock('@/lib/supabase', () => ({
  getSupabaseClient: () => mockSupabase,
}))

describe('TokenManager Resilience', () => {
  let tokenManager: TokenManager

  beforeEach(() => {
    vi.clearAllMocks()
    tokenManager = new TokenManager()
    // Manually set an existing token
    tokenManager.setAccessToken('initial-token', 3600)
    
    // Silence console warnings for test
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should NOT clear tokens on refresh timeout', async () => {
    // Mock refreshSession to throw timeout error
    mockSupabase.auth.refreshSession.mockRejectedValue(new Error('Token refresh timeout'))

    // Trigger refresh
    const result = await tokenManager.refreshAccessToken()

    // Assertions
    expect(result).toBe(false)
    expect(await tokenManager.getAccessToken()).toBe('initial-token')
  })

  it('should clear tokens on Fatal auth error (Invalid Refresh Token)', async () => {
    // Mock refreshSession to throw fatal error
    mockSupabase.auth.refreshSession.mockRejectedValue(new Error('Invalid Refresh Token'))

    // Trigger refresh
    const result = await tokenManager.refreshAccessToken()

    // Assertions
    expect(result).toBe(false)
    expect(await tokenManager.getAccessToken()).toBeNull()
  })

  it('should clear tokens on Fatal auth error (refresh_token_not_found)', async () => {
    // Mock refreshSession to throw fatal error
    mockSupabase.auth.refreshSession.mockRejectedValue(new Error('refresh_token_not_found'))

    // Trigger refresh
    const result = await tokenManager.refreshAccessToken()

    // Assertions
    expect(result).toBe(false)
    expect(await tokenManager.getAccessToken()).toBeNull()
  })
})
