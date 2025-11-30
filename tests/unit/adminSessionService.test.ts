/**
 * Unit Tests: Admin Session Service
 * Tests the force logout functionality to ensure events are logged correctly
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { adminSessionService } from '@/services/adminSessionService'
import { auditLogger } from '@/services/auditLogger'
import { getSupabaseServiceClient } from '@/lib/supabase'

// Mock the dependencies
vi.mock('@/lib/supabase', () => ({
  getSupabaseServiceClient: vi.fn(),
}))

vi.mock('@/services/auditLogger', () => ({
  auditLogger: {
    logAuthEvent: vi.fn(),
  },
}))

describe('AdminSessionService', () => {
  let mockSupabaseAdmin: any

  beforeEach(() => {
    vi.clearAllMocks()

    mockSupabaseAdmin = {
      rpc: vi.fn(),
    }

    ;(getSupabaseServiceClient as any).mockReturnValue(mockSupabaseAdmin)
  })

  describe('forceLogoutUser', () => {
    it('should force logout user and log event to TARGET user', async () => {
      const adminUserId = 'admin-id-123'
      const targetUserId = 'user-id-456'

      // Mock successful RPC call
      mockSupabaseAdmin.rpc.mockResolvedValueOnce({
        data: {},
        error: null,
      })

      const result = await adminSessionService.forceLogoutUser(targetUserId, adminUserId)

      expect(result).toBe(true)

      // Verify RPC was called
      expect(mockSupabaseAdmin.rpc).toHaveBeenCalledWith('delete_user_sessions', {
        target_user_id: targetUserId,
      })

      // IMPORTANT: Verify logout event is logged to the TARGET user, not the admin
      // This ensures the user receives the realtime notification and logs themselves out
      expect(auditLogger.logAuthEvent).toHaveBeenCalledWith({
        userId: targetUserId,
        eventType: 'logout',
        metadata: {
          action: 'admin_force_logout',
          adminUserId: adminUserId,
        },
      })
    })

    it('should return false if RPC fails', async () => {
      const adminUserId = 'admin-id-123'
      const targetUserId = 'user-id-456'

      // Mock failed RPC call
      mockSupabaseAdmin.rpc.mockResolvedValueOnce({
        data: null,
        error: { message: 'RPC error' },
      })

      const result = await adminSessionService.forceLogoutUser(targetUserId, adminUserId)

      expect(result).toBe(false)

      // Verify audit logger was NOT called
      expect(auditLogger.logAuthEvent).not.toHaveBeenCalled()
    })

    it('should handle exceptions gracefully', async () => {
      const adminUserId = 'admin-id-123'
      const targetUserId = 'user-id-456'

      // Mock exception
      mockSupabaseAdmin.rpc.mockRejectedValueOnce(new Error('Connection error'))

      const result = await adminSessionService.forceLogoutUser(targetUserId, adminUserId)

      expect(result).toBe(false)

      // Verify audit logger was NOT called
      expect(auditLogger.logAuthEvent).not.toHaveBeenCalled()
    })
  })

  describe('getUserSessions', () => {
    it('should fetch user sessions', async () => {
      const userId = 'user-id-123'
      const mockSessions = [
        { id: 'session-1', user_id: userId, created_at: '2024-01-01', expires_at: null },
      ]

      mockSupabaseAdmin.rpc.mockResolvedValueOnce({
        data: mockSessions,
        error: null,
      })

      const result = await adminSessionService.getUserSessions(userId)

      expect(result).toEqual(mockSessions)
      expect(mockSupabaseAdmin.rpc).toHaveBeenCalledWith('get_user_sessions', {
        target_user_id: userId,
      })
    })

    it('should return empty array on error', async () => {
      const userId = 'user-id-123'

      mockSupabaseAdmin.rpc.mockResolvedValueOnce({
        data: null,
        error: { message: 'RPC error' },
      })

      const result = await adminSessionService.getUserSessions(userId)

      expect(result).toEqual([])
    })
  })

  describe('detectSuspiciousActivity', () => {
    it('should detect users with suspicious activity', async () => {
      const mockEvents = [
        { user_id: 'user-1' },
        { user_id: 'user-1' },
        { user_id: 'user-1' },
        { user_id: 'user-1' },
        { user_id: 'user-1' },
        { user_id: 'user-1' }, // 6 failures
        { user_id: 'user-2' },
        { user_id: 'user-2' },
      ]

      const mockSelectChain = {
        eq: vi.fn().mockReturnThis(),
        gte: vi.fn().mockResolvedValueOnce({
          data: mockEvents,
          error: null,
        }),
      }

      mockSupabaseAdmin.from = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue(mockSelectChain),
      })

      const result = await adminSessionService.detectSuspiciousActivity()

      // user-1 has 6 failures (>5), so should be in suspicious list
      expect(result).toContainEqual({
        userId: 'user-1',
        failureCount: 6,
      })

      // user-2 has 2 failures (<=5), so should not be in suspicious list
      expect(result).not.toContainEqual({
        userId: 'user-2',
        failureCount: 2,
      })
    })

    it('should return empty array on error', async () => {
      const mockSelectChain = {
        eq: vi.fn().mockReturnThis(),
        gte: vi.fn().mockResolvedValueOnce({
          data: null,
          error: { message: 'Query error' },
        }),
      }

      mockSupabaseAdmin.from = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue(mockSelectChain),
      })

      const result = await adminSessionService.detectSuspiciousActivity()

      expect(result).toEqual([])
    })
  })
})
