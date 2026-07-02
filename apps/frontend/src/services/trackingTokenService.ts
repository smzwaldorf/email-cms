import { getSupabaseClient } from '@/lib/supabase';
import type { 
  JWTPayload 
} from '@/types/tracking';
import { ANALYTICS_CONFIG } from '@/config/analytics';

// Helpers for Base64URL encoding/decoding without dependencies
const base64UrlEncode = (str: string | Uint8Array): string => {
  const input = typeof str === 'string' ? str : String.fromCharCode(...str);
  return btoa(input)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
};

const base64UrlDecode = (str: string): string => {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) str += '=';
  return atob(str);
};

const strToUint8Array = (str: string): Uint8Array => new TextEncoder().encode(str);
const uint8ToArrayBuffer = (bytes: Uint8Array): ArrayBuffer =>
  bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;

export const trackingTokenService = {
  
  /**
   * Generates a signed JWT for tracking using native Web Crypto API.
   */
  async generateToken(userId: string, payload: Partial<JWTPayload>): Promise<string> {
    const now = Math.floor(Date.now() / 1000);
    const exp = now + (ANALYTICS_CONFIG.tokenExpiryDays * 24 * 60 * 60);

    const header = { alg: 'HS256', typ: 'JWT' };
    const jwtPayload = {
      ...payload,
      sub: userId,
      iat: now,
      exp: exp,
      jti: window.crypto.randomUUID()
    };

    const encodedHeader = base64UrlEncode(JSON.stringify(header));
    const encodedPayload = base64UrlEncode(JSON.stringify(jwtPayload));
    const dataToSign = `${encodedHeader}.${encodedPayload}`;

    const key = await this.getImportedKey();
    const signature = await window.crypto.subtle.sign(
      'HMAC',
      key,
      uint8ToArrayBuffer(strToUint8Array(dataToSign))
    );

    const encodedSignature = base64UrlEncode(new Uint8Array(signature));
    
    return `${dataToSign}.${encodedSignature}`;
  },

  /**
   * Validates JWT payload structure at runtime
   */
  isValidJWTPayload(payload: unknown): payload is JWTPayload {
    // Required fields for JWT
    if (typeof payload !== 'object' || payload === null) {
      return false;
    }

    const p = payload as Record<string, unknown>;

    // Check required fields
    if (typeof p.sub !== 'string' || !p.sub) {
      return false;
    }

    if (typeof p.nwl !== 'string' || !p.nwl) {
      return false;
    }

    // cls should be an array if present
    if (p.cls !== undefined && p.cls !== null && !Array.isArray(p.cls)) {
      return false;
    }

    if (Array.isArray(p.cls) && !p.cls.every((id) => typeof id === 'string')) {
      return false;
    }

    // iat and exp should be numbers
    if (typeof p.iat !== 'number' || p.iat <= 0) {
      return false;
    }

    if (typeof p.exp !== 'number' || p.exp <= 0) {
      return false;
    }

    // jti should be a string
    if (typeof p.jti !== 'string' || !p.jti) {
      return false;
    }

    return true;
  },

  /**
   * Verifies the token and checks if it has been revoked.
   */
  async verifyToken(token: string): Promise<{ valid: boolean; payload?: JWTPayload; error?: string }> {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) {
        throw new Error('Invalid token format');
      }
      const [encodedHeader, encodedPayload, encodedSignature] = parts;

      const checkData = `${encodedHeader}.${encodedPayload}`;
      const key = await this.getImportedKey();
      
      const signatureBinStr = base64UrlDecode(encodedSignature);
      const signature = new Uint8Array(signatureBinStr.length);
      for (let i = 0; i < signatureBinStr.length; i++) signature[i] = signatureBinStr.charCodeAt(i);

      const isValid = await window.crypto.subtle.verify(
        'HMAC',
        key,
        signature,
        uint8ToArrayBuffer(strToUint8Array(checkData))
      );

      if (!isValid) {
        throw new Error('Invalid signature');
      }

      const payload = JSON.parse(base64UrlDecode(encodedPayload));

      // Validate payload structure at runtime
      if (!this.isValidJWTPayload(payload)) {
        throw new Error('Invalid token payload structure');
      }

      const validatedPayload = payload as JWTPayload;

      // Check expiry
      if (validatedPayload.exp && validatedPayload.exp < Math.floor(Date.now() / 1000)) {
        throw new Error('Token expired');
      }

      // Check revocation status in DB
      const tokenHash = await this.getTokenHash(token);
      const isRevoked = await this.checkTokenRevoked(tokenHash);

      if (isRevoked) {
        return { valid: false, error: 'Token revoked' };
      }

      return { valid: true, payload: validatedPayload };
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Invalid token';
      return { valid: false, error: message };
    }
  },

  /**
   * Revokes a token by storing its hash with is_revoked=true.
   */
  async revokeToken(token: string): Promise<boolean> {
    const tokenHash = await this.getTokenHash(token);
    const { error } = await getSupabaseClient()
      .from('tracking_tokens')
      .update({ is_revoked: true })
      .eq('token_hash', tokenHash);

    return !error;
  },

  /**
   * SHA-256 hash of the token string.
   */
  async getTokenHash(token: string): Promise<string> {
    const msgBuffer = new TextEncoder().encode(token);
    const hashBuffer = await window.crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  },

  /**
   * Stores the token in the database.
   */
  async storeToken(token: string, userId: string, payload: Record<string, unknown>): Promise<boolean> {
    const tokenHash = await this.getTokenHash(token);
    // Decode to get exp
    const parts = token.split('.');
    let expiresAt: string;
    
    try {
        const decoded = JSON.parse(base64UrlDecode(parts[1]));
        expiresAt = new Date(decoded.exp * 1000).toISOString();
    } catch {
        // Fallback if parsing fails
        expiresAt = new Date(Date.now() + ANALYTICS_CONFIG.tokenExpiryDays * 24 * 60 * 60 * 1000).toISOString();
    }

    const { error } = await getSupabaseClient()
      .from('tracking_tokens')
      .insert({
        user_id: userId,
        token_hash: tokenHash,
        token_payload: payload,
        expires_at: expiresAt,
        is_revoked: false
      });
      
    return !error;
  },
  
  /**
   * Checks DB for revocation status.
   */
  async checkTokenRevoked(tokenHash: string): Promise<boolean> {
    const { data, error } = await getSupabaseClient()
      .from('tracking_tokens')
      .select('is_revoked')
      .eq('token_hash', tokenHash)
      .single();

    if (error || !data) return false;
    return data.is_revoked;
  },

  /**
   * Revokes all tokens for a specific user (e.g., password reset, account change).
   */
  async revokeTokensForUser(userId: string): Promise<{ revokedCount: number; error?: string }> {
    try {
      const { data, error } = await getSupabaseClient()
        .from('tracking_tokens')
        .update({ is_revoked: true })
        .eq('user_id', userId)
        .eq('is_revoked', false)
        .select('id');

      if (error) {
        return { revokedCount: 0, error: error.message };
      }

      return { revokedCount: data?.length || 0 };
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Unknown error';
      return { revokedCount: 0, error: message };
    }
  },

  /**
   * Helper to import the secret key for Web Crypto
   */
  async getImportedKey(): Promise<CryptoKey> {
    const secret = import.meta.env.VITE_JWT_SECRET;
    if (!secret) {
      throw new Error('VITE_JWT_SECRET is not configured');
    }

    // Validate JWT secret strength (minimum 32 characters)
    if (secret.length < 32) {
      console.warn('JWT_SECRET is too weak. Minimum 32 characters recommended for production.');
    }

    const encoder = new TextEncoder();
    const keyData = encoder.encode(secret);
    return window.crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign', 'verify']
    );
  }
};
