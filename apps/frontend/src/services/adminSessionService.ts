/**
 * Admin Session Management Service
 * Handles admin operations for user session management and suspicious activity detection.
 *
 * Features:
 * - Query active sessions for a user (Supabase native auth.sessions)
 * - Force logout users from all devices (invalidate all sessions)
 * - Detect suspicious activity (>5 failed logins in 15 minutes)
 * - Log all admin actions to audit trail
 */

import { getSupabaseClient } from '@/lib/supabase'
import { auditLogger } from './auditLogger'

/**
 * User session information from Supabase auth.sessions
 */
export interface UserSession {
  id: string
  user_id: string
  created_at: string
  expires_at: string | null
}

/**
 * Suspicious activity record
 */
export interface SuspiciousActivity {
  userId: string
  failureCount: number
}

/**
 * Admin Session Management Service
 */
class AdminSessionService {
  /**
   * Get all active sessions for a user
   *
   * @param userId - The user ID to query sessions for
   * @returns Array of active sessions, empty array on error
   * @remarks
   * Uses secure RPC 'get_user_sessions' to query auth.sessions
   * Requires admin role
   */
  async getUserSessions(userId: string): Promise<UserSession[]> {
    try {
      const supabaseAdmin = getSupabaseClient()

      const { data, error } = await supabaseAdmin.rpc('get_user_sessions', {
        target_user_id: userId
      })

      if (error) {
        console.error('Failed to fetch sessions:', error.message)
        return []
      }

      return (data as UserSession[]) || []
    } catch (err) {
      console.error('Get sessions exception:', err)
      return []
    }
  }

  /**
   * Force logout a user from all devices
   *
   * @param userId - The user ID to force logout
   * @param adminUserId - The admin performing this action (for audit logging)
   * @returns true if successful, false otherwise
   * @remarks
   * - Uses secure RPC 'delete_user_sessions' to remove all sessions
   * - Logs the logout event for the TARGET user (so they receive the notification)
   * - Also logs admin action for audit trail
   * - Non-blocking: Will not throw errors
   */
  async forceLogoutUser(userId: string, adminUserId: string): Promise<boolean> {
    try {
      const supabaseAdmin = getSupabaseClient()

      // Sign out all sessions for this user using RPC
      const { error } = await supabaseAdmin.rpc('delete_user_sessions', {
        target_user_id: userId
      })

      if (error) {
        console.error('Failed to force logout:', error.message)
        return false
      }

      // Log logout event for the TARGET user (so they receive the realtime notification)
      await auditLogger.logAuthEvent({
        userId: userId,
        eventType: 'logout',
        metadata: {
          action: 'admin_force_logout',
          adminUserId: adminUserId,
        },
      })

      console.log(`✅ Admin ${adminUserId} force-logged out user ${userId}`)
      return true
    } catch (err) {
      console.error('Force logout exception:', err)
      return false
    }
  }

  /**
   * Detect suspicious activity - users with multiple failed login attempts
   *
   * @returns Array of users with suspicious activity (>5 failures in 15 min)
   * @remarks
   * - Queries auth_events table for login_failure events
   * - Looks at last 15 minutes
   * - Returns users with more than 5 failures
   * - Used by AdminDashboard to display warning alerts
   */
  async detectSuspiciousActivity(): Promise<SuspiciousActivity[]> {
    try {
      const supabaseAdmin = getSupabaseClient()

      // Query for failed logins in the last 15 minutes
      const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString()

      const { data, error } = await supabaseAdmin
        .from('auth_events')
        .select('user_id')
        .eq('event_type', 'login_failure')
        .gte('created_at', fifteenMinutesAgo)

      if (error) {
        console.error('Failed to detect suspicious activity:', error.message)
        return []
      }

      // Count failures by user
      const failureCounts = new Map<string, number>()

      if (data && Array.isArray(data)) {
        data.forEach((event) => {
          if (event.user_id) {
            const count = failureCounts.get(event.user_id) || 0
            failureCounts.set(event.user_id, count + 1)
          }
        })
      }

      // Return users with >5 failures
      const suspicious: SuspiciousActivity[] = Array.from(failureCounts.entries())
        .filter(([_, count]) => count > 5)
        .map(([userId, failureCount]) => ({ userId, failureCount }))

      if (suspicious.length > 0) {
        console.warn(`⚠️ Detected ${suspicious.length} user(s) with suspicious activity`)
      }

      return suspicious
    } catch (err) {
      console.error('Detect suspicious activity exception:', err)
      return []
    }
  }
}

/**
 * Singleton instance of the admin session service
 */
export const adminSessionService = new AdminSessionService()
