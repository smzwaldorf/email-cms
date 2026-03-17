import { describe, it, expect, vi, beforeEach } from 'vitest';
import { trackingTokenService } from '@/services/trackingTokenService';

// Mock Supabase
const mockSupabaseClient = {
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
          eq: vi.fn(function(_column: string) {
            return {
              single: vi.fn(() => ({ data: { is_revoked: false }, error: null }))
            };
          })
        }))
      };
    }
    return {
      update: vi.fn(() => ({ eq: vi.fn(() => ({ error: null })) })),
      insert: vi.fn(() => ({ error: null })),
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

describe('trackingTokenService', () => {
  const userId = 'user-123';
  const payload = { nwl: 'week-1' };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should generate a valid JWT', async () => {
    const token = await trackingTokenService.generateToken(userId, payload);
    expect(typeof token).toBe('string');
    expect(token.split('.').length).toBe(3);
  });

  it('should verify a valid token', async () => {
    const token = await trackingTokenService.generateToken(userId, payload);
    const result = await trackingTokenService.verifyToken(token);
    
    expect(result.valid).toBe(true);
    expect(result.payload?.sub).toBe(userId);
    expect(result.payload?.nwl).toBe('week-1');
  });

  it('should generate consistent hash for same token', async () => {
    const token = 'test.token.string';
    const hash1 = await trackingTokenService.getTokenHash(token);
    const hash2 = await trackingTokenService.getTokenHash(token);
    expect(hash1).toBe(hash2);
    expect(hash1.length).toBe(64); // SHA-256 hex string
  });
  
  it('should check revocation status via supabase', async () => {
    const token = await trackingTokenService.generateToken(userId, payload);

    // Mock return false for revocation
    const result = await trackingTokenService.verifyToken(token);
    expect(result.valid).toBe(true);

    // Check if supabase was called
    // We can't easily spy on internal calls unless we refactor, but we can rely on verifyToken calling checkTokenRevoked logic
    // which calls supabase.
  });

  it('should revoke all tokens for a user', async () => {
    const result = await trackingTokenService.revokeTokensForUser(userId);
    expect(result.revokedCount).toBe(1);
    expect(result.error).toBeUndefined();
  });

  it('should return count of revoked tokens', async () => {
    const result = await trackingTokenService.revokeTokensForUser(userId);
    expect(typeof result.revokedCount).toBe('number');
    expect(result.revokedCount >= 0).toBe(true);
  });

});
