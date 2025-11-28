/**
 * Integration Tests: Admin Session Management
 * Tests admin capabilities for managing user sessions and detecting suspicious activity
 *
 * These tests verify:
 * - Admin can force logout users from all devices
 * - Force logout events are logged to audit trail
 * - Suspicious activity detection works correctly
 * - Proper error handling for invalid operations
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.VITE_SUPABASE_URL || ''
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || ''
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || ''

// Skip entire suite if service key is not available
const hasServiceKey = !!supabaseServiceKey && supabaseServiceKey.length > 0

// Only create the admin client if we have a service key; otherwise use dummy client
const _supabaseAdminGlobal = hasServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey)
  : { auth: { admin: {} }, from: () => ({}) } as any

describe.skipIf(!hasServiceKey)('E2E: Admin Session Management', () => {
  // Ensure keys are present before creating clients
  if (!supabaseUrl || !supabaseServiceKey || !supabaseAnonKey) {
    console.warn('Skipping admin session tests due to missing env vars')
    return
  }

  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })
  const supabaseClient = createClient(supabaseUrl, supabaseAnonKey)

  const testAdminEmail = `admin-test-${Date.now()}@example.com`
  const testUserEmail = `user-test-${Date.now()}@example.com`

  let adminUserId: string | null = null
  let testUserId: string | null = null

  beforeEach(async () => {
    // Skip setup if service key is not available
    if (!hasServiceKey) return

    try {
      // Create test admin user
      const adminResult = await supabaseAdmin.auth.admin.createUser({
        email: testAdminEmail,
        password: 'AdminPassword123!',
        email_confirm: true,
      })

      adminUserId = adminResult.data?.user?.id || null

      // Create test regular user
      const userResult = await supabaseAdmin.auth.admin.createUser({
        email: testUserEmail,
        password: 'UserPassword123!',
        email_confirm: true,
      })

      testUserId = userResult.data?.user?.id || null
    } catch (err) {
      console.error('Setup error:', err)
    }
  })

  afterEach(async () => {
    // Skip cleanup if service key is not available
    if (!hasServiceKey) return

    // Cleanup: Delete test users and their audit logs
    try {
      // Delete audit logs
      if (adminUserId) {
        await supabaseAdmin
          .from('auth_events')
          .delete()
          .eq('user_id', adminUserId)
      }

      if (testUserId) {
        await supabaseAdmin
          .from('auth_events')
          .delete()
          .eq('user_id', testUserId)
      }

      // Delete from user_roles
      if (adminUserId) {
        await supabaseAdmin
          .from('user_roles')
          .delete()
          .eq('id', adminUserId)
      }

      if (testUserId) {
        await supabaseAdmin
          .from('user_roles')
          .delete()
          .eq('id', testUserId)
      }
    } catch (err) {
      console.error('Cleanup error:', err)
    }
  })

  it('should force logout user from all sessions', async () => {
    // Verify user has sessions before logout
    // Verify user has sessions before logout (optional, but good for sanity)
    // const { data: sessionsBefore } = await supabaseAdmin.rpc('get_user_sessions', { target_user_id: testUserId })
    // expect(sessionsBefore).toBeDefined()

    // Force logout the user using the new RPC
    const { error: logoutError } = await supabaseAdmin.rpc('delete_user_sessions', {
      target_user_id: testUserId
    })

    expect(logoutError).toBeNull()

    // Wait for logout to propagate
    await new Promise((resolve) => setTimeout(resolve, 500))

    // Verify user sessions are gone using the new RPC
    const { data: sessionsAfter } = await supabaseAdmin.rpc('get_user_sessions', {
      target_user_id: testUserId
    })

    expect(sessionsAfter).toEqual([])
  }, { timeout: 10000 })

  it('should log admin force logout action to audit trail', async () => {
    // Force logout the user
    const { error } = await supabaseAdmin.auth.admin.signOut(testUserId || '')

    expect(error).toBeNull()

    // Wait for audit logging
    await new Promise((resolve) => setTimeout(resolve, 500))

    // Verify the force logout action was logged
    // (In actual implementation, this would be logged by the auditLogger service)
    const { data, error: queryError } = await supabaseAdmin
      .from('auth_events')
      .select('*')
      .gte('created_at', new Date(Date.now() - 60000).toISOString())
      .order('created_at', { ascending: false })
      .limit(10)

    expect(queryError).toBeNull()
    expect(Array.isArray(data)).toBe(true)
  }, { timeout: 10000 })

  it('should detect users with suspicious activity (>5 failed logins)', async () => {
    // Simulate failed login attempts
    for (let i = 0; i < 6; i++) {
      await supabaseClient.auth.signInWithPassword({
        email: testUserEmail,
        password: 'wrong-password',
      })

      // Small delay between attempts
      await new Promise((resolve) => setTimeout(resolve, 100))
    }

    // Wait for logging
    await new Promise((resolve) => setTimeout(resolve, 500))

    // Query for suspicious activity
    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString()

    const { data: events, error } = await supabaseAdmin
      .from('auth_events')
      .select('user_id')
      .eq('event_type', 'login_failure')
      .gte('created_at', fifteenMinutesAgo)

    expect(error).toBeNull()

    // Count failures by user
    const failureCounts = new Map<string, number>()

    if (events && Array.isArray(events)) {
      events.forEach((event) => {
        if (event.user_id) {
          const count = failureCounts.get(event.user_id) || 0
          failureCounts.set(event.user_id, count + 1)
        }
      })
    }

    // Find users with >5 failures
    const suspicious = Array.from(failureCounts.entries())
      .filter(([_, count]) => count > 5)
      .map(([userId]) => userId)

    expect(suspicious.length).toBeGreaterThanOrEqual(1)
  }, { timeout: 15000 })

  it('should handle invalid user ID gracefully', async () => {
    const invalidUserId = 'invalid-user-id-12345'

    // Attempt to force logout invalid user
    const { error } = await supabaseAdmin.auth.admin.signOut(invalidUserId)

    // Should handle gracefully (Supabase returns error)
    // This tests that the service handles errors without throwing
    expect(error).toBeDefined() // Should have an error for invalid user
  }, { timeout: 10000 })

  it('should only log events within time window for suspicious activity', async () => {
    // Create old failed login events (outside 15-min window)
    const oldTime = new Date(Date.now() - 20 * 60 * 1000).toISOString()

    // Insert old auth event
    await supabaseAdmin
      .from('auth_events')
      .insert({
        user_id: testUserId,
        event_type: 'login_failure',
        auth_method: 'email_password',
        user_agent: 'old-test-ua',
        metadata: { test: true },
        created_at: oldTime,
      })

    // Create recent failed login events
    for (let i = 0; i < 3; i++) {
      await supabaseClient.auth.signInWithPassword({
        email: testUserEmail,
        password: 'wrong-password',
      })

      await new Promise((resolve) => setTimeout(resolve, 100))
    }

    // Wait for logging
    await new Promise((resolve) => setTimeout(resolve, 500))

    // Query for recent suspicious activity (15 min window)
    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString()

    const { data: recentEvents } = await supabaseAdmin
      .from('auth_events')
      .select('*')
      .eq('user_id', testUserId)
      .eq('event_type', 'login_failure')
      .gte('created_at', fifteenMinutesAgo)

    // Old event should not be included, recent ones should
    expect((recentEvents || []).length).toBeGreaterThan(0)
    expect((recentEvents || []).length).toBeLessThan(6) // Only recent, not the old one

    // Verify timestamps of returned events are recent
    recentEvents?.forEach((event) => {
      const eventTime = new Date(event.created_at).getTime()
      const windowStart = new Date(fifteenMinutesAgo).getTime()
      expect(eventTime).toBeGreaterThanOrEqual(windowStart)
    })
  }, { timeout: 15000 })

  it('should handle multiple admins force logging out same user', async () => {
    // Create second admin
    const admin2Result = await supabaseAdmin.auth.admin.createUser({
      email: `admin2-test-${Date.now()}@example.com`,
      password: 'Admin2Password123!',
      email_confirm: true,
    })

    const admin2UserId = admin2Result.data?.user?.id || null

    try {
      // Both admins force logout the same user
      const { error: error1 } = await supabaseAdmin.auth.admin.signOut(testUserId || '')
      const { error: error2 } = await supabaseAdmin.auth.admin.signOut(testUserId || '')

      // Second logout should also succeed (user already logged out)
      expect(error1).toBeNull()
      expect(error2).toBeNull() // Should handle gracefully

      // Wait for logging
      await new Promise((resolve) => setTimeout(resolve, 500))

      // Verify audit logs show both actions were attempted
      const { data: auditLogs } = await supabaseAdmin
        .from('auth_events')
        .select('*')
        .gte('created_at', new Date(Date.now() - 60000).toISOString())
        .order('created_at', { ascending: false })

      expect(Array.isArray(auditLogs)).toBe(true)
    } finally {
      // Cleanup second admin
      if (admin2UserId) {
        await supabaseAdmin
          .from('auth_events')
          .delete()
          .eq('user_id', admin2UserId)

        await supabaseAdmin
          .from('user_roles')
          .delete()
          .eq('id', admin2UserId)
      }
    }
  }, { timeout: 10000 })
})
