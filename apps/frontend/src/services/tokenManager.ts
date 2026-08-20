import type { AuthSession } from '@/lib/supabase'
import { setAccessToken } from '@/services/backendClient'
import { refreshSmzUser, smzAuth } from '@/services/smzAuth'

export interface TokenInfo {
  accessToken: string
  expiresAt: number
  expiresIn: number
}

export class TokenManager {
  private accessToken: string | null = null
  private accessTokenExpiresAt: number | null = null
  private refreshInProgress: Promise<boolean> | null = null
  private refreshCheckInterval: ReturnType<typeof setInterval> | null = null
  private readonly REFRESH_BUFFER = 60_000
  private readonly CHECK_INTERVAL = 30_000

  async initializeFromSession(): Promise<void> {
    try {
      const user = await refreshSmzUser()
      if (user?.access_token) {
        this.setAccessToken(user.access_token, user.expires_in ?? 3600)
      } else {
        this.clearTokens()
      }
    } catch (error) {
      console.error('TokenManager: failed to restore SMZ Identity session', error)
      this.clearTokens()
    }
    this.startAutoRefreshCheck()
  }

  setAccessToken(token: string, expiresInSeconds: number): void {
    this.accessToken = token
    this.accessTokenExpiresAt = Date.now() + expiresInSeconds * 1000
    setAccessToken(token)
  }

  async getAccessToken(): Promise<string | null> {
    if (!this.accessToken) return null
    if (this.shouldRefresh() && !(await this.refreshAccessToken())) return null
    return this.accessToken
  }

  getTokenInfo(): TokenInfo | null {
    if (!this.accessToken || !this.accessTokenExpiresAt) return null
    return {
      accessToken: this.accessToken,
      expiresAt: this.accessTokenExpiresAt,
      expiresIn: Math.max(0, this.accessTokenExpiresAt - Date.now()) / 1000,
    }
  }

  private shouldRefresh(): boolean {
    return Boolean(
      this.accessTokenExpiresAt &&
      this.accessTokenExpiresAt - Date.now() < this.REFRESH_BUFFER,
    )
  }

  private async refreshAccessToken(): Promise<boolean> {
    if (this.refreshInProgress) return this.refreshInProgress
    this.refreshInProgress = this.performRefresh()
    try {
      return await this.refreshInProgress
    } finally {
      this.refreshInProgress = null
    }
  }

  private async performRefresh(): Promise<boolean> {
    try {
      const user = await smzAuth.signinSilent({
        resource: 'smz-directory',
        extraTokenParams: { resource: 'smz-directory' },
      })
      if (!user?.access_token) {
        this.clearTokens()
        return false
      }
      this.setAccessToken(user.access_token, user.expires_in ?? 3600)
      return true
    } catch (error) {
      console.error('TokenManager: SMZ Identity refresh failed', error)
      this.clearTokens()
      await smzAuth.removeUser()
      return false
    }
  }

  isAccessTokenValid(): boolean {
    return Boolean(
      this.accessToken &&
      this.accessTokenExpiresAt &&
      Date.now() < this.accessTokenExpiresAt,
    )
  }

  clearTokens(): void {
    this.accessToken = null
    this.accessTokenExpiresAt = null
    setAccessToken(null)
  }

  private startAutoRefreshCheck(): void {
    if (this.refreshCheckInterval) return
    this.refreshCheckInterval = setInterval(() => {
      if (this.shouldRefresh() && this.accessToken) {
        void this.refreshAccessToken()
      }
    }, this.CHECK_INTERVAL)
  }

  stopAutoRefreshCheck(): void {
    if (!this.refreshCheckInterval) return
    clearInterval(this.refreshCheckInterval)
    this.refreshCheckInterval = null
  }

  onLogout(): void {
    this.stopAutoRefreshCheck()
    this.clearTokens()
  }

  getTimeUntilExpiry(): number {
    if (!this.accessTokenExpiresAt) return 0
    return Math.max(0, (this.accessTokenExpiresAt - Date.now()) / 1000)
  }

  async forceRefresh(): Promise<boolean> {
    return this.refreshAccessToken()
  }
}

export const tokenManager = new TokenManager()
export type { AuthSession }
