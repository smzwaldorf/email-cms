/**
 * Token Manager Service
 * Manages JWT access and refresh tokens with automatic refresh logic
 *
 * Strategy:
 * - Access tokens: Stored in memory (15 min expiry)
 * - Refresh tokens: Handled by Supabase (HttpOnly cookies, 30 day expiry)
 * - Auto-refresh: Triggered 1 minute before access token expiry
 * - Thread-safe: Uses Promise-based locking to prevent concurrent refreshes
 */

import { getSupabaseClient } from '@/lib/supabase'
import type { AuthSession } from '@supabase/supabase-js'

export interface TokenInfo {
  accessToken: string
  expiresAt: number // Unix timestamp in milliseconds
  expiresIn: number // Seconds until expiry
}

class TokenManager {
  private accessToken: string | null = null
  private accessTokenExpiresAt: number | null = null
  private refreshInProgress: Promise<boolean> | null = null
  private refreshCheckInterval: NodeJS.Timeout | null = null
  private readonly REFRESH_BUFFER = 60000 // Refresh 1 minute before expiry (milliseconds)
  private readonly CHECK_INTERVAL = 30000 // Check every 30 seconds (milliseconds)

  /**
   * Initialize token manager with current session
   * Should be called when user authenticates
   */
  async initializeFromSession(): Promise<void> {
    const supabase = getSupabaseClient()

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (session?.access_token) {
        this.setAccessToken(session.access_token, session.expires_in || 3600)
        console.log('✅ TokenManager: Initialized with existing session')
      } else {
        console.log('ℹ️ TokenManager: No existing session found')
      }
    } catch (error) {
      console.error('❌ TokenManager: Failed to initialize from session:', error)
    }

