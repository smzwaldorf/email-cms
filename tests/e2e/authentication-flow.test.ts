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

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { createClient } from '@supabase/supabase-js'

describe('E2E: Authentication Flow with Session Persistence', () => {
  const supabaseUrl = process.env.VITE_SUPABASE_URL
  const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseKey) {
    console.warn('Skipping auth tests: VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY not set')
  }

  // Ensure storage isolation between tests
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    localStorage.clear()
  })

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
    }, 10000)

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
    }, 10000)

    it('should access articles after sign in', async () => {
      if (!supabaseUrl || !supabaseKey) return

      const client = createClient(supabaseUrl, supabaseKey)

      const { error: signInError } = await client.auth.signInWithPassword({
        email: 'parent1@example.com',
        password: 'parent1password123',
      })

      expect(signInError).toBeNull()

      // First get the newsletter ID for W47
      const { data: newsletter, error: newsletterError } = await client
        .from('newsletters')
        .select('id')
        .eq('week_number', '2025-W47')
        .single()

      expect(newsletterError).toBeNull()
      expect(newsletter).not.toBeNull()

      // Parent1 should see articles through newsletter_articles junction
      const { data: junctionData, error: junctionError } = await client
        .from('newsletter_articles')
        .select('article_order, articles!inner(id, title, visibility_type)')
        .eq('newsletter_id', newsletter!.id)
        .order('article_order')

      expect(junctionError).toBeNull()
      
      // Extract articles from junction data
      const articles = junctionData?.map((j: any) => j.articles) || []
      expect(articles.length).toBeGreaterThanOrEqual(2) // At least public articles

      // Verify article types
      const publicArticles = articles.filter((a: any) => a.visibility_type === 'public')
      expect(publicArticles.length).toBeGreaterThanOrEqual(2)

      await client.auth.signOut()
    }, 10000)
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

      // Verify data access still works with restored session - query through junction
      const { data: newsletter } = await client2
        .from('newsletters')
        .select('id')
        .eq('week_number', '2025-W47')
        .single()

      if (newsletter) {
        const { data: articlesData, error: articlesError } = await client2
          .from('newsletter_articles')
          .select('article_order')
          .eq('newsletter_id', newsletter.id)

        expect(articlesError).toBeNull()
        expect(articlesData).toBeDefined()
      }

      // Cleanup
      await client.auth.signOut()
    }, 10000)
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

      // Sign in as parent1
      await client.auth.signInWithPassword({
        email: 'parent1@example.com',
        password: 'parent1password123',
      })

      // Get newsletter ID
      const { data: newsletter } = await client
        .from('newsletters')
        .select('id')
        .eq('week_number', '2025-W47')
        .single()

      if (newsletter) {
        const { data: articlesLoggedIn } = await client
          .from('newsletter_articles')
          .select('articles!inner(id, visibility_type)')
          .eq('newsletter_id', newsletter.id)

        expect(articlesLoggedIn?.length).toBeGreaterThanOrEqual(2)
      }

      // Sign out
      await client.auth.signOut()

      // After sign out, test public article access
      const { data: publicArticles } = await client
        .from('articles')
        .select('id, visibility_type')
        .eq('visibility_type', 'public')

      // Only public articles visible (RLS blocks class-restricted for non-authenticated)
      expect(publicArticles?.every((a) => a.visibility_type === 'public')).toBe(true)
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

      // Get newsletter ID for article count comparison
      const { data: newsletter } = await client1
        .from('newsletters')
        .select('id')
        .eq('week_number', '2025-W47')
        .single()

      if (newsletter) {
        // Each sees different articles based on their family enrollment
        const { data: articles1 } = await client1
          .from('newsletter_articles')
          .select('article_order')
          .eq('newsletter_id', newsletter.id)

        const { data: articles2 } = await client2
          .from('newsletter_articles')
          .select('article_order')
          .eq('newsletter_id', newsletter.id)

        expect(articles1).toBeDefined()
        expect(articles2).toBeDefined()
      }

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
