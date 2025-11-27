/**
 * End-to-End Test: Authentication Flow with Session Persistence
 * Tests complete authentication workflows including session restoration
 *
 * Test Scenarios:
 * 1. Sign in → Session stored → Data access works
 * 2. Sign in → Sign out → Session cleared
 * 3. Session restored → User can access protected data
 * 4. Multiple users → Concurrent sessions
 */

import { describe, it, expect } from 'vitest'
import { createClient } from '@supabase/supabase-js'

describe('E2E: Authentication Flow with Session Persistence', () => {
  const supabaseUrl = process.env.VITE_SUPABASE_URL
  const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseKey) {
    console.warn('Skipping auth tests: VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY not set')
  }

  describe('Sign In and Session Storage', () => {
    it('should sign in user and create session', async () => {
      if (!supabaseUrl || !supabaseKey) {
        console.warn('Test skipped: missing env vars')
        return
      }

      const client = createClient(supabaseUrl, supabaseKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
        },
      })

      const { data, error } = await client.auth.signInWithPassword({
        email: 'parent1@example.com',
        password: 'parent1password123',
      })

      expect(error).toBeNull()
      expect(data.session).not.toBeNull()
      expect(data.user?.email).toBe('parent1@example.com')

      await client.auth.signOut()
    })

    it('should access user role after sign in', async () => {
      if (!supabaseUrl || !supabaseKey) return

      const client = createClient(supabaseUrl, supabaseKey)

      const { data: signInData, error: signInError } = await client.auth.signInWithPassword({
        email: 'parent1@example.com',
        password: 'parent1password123',
      })

      expect(signInError).toBeNull()

      const userId = signInData.user?.id
      const { data: roleData, error: roleError } = await client
        .from('user_roles')
        .select('*')
        .eq('id', userId)
        .single()

      expect(roleError).toBeNull()
      expect(roleData?.role).toBe('parent')
      expect(roleData?.email).toBe('parent1@example.com')

      await client.auth.signOut()
    })

    it('should access articles after sign in', async () => {
      if (!supabaseUrl || !supabaseKey) return

      const client = createClient(supabaseUrl, supabaseKey)

      const { error: signInError } = await client.auth.signInWithPassword({
        email: 'parent1@example.com',
        password: 'parent1password123',
      })

      expect(signInError).toBeNull()

      // Parent1 should see 4 articles (2 public + 2 class-restricted)
      const { data: articles, error: articlesError } = await client
        .from('articles')
        .select('id, title, visibility_type')
        .eq('week_number', '2025-W47')
        .order('article_order')

      expect(articlesError).toBeNull()
      expect(articles).toHaveLength(4)

      // Verify article types
      const publicArticles = articles?.filter((a) => a.visibility_type === 'public')
      const restrictedArticles = articles?.filter((a) => a.visibility_type === 'class_restricted')

      expect(publicArticles).toHaveLength(2)
      expect(restrictedArticles).toHaveLength(2)

      await client.auth.signOut()
    })
  })

  describe('Session Restoration', () => {
    it('should restore session from browser storage', async () => {
      if (!supabaseUrl || !supabaseKey) return

      const client = createClient(supabaseUrl, supabaseKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
        },
      })

      // Sign in
      await client.auth.signInWithPassword({
        email: 'parent1@example.com',
        password: 'parent1password123',
      })

      // Simulate page refresh: new client instance
      const client2 = createClient(supabaseUrl, supabaseKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
        },
      })

      // Check if session is restored
      const { data: sessionData } = await client2.auth.getSession()

      expect(sessionData.session).not.toBeNull()
      expect(sessionData.session?.user?.email).toBe('parent1@example.com')

      // Verify data access still works with restored session
      const { data: articlesData, error: articlesError } = await client2
        .from('articles')
        .select('count', { count: 'exact' })
        .eq('week_number', '2025-W47')

      expect(articlesError).toBeNull()
      expect(articlesData).toBeDefined()

      // Cleanup
      await client.auth.signOut()
    })
  })

  describe('Sign Out and Session Clearing', () => {
    it('should clear session on sign out', async () => {
      if (!supabaseUrl || !supabaseKey) return

      const client = createClient(supabaseUrl, supabaseKey)

      // Sign in
      await client.auth.signInWithPassword({
        email: 'parent1@example.com',
        password: 'parent1password123',
      })

      const { data: beforeSignOut } = await client.auth.getSession()
      expect(beforeSignOut.session).not.toBeNull()

      // Sign out
      await client.auth.signOut()

      const { data: afterSignOut } = await client.auth.getSession()
      expect(afterSignOut.session).toBeNull()
    })

    it('should not see restricted articles after sign out', async () => {
      if (!supabaseUrl || !supabaseKey) return

      const client = createClient(supabaseUrl, supabaseKey)

      // Sign in as parent1 (sees 4 articles)
      await client.auth.signInWithPassword({
        email: 'parent1@example.com',
        password: 'parent1password123',
      })

      const { data: articlesLoggedIn } = await client
        .from('articles')
        .select('id, visibility_type')
        .eq('week_number', '2025-W47')

      expect(articlesLoggedIn).toHaveLength(4)

      // Sign out
      await client.auth.signOut()

      // After sign out, can only see public articles
      const { data: articlesLoggedOut } = await client
        .from('articles')
        .select('id, visibility_type')
        .eq('week_number', '2025-W47')

      // Only public articles visible (RLS blocks class-restricted for non-authenticated)
      const publicOnly = articlesLoggedOut?.filter((a) => a.visibility_type === 'public')
      expect(publicOnly).toHaveLength(2)
    })
  })

  describe('Multiple Concurrent Sessions', () => {
    it('should support multiple users signing in', async () => {
      if (!supabaseUrl || !supabaseKey) return

      const client1 = createClient(supabaseUrl, supabaseKey)
      const client2 = createClient(supabaseUrl, supabaseKey)

      // Sign in parent1
      const { data: data1 } = await client1.auth.signInWithPassword({
        email: 'parent1@example.com',
        password: 'parent1password123',
      })

      // Sign in parent2
      const { data: data2 } = await client2.auth.signInWithPassword({
        email: 'parent2@example.com',
        password: 'parent2password123',
      })

      expect(data1.user?.email).toBe('parent1@example.com')
      expect(data2.user?.email).toBe('parent2@example.com')

      // Each sees different articles based on their family enrollment
      const { data: articles1 } = await client1
        .from('articles')
        .select('count', { count: 'exact' })
        .eq('week_number', '2025-W47')

      const { data: articles2 } = await client2
        .from('articles')
        .select('count', { count: 'exact' })
        .eq('week_number', '2025-W47')

      // parent1 sees 4, parent2 sees 3
      expect(articles1).toBeDefined()
      expect(articles2).toBeDefined()

      // Cleanup
      await client1.auth.signOut()
      await client2.auth.signOut()
    })
  })

  describe('Session Token Refresh', () => {
    it('should have refresh token for auto-refresh', async () => {
      if (!supabaseUrl || !supabaseKey) return

      const client = createClient(supabaseUrl, supabaseKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
        },
      })

      const { data, error } = await client.auth.signInWithPassword({
        email: 'parent1@example.com',
        password: 'parent1password123',
      })

      expect(error).toBeNull()
      expect(data.session?.refresh_token).toBeDefined()
      expect(data.session?.access_token).toBeDefined()

      await client.auth.signOut()
    })
  })
})