    // Start auto-refresh checker
    this.startAutoRefreshCheck()
  }

  /**
   * Set access token and start expiry timer
   */
  public setAccessToken(token: string, expiresInSeconds: number): void {
    this.accessToken = token
    // Calculate expiry time (current time + expiry seconds)
    this.accessTokenExpiresAt = Date.now() + expiresInSeconds * 1000
    console.log(
      `🔐 TokenManager: Access token set (expires in ${expiresInSeconds}s)`
    )
  }

  /**
   * Get current access token
   * Triggers auto-refresh if expiry is approaching
   */
  async getAccessToken(): Promise<string | null> {
    if (!this.accessToken) {
      return null
    }

    // Check if token is approaching expiry
    if (this.shouldRefresh()) {
      console.log('⏱️ TokenManager: Token expiring soon, refreshing...')
      const refreshed = await this.refreshAccessToken()
      if (!refreshed) {
        console.warn('⚠️ TokenManager: Failed to refresh token')
        return null
      }
    }

    return this.accessToken
  }

  /**
   * Get token info (for debugging/verification)
   */
  getTokenInfo(): TokenInfo | null {
    if (!this.accessToken || !this.accessTokenExpiresAt) {
      return null
    }

    return {
      accessToken: this.accessToken,
      expiresAt: this.accessTokenExpiresAt,
      expiresIn: Math.max(0, this.accessTokenExpiresAt - Date.now()) / 1000,
    }
  }

  /**
   * Check if token should be refreshed (approaching expiry)
   */
  private shouldRefresh(): boolean {
    if (!this.accessTokenExpiresAt) {
      return false
    }

    const timeUntilExpiry = this.accessTokenExpiresAt - Date.now()
    return timeUntilExpiry < this.REFRESH_BUFFER
  }

  /**
   * Refresh access token using Supabase refresh token
   * Uses Promise locking to prevent concurrent refresh requests
   */
  private async refreshAccessToken(): Promise<boolean> {
    // If refresh is already in progress, wait for it
    if (this.refreshInProgress) {
      console.log('⏳ TokenManager: Refresh already in progress, waiting...')
      return this.refreshInProgress
    }

    // Create new refresh promise
    this.refreshInProgress = this.performRefresh()

    try {
      const result = await this.refreshInProgress
      return result
    } finally {
      this.refreshInProgress = null
    }
  }

  /**
   * Perform the actual token refresh
   */
  private async performRefresh(): Promise<boolean> {
    const supabase = getSupabaseClient()
    const REFRESH_TIMEOUT = 15000 // 15 second timeout for refresh

    try {
      console.log('🔄 TokenManager: Performing token refresh...')
      const startTime = performance.now()

      // Wrap refresh in a timeout to prevent hanging forever
      const refreshPromise = supabase.auth.refreshSession()
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Token refresh timeout')), REFRESH_TIMEOUT)
      })

      const { data: { session }, error } = await Promise.race([
        refreshPromise,
        timeoutPromise
      ]) as Awaited<typeof refreshPromise>

      console.log(`⏱️ TokenManager: Refresh took ${(performance.now() - startTime).toFixed(0)}ms`)

      if (error || !session?.access_token) {
        console.error('❌ TokenManager: Refresh failed:', error?.message)
        // Clear tokens on refresh failure
        this.clearTokens()
        return false
      }

      // Update access token with new values
      this.setAccessToken(session.access_token, session.expires_in || 3600)
      console.log('✅ TokenManager: Token refreshed successfully')
      return true
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      console.error('❌ TokenManager: Refresh exception:', errorMessage)
      
      // If timeout, just return false but KEEP the tokens.
      // The next request might succeed, or the user might reload.
      // Clearing tokens here logs the user out which is too aggressive for a network timeout.
      if (errorMessage === 'Token refresh timeout') {
        console.warn('⚠️ TokenManager: Refresh timed out - keeping existing tokens for retry')
        return false
      }
      
      // Only clear tokens if it's a fatal auth error (e.g. invalid grant)
      if (errorMessage.includes('Invalid Refresh Token') || errorMessage.includes('refresh_token_not_found')) {
        console.error('❌ TokenManager: Fatal auth error, clearing tokens')
        this.clearTokens()
      }
      
      return false
    }
  }

  /**
   * Check if access token is valid (not expired)
   */
  isAccessTokenValid(): boolean {
    if (!this.accessToken || !this.accessTokenExpiresAt) {
      return false
    }

    return Date.now() < this.accessTokenExpiresAt
  }

  /**
   * Clear all stored tokens
   * Called on logout or refresh failure
   */
  clearTokens(): void {
    this.accessToken = null
    this.accessTokenExpiresAt = null
    console.log('🗑️ TokenManager: Tokens cleared')
  }

  /**
   * Start periodic auto-refresh check
   * Checks every 30 seconds if token needs refresh
   */
  private startAutoRefreshCheck(): void {
    if (this.refreshCheckInterval) {
      return // Already running
    }

    console.log('▶️ TokenManager: Starting auto-refresh checker')

    this.refreshCheckInterval = setInterval(async () => {
      if (this.shouldRefresh() && this.accessToken) {
        await this.refreshAccessToken()
      }
    }, this.CHECK_INTERVAL)
  }

  /**
   * Stop the auto-refresh checker
   * Called on logout or cleanup
   */
  stopAutoRefreshCheck(): void {
    if (this.refreshCheckInterval) {
      clearInterval(this.refreshCheckInterval)
      this.refreshCheckInterval = null
      console.log('⏹️ TokenManager: Auto-refresh checker stopped')
    }
  }

  /**
   * Cleanup on logout
   */
  onLogout(): void {
    this.stopAutoRefreshCheck()
    this.clearTokens()
    console.log('🚪 TokenManager: Cleanup on logout complete')
  }

  /**
   * Get remaining time until token expires (in seconds)
   */
  getTimeUntilExpiry(): number {
    if (!this.accessTokenExpiresAt) {
      return 0
    }

    return Math.max(0, (this.accessTokenExpiresAt - Date.now()) / 1000)
  }

  /**
   * Force refresh (useful for testing or manual refresh)
   */
  async forceRefresh(): Promise<boolean> {
    console.log('🔄 TokenManager: Force refresh requested')
    return this.refreshAccessToken()
  }
}

// Export singleton instance
export const tokenManager = new TokenManager()

// Export type for use in other services
export type { AuthSession }
