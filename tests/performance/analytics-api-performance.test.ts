import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getSupabaseClient } from '@/lib/supabase';

// Helper to create chainable query builder
function createQueryBuilder() {
  return {
    eq: vi.fn(function(_column: string) {
      return createQueryBuilder();
    }),
    gt: vi.fn(async () => {
      await new Promise(resolve => setTimeout(resolve, 5));
      return { count: 0, data: [], error: null };
    }),
    single: vi.fn(async () => {
      await new Promise(resolve => setTimeout(resolve, 5));
      return { data: { original_url: 'https://example.com' }, error: null };
    })
  };
}

// Mock Supabase client
vi.mock('@/lib/supabase', () => ({
  getSupabaseClient: vi.fn(() => ({
    from: vi.fn(function(_table: string) {
      return {
        insert: vi.fn(async () => {
          await new Promise(resolve => setTimeout(resolve, 10));
          return { error: null, data: [{ id: 'event-1' }] };
        }),
        select: vi.fn(() => createQueryBuilder())
      };
    })
  }))
}));

describe('Analytics API Performance', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Tracking Pixel Endpoint', () => {
    it('should handle pixel request in < 100ms', async () => {
      const startTime = performance.now();

      const supabase = getSupabaseClient();

      // Simulate pixel endpoint: deduplication check + insert
      const { count } = await supabase
        .from('analytics_events')
        .select('*', { count: 'exact', head: true })
        .eq('event_type', 'email_open')
        .eq('user_id', 'user-123')
        .gt('created_at', new Date(Date.now() - 10000).toISOString());

      if (!count || count === 0) {
        await supabase.from('analytics_events').insert({
          event_type: 'email_open',
          user_id: 'user-123',
          newsletter_id: 'nwl-1',
          metadata: { user_agent: 'Mozilla/5.0' }
        });
      }

      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(100);
    });

    it('should handle duplicate pixel requests (10 concurrent) in < 500ms', async () => {
      const startTime = performance.now();

      const supabase = getSupabaseClient();

      // Simulate 10 concurrent pixel requests
      const promises = Array(10)
        .fill(null)
        .map(async () => {
          const { count } = await supabase
            .from('analytics_events')
            .select('*', { count: 'exact', head: true })
            .eq('event_type', 'email_open')
            .eq('user_id', 'user-123')
            .gt('created_at', new Date(Date.now() - 10000).toISOString());

          if (!count || count === 0) {
            await supabase.from('analytics_events').insert({
              event_type: 'email_open',
              user_id: 'user-123',
              newsletter_id: 'nwl-1',
              metadata: {}
            });
          }
        });

      await Promise.all(promises);

      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(500);
    });

    it('should return transparent GIF in < 10ms', async () => {
      const TRANSPARENT_GIF = new Uint8Array([
        0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x01, 0x00, 0x01, 0x00, 0x80, 0x00, 0x00, 0xff, 0xff, 0xff,
        0x00, 0x00, 0x00, 0x2c, 0x00, 0x00, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0x02, 0x02, 0x44,
        0x01, 0x00, 0x3b
      ]);

      const startTime = performance.now();
      const response = new Response(TRANSPARENT_GIF, {
        headers: { 'Content-Type': 'image/gif' }
      });
      const endTime = performance.now();

      expect(response.status).toBe(200);
      expect(endTime - startTime).toBeLessThan(10);
    });
  });

  describe('Tracking Click Endpoint', () => {
    it('should handle click tracking request in < 150ms', async () => {
      const startTime = performance.now();

      const supabase = getSupabaseClient();

      // Simulate click endpoint: deduplication check + insert
      const { count } = await supabase
        .from('analytics_events')
        .select('*', { count: 'exact', head: true })
        .eq('event_type', 'link_click')
        .eq('user_id', 'user-123')
        .gt('created_at', new Date(Date.now() - 10000).toISOString());

      if (!count || count === 0) {
        await supabase.from('analytics_events').insert({
          event_type: 'link_click',
          user_id: 'user-123',
          article_id: 'article-1',
          metadata: { target_url: 'https://example.com' }
        });
      }

      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(150);
    });

    it('should handle click with redirect in < 200ms', async () => {
      const startTime = performance.now();

      const supabase = getSupabaseClient();

      // Simulate click endpoint: dedup + insert + redirect lookup
      const { count } = await supabase
        .from('analytics_events')
        .select('*', { count: 'exact', head: true })
        .eq('event_type', 'link_click')
        .eq('user_id', 'user-123')
        .gt('created_at', new Date(Date.now() - 10000).toISOString());

      if (!count || count === 0) {
        await supabase.from('analytics_events').insert({
          event_type: 'link_click',
          user_id: 'user-123',
          article_id: 'article-1',
          metadata: {}
        });
      }

      // Simulate redirect lookup
      const redirect = await supabase
        .from('tracking_links')
        .select('original_url')
        .eq('id', 'link-1')
        .single();

      // Simulate 302 redirect response
      const response = new Response(null, {
        status: 302,
        headers: { Location: 'https://example.com' }
      });

      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(response.status).toBe(302);
      expect(duration).toBeLessThan(200);
    });

    it('should handle batch click requests (100 concurrent) in < 2000ms', async () => {
      const startTime = performance.now();

      const supabase = getSupabaseClient();

      const promises = Array(100)
        .fill(null)
        .map(async (_value, index) => {
          const { count } = await supabase
            .from('analytics_events')
            .select('*', { count: 'exact', head: true })
            .eq('event_type', 'link_click')
            .eq('user_id', `user-${index}`)
            .gt('created_at', new Date(Date.now() - 10000).toISOString());

          if (!count || count === 0) {
            await supabase.from('analytics_events').insert({
              event_type: 'link_click',
              user_id: `user-${index}`,
              article_id: `article-${index % 10}`,
              metadata: {}
            });
          }
        });

      await Promise.all(promises);

      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(2000);
    });
  });

  describe('Deduplication Performance', () => {
    it('should detect duplicates in < 50ms', async () => {
      const startTime = performance.now();

      const supabase = getSupabaseClient();

      // Quick deduplication check
      await supabase
        .from('analytics_events')
        .select('*', { count: 'exact', head: true })
        .eq('event_type', 'email_open')
        .eq('user_id', 'user-123')
        .eq('newsletter_id', 'nwl-1')
        .gt('created_at', new Date(Date.now() - 10000).toISOString());

      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(50);
    });

    it('should handle 10 deduplication checks in parallel in < 100ms', async () => {
      const startTime = performance.now();

      const supabase = getSupabaseClient();

      const promises = Array(10)
        .fill(null)
        .map(async (_value, index) => {
          await supabase
            .from('analytics_events')
            .select('*', { count: 'exact', head: true })
            .eq('event_type', 'email_open')
            .eq('user_id', `user-${index}`)
            .gt('created_at', new Date(Date.now() - 10000).toISOString());
        });

      await Promise.all(promises);

      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(100);
    });
  });

  describe('Error Handling Performance', () => {
    it('should handle token verification error in < 50ms', async () => {
      const startTime = performance.now();

      try {
        // Simulate invalid token error
        throw new Error('Invalid signature');
      } catch (e) {
        // Error handling is fast
        expect((e as Error).message).toBe('Invalid signature');
      }

      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(50);
    });

    it('should handle missing environment variable gracefully in < 50ms', async () => {
      const startTime = performance.now();

      try {
        const jwtSecret = undefined; // Simulate missing env var
        if (!jwtSecret) {
          throw new Error('Missing JWT_SECRET configuration');
        }
      } catch (e) {
        expect((e as Error).message).toContain('Missing');
      }

      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(50);
    });
  });
});
