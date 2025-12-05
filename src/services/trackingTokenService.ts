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
      strToUint8Array(dataToSign)
    );

    const encodedSignature = base64UrlEncode(new Uint8Array(signature));
    
    return `${dataToSign}.${encodedSignature}`;
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
        strToUint8Array(checkData)
      );

      if (!isValid) {
        throw new Error('Invalid signature');
      }

      const payload = JSON.parse(base64UrlDecode(encodedPayload)) as JWTPayload;
      
      // Check expiry
      if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
        throw new Error('Token expired');
      }

      // Check revocation status in DB
      const tokenHash = await this.getTokenHash(token);
      const isRevoked = await this.checkTokenRevoked(tokenHash);
      
      if (isRevoked) {
        return { valid: false, error: 'Token revoked' };
      }

      return { valid: true, payload };
    } catch (e: any) {
      return { valid: false, error: e.message || 'Invalid token' };
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
  async storeToken(token: string, userId: string, payload: any): Promise<boolean> {
    const tokenHash = await this.getTokenHash(token);
    // Decode to get exp
    const parts = token.split('.');
    let expiresAt: string;
    
    try {
        const decoded = JSON.parse(base64UrlDecode(parts[1]));
        expiresAt = new Date(decoded.exp * 1000).toISOString();
    } catch (e) {
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
   * Helper to import the secret key for Web Crypto
   */
  async getImportedKey(): Promise<CryptoKey> {
    const secret = import.meta.env.VITE_JWT_SECRET;
    if (!secret) {
      throw new Error('VITE_JWT_SECRET is not configured');
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
