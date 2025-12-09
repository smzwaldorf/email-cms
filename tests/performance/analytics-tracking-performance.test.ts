import { describe, it, expect, vi, beforeEach } from 'vitest';
import { trackingTokenService } from '@/services/trackingTokenService';

// Mock Supabase with proper chaining
const mockSupabaseClient = {
  from: vi.fn(function(_table: string) {
    return {
      insert: vi.fn(() => ({ error: null })),
      update: vi.fn(() => ({
        eq: vi.fn(() => ({ error: null }))
      })),
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(() => ({ data: { is_revoked: false }, error: null }))
        }))
      }))
    };
  })
};

vi.mock('@/lib/supabase', () => ({
  getSupabaseClient: vi.fn(() => mockSupabaseClient)
}));

describe('Analytics Tracking Performance', () => {
  const userId = 'user-123';
  const payload = { nwl: 'week-1', class: 'class-1' };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Token Generation Performance', () => {
    it('should generate token in < 50ms', async () => {
      const startTime = performance.now();
      const token = await trackingTokenService.generateToken(userId, payload);
      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(token).toBeDefined();
      expect(duration).toBeLessThan(50);
    });

    it('should generate 10 tokens in < 300ms', async () => {
      const startTime = performance.now();
      const promises = Array(10)
        .fill(null)
        .map((_, i) => trackingTokenService.generateToken(`user-${i}`, payload));
      await Promise.all(promises);
      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(300);
    });
  });

  describe('Token Verification Performance', () => {
    it('should verify token in < 50ms', async () => {
      const token = await trackingTokenService.generateToken(userId, payload);

      const startTime = performance.now();
      const result = await trackingTokenService.verifyToken(token);
      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(result.valid).toBe(true);
      expect(duration).toBeLessThan(50);
    });

    it('should hash token in < 10ms', async () => {
      const token = await trackingTokenService.generateToken(userId, payload);

      const startTime = performance.now();
      const hash = await trackingTokenService.getTokenHash(token);
      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(hash.length).toBe(64);
      expect(duration).toBeLessThan(10);
    });
  });

  describe('Full Token Lifecycle Performance', () => {
    it('should complete token generation + verification in < 100ms', async () => {
      const startTime = performance.now();

      // Generate token
      const token = await trackingTokenService.generateToken(userId, payload);

      // Verify token
      const result = await trackingTokenService.verifyToken(token);
      expect(result.valid).toBe(true);

      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(100);
    });

    it('should complete generate + store + verify + revoke in < 200ms', async () => {
      const startTime = performance.now();

      // Generate token
      const token = await trackingTokenService.generateToken(userId, payload);

      // Store token
      await trackingTokenService.storeToken(token, userId, payload);

      // Verify token
      const result = await trackingTokenService.verifyToken(token);
      expect(result.valid).toBe(true);

      // Revoke token
      await trackingTokenService.revokeToken(token);

      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(200);
    });
  });

  describe('Token Revocation Performance', () => {
    it('should revoke token in < 50ms', async () => {
      const token = await trackingTokenService.generateToken(userId, payload);

      const startTime = performance.now();
      const revoked = await trackingTokenService.revokeToken(token);
      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(revoked).toBe(true);
      expect(duration).toBeLessThan(50);
    });

    it('should bulk revoke tokens in < 100ms', async () => {
      const startTime = performance.now();
      const result = await trackingTokenService.revokeTokensForUser(userId);
      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(result.revokedCount >= 0).toBe(true);
      expect(duration).toBeLessThan(100);
    });
  });
});
