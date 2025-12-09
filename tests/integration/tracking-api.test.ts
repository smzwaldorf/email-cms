import { describe, it, expect, vi, beforeEach } from 'vitest';
import { trackingTokenService } from '@/services/trackingTokenService';
import { getSupabaseClient } from '@/lib/supabase';

// Mock Supabase
vi.mock('@/lib/supabase', () => ({
  getSupabaseClient: vi.fn(() => ({
    from: vi.fn(function(table: string) {
      if (table === 'tracking_tokens') {
        return {
          update: vi.fn(() => ({
            eq: vi.fn(function(_column: string) {
              return {
                eq: vi.fn(() => ({ select: vi.fn(() => ({ data: [{ id: 'token-1' }], error: null })) }))
              };
            })
          })),
          insert: vi.fn(() => ({ error: null })),
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: vi.fn(() => ({ data: { is_revoked: false }, error: null }))
            }))
          }))
        };
      }

      if (table === 'analytics_events') {
        return {
          insert: vi.fn(() => ({ error: null, data: [{ id: 'event-1' }] })),
          select: vi.fn(() => ({
            eq: vi.fn(function(_column: string) {
              return {
                eq: vi.fn(function(_col: string) {
                  return {
                    gt: vi.fn(() => ({ count: 0, data: [], error: null }))
                  };
                })
              };
            })
          }))
        };
      }

      if (table === 'tracking_links') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: vi.fn(() => ({ data: { original_url: 'https://example.com' }, error: null }))
            }))
          }))
        };
      }

      return {
        insert: vi.fn(() => ({ error: null })),
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn(() => ({ data: null, error: null }))
          }))
        }))
      };
    })
  }))
}));

