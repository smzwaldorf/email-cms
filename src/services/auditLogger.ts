/**
 * Audit Logger Service
 * Logs authentication events to the auth_events table for security auditing.
 *
 * Features:
 * - Logs all authentication events (login, logout, OAuth, magic links, token refresh)
 * - Captures device information via user agent
 * - Includes optional metadata for additional context
 * - Non-blocking: Logging failures never break authentication
 * - Type-safe: TypeScript ensures only valid event types are logged
 */

import { getSupabaseServiceClient } from '@/lib/supabase'

/**
 * Valid authentication event types
 */
export type AuthEventType =
  | 'login_success'
  | 'login_failure'
  | 'logout'
  | 'oauth_google_start'
  | 'oauth_google_success'
  | 'oauth_google_failure'
  | 'magic_link_sent'
  | 'magic_link_verified'
  | 'magic_link_expired'
  | 'token_refresh_success'
  | 'token_refresh_failure'
  | 'session_expired'

/**
 * Supported authentication methods
 */
export type AuthMethod = 'google_oauth' | 'magic_link' | 'email_password'

/**
 * Options for logging an authentication event
 */
export interface AuditLogOptions {
  /** User ID associated with event (may be null for pre-auth events) */
  userId?: string | null

  /** Type of authentication event */
  eventType: AuthEventType

  /** Authentication method used for this event */
  authMethod?: AuthMethod | null

  /** Additional event context (email, error details, etc.) */
  metadata?: Record<string, any> | null
}

/**
 * Audit Logger Service
 * Handles logging of authentication events to the database
 */
class AuditLoggerService {
  /**
   * Log an authentication event
   *
   * @param options - Event logging options
   * @remarks
   * - Automatically captures user agent for device identification
   * - Never throws - logging failures are non-fatal
   * - Errors are logged to console for debugging
   * - Safe to call from auth operations - won't break authentication
   */
  async logAuthEvent(options: AuditLogOptions): Promise<void> {
    try {
      const supabaseAdmin = getSupabaseServiceClient()

      const { error } = await supabaseAdmin
        .from('auth_events')
        .insert({
          user_id: options.userId || null,
          event_type: options.eventType,
          auth_method: options.authMethod || null,
          user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
          // Note: IP address would need to be captured server-side via Edge Function
          // Client-side JS cannot reliably access user's IP address
          ip_address: null,
          metadata: options.metadata || null,
        })

      if (error) {
        console.error('Failed to log auth event:', {
          eventType: options.eventType,
          error: error.message,
          details: error,
        })
      }
    } catch (err) {
      // Log to console for debugging, but don't throw
      // Authentication should never fail due to logging issues
      console.error('Audit logging exception:', err)
    }
  }
}

/**
 * Singleton instance of the audit logger
 * Used throughout the application for consistent auth event logging
 */
export const auditLogger = new AuditLoggerService()