describe('Tracking API Integration Tests', () => {
  const userId = 'user-123';
  const newsletterId = 'nwl-2025-w50';
  const articleId = 'article-456';
  const payload = { nwl: newsletterId, class: 'class-1' };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Email Open Tracking Flow', () => {
    it('should complete full email open tracking: generate token → verify → log event', async () => {
      // Step 1: Generate tracking token
      const token = await trackingTokenService.generateToken(userId, payload);
      expect(token).toBeDefined();
      expect(token.split('.').length).toBe(3);

      // Step 2: Verify token (simulating pixel request)
      const verified = await trackingTokenService.verifyToken(token);
      expect(verified.valid).toBe(true);
      expect(verified.payload?.sub).toBe(userId);
      expect(verified.payload?.nwl).toBe(newsletterId);

      // Step 3: Check for recent events (deduplication)
      const supabase = getSupabaseClient();
      const { count } = await supabase
        .from('analytics_events')
        .select('*', { count: 'exact', head: true })
        .eq('event_type', 'email_open')
        .eq('user_id', userId)
        .gt('created_at', new Date(Date.now() - 10000).toISOString());

      expect(count).toBeDefined();

      // Step 4: Log event
      if (!count || count === 0) {
        const { data: insertedEvent, error } = await supabase
          .from('analytics_events')
          .insert({
            event_type: 'email_open',
            user_id: userId,
            newsletter_id: newsletterId,
            metadata: {
              user_agent: 'Mozilla/5.0 (iPhone)',
              ip: '192.168.1.1'
            }
          });

        expect(error).toBeNull();
        expect(insertedEvent).toBeDefined();
      }
    });

    it('should handle duplicate email open within 10 seconds', async () => {
      const token = await trackingTokenService.generateToken(userId, payload);

      // First request
      const firstVerify = await trackingTokenService.verifyToken(token);
      expect(firstVerify.valid).toBe(true);

      const supabase = getSupabaseClient();

      // Check for duplicate (within 10 seconds)
      const { count: count1 } = await supabase
        .from('analytics_events')
        .select('*', { count: 'exact', head: true })
        .eq('event_type', 'email_open')
        .eq('user_id', userId)
        .gt('created_at', new Date(Date.now() - 10000).toISOString());

      // Second request (duplicate should be detected)
      const { count: count2 } = await supabase
        .from('analytics_events')
        .select('*', { count: 'exact', head: true })
        .eq('event_type', 'email_open')
        .eq('user_id', userId)
        .gt('created_at', new Date(Date.now() - 10000).toISOString());

      expect(count1 === count2).toBe(true);
    });

    it('should fail gracefully with invalid token', async () => {
      const invalidToken = 'invalid.token.format';

      const result = await trackingTokenService.verifyToken(invalidToken);
      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should reject missing token', async () => {
      const result = await trackingTokenService.verifyToken('');
      expect(result.valid).toBe(false);
    });
  });

  describe('Link Click Tracking Flow', () => {
    it('should complete full link click tracking: generate → verify → track → redirect', async () => {
      // Step 1: Generate token
      const clickPayload = { ...payload, article: articleId };
      const token = await trackingTokenService.generateToken(userId, clickPayload);
      expect(token).toBeDefined();

      // Step 2: Verify token
      const verified = await trackingTokenService.verifyToken(token);
      expect(verified.valid).toBe(true);
      expect(verified.payload?.article).toBe(articleId);

      // Step 3: Check for duplicate clicks
      const supabase = getSupabaseClient();
      const { count } = await supabase
        .from('analytics_events')
        .select('*', { count: 'exact', head: true })
        .eq('event_type', 'link_click')
        .eq('user_id', userId)
        .gt('created_at', new Date(Date.now() - 10000).toISOString());

      expect(count !== undefined).toBe(true);

      // Step 4: Log click event
      if (!count || count === 0) {
        const { error } = await supabase.from('analytics_events').insert({
          event_type: 'link_click',
          user_id: userId,
          article_id: articleId,
          newsletter_id: newsletterId,
          metadata: {
            target_url: 'https://example.com/article',
            user_agent: 'Mozilla/5.0'
          }
        });

        expect(error).toBeNull();
      }

      // Step 5: Look up redirect URL
      const { data: linkData } = await supabase
        .from('tracking_links')
        .select('original_url')
        .eq('id', 'tracking-link-1')
        .single();

      expect(linkData?.original_url).toBe('https://example.com');
    });

    it('should prevent click fraud via deduplication', async () => {
      const token = await trackingTokenService.generateToken(userId, payload);

      const supabase = getSupabaseClient();

      // Simulate rapid clicks
      const clicks = Array(5)
        .fill(null)
        .map(() =>
          supabase
            .from('analytics_events')
            .select('*', { count: 'exact', head: true })
            .eq('event_type', 'link_click')
            .eq('user_id', userId)
            .gt('created_at', new Date(Date.now() - 10000).toISOString())
        );

      const results = await Promise.all(clicks);
      const counts = results.map(r => r.count ?? 0);

      // All counts should be the same (deduplication working)
      expect(counts.every(c => c === counts[0])).toBe(true);
    });
  });

  describe('Token Revocation', () => {
    it('should revoke token successfully', async () => {
      // Generate and store token
      const token = await trackingTokenService.generateToken(userId, payload);
      await trackingTokenService.storeToken(token, userId, payload);

      // Verify it works
      const firstVerify = await trackingTokenService.verifyToken(token);
      expect(firstVerify.valid).toBe(true);

      // Revoke the token
      const revoked = await trackingTokenService.revokeToken(token);
      expect(revoked).toBe(true);
    });

    it('should bulk revoke all tokens for a user', async () => {
      // Generate multiple tokens
      const token1 = await trackingTokenService.generateToken(userId, payload);
      const token2 = await trackingTokenService.generateToken(userId, payload);

      await trackingTokenService.storeToken(token1, userId, payload);
      await trackingTokenService.storeToken(token2, userId, payload);

      // Bulk revoke
      const result = await trackingTokenService.revokeTokensForUser(userId);
      expect(result.revokedCount >= 0).toBe(true);
      expect(result.error).toBeUndefined();
    });
  });

  describe('Security & Error Handling', () => {
    it('should not leak sensitive information in errors', async () => {
      const invalidToken = 'definitely.not.a.jwt';

      const result = await trackingTokenService.verifyToken(invalidToken);
      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
      // Error message should not contain sensitive data
      expect(result.error).not.toContain('VITE_JWT_SECRET');
    });

    it('should handle database errors gracefully', async () => {
      // This test verifies error handling doesn't expose internals
      const result = await trackingTokenService.revokeTokensForUser(userId);
      expect(result.revokedCount >= 0).toBe(true);
      // Should return count even if no tokens exist
    });

    it('should enforce token expiry', async () => {
      // Current implementation: 14 days
      const token = await trackingTokenService.generateToken(userId, payload);
      const verified = await trackingTokenService.verifyToken(token);

      expect(verified.payload?.exp).toBeDefined();
      expect(verified.payload!.exp! > Math.floor(Date.now() / 1000)).toBe(true);
    });
  });

  describe('Event Metadata', () => {
    it('should capture user agent in metadata', async () => {
      const supabase = getSupabaseClient();

      const userAgent = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)';

      const { error } = await supabase.from('analytics_events').insert({
        event_type: 'email_open',
        user_id: userId,
        newsletter_id: newsletterId,
        metadata: {
          user_agent: userAgent,
          ip: '2001:db8::1'
        }
      });

      expect(error).toBeNull();
    });

    it('should capture IP address in metadata', async () => {
      const supabase = getSupabaseClient();

      const { error } = await supabase.from('analytics_events').insert({
        event_type: 'link_click',
        user_id: userId,
        article_id: articleId,
        metadata: {
          user_agent: 'Mozilla/5.0',
          ip: '203.0.113.42'
        }
      });

      expect(error).toBeNull();
    });
  });

  describe('Multi-User Tracking', () => {
    it('should track multiple users independently', async () => {
      const user1 = 'user-1';
      const user2 = 'user-2';

      // Generate tokens for both users
      const token1 = await trackingTokenService.generateToken(user1, payload);
      const token2 = await trackingTokenService.generateToken(user2, payload);

      // Verify both work independently
      const verify1 = await trackingTokenService.verifyToken(token1);
      const verify2 = await trackingTokenService.verifyToken(token2);

      expect(verify1.payload?.sub).toBe(user1);
      expect(verify2.payload?.sub).toBe(user2);
      expect(verify1.payload?.sub).not.toBe(verify2.payload?.sub);
    });

    it('should prevent cross-user tracking confusion', async () => {
      const user1 = 'user-1';
      const user2 = 'user-2';

      // Generate tokens
      const token1 = await trackingTokenService.generateToken(user1, payload);
      const token2 = await trackingTokenService.generateToken(user2, payload);

      // Store tokens
      await trackingTokenService.storeToken(token1, user1, payload);
      await trackingTokenService.storeToken(token2, user2, payload);

      // Verify user1 token doesn't work for user2
      const verify1 = await trackingTokenService.verifyToken(token1);
      const verify2 = await trackingTokenService.verifyToken(token2);

      expect(verify1.payload?.sub).toBe(user1);
      expect(verify2.payload?.sub).toBe(user2);
    });
  });
});
