import type { User } from 'oidc-client-ts'
import type { AuthSession } from '@/lib/supabase'
import type { AuthUser } from '@/types/auth'
import { requestBackend, setStoredAuthUser } from '@/services/backendClient'
import { redirectFromSmzUser, smzAuth } from '@/services/smzAuth'
import { auditLogger } from './auditLogger'
import { tokenManager } from './tokenManager'
import { isSafeAppRedirectPath } from '@/utils/urlUtils'

interface SessionResponse {
  user: {
    id: string
    email: string
    role: string
    display_name: string | null
  }
}

export interface CompletedSignIn {
  user: AuthUser
  redirectTo?: string
}

export interface AuthServiceInterface {
  signIn(email: string, password: string): Promise<AuthUser | null>
  signInWithGoogle(redirectTo?: string): Promise<AuthUser | null>
  sendMagicLink(email: string, redirectTo?: string): Promise<boolean>
  verifyMagicLink(token: string): Promise<AuthUser | null>
  completeSignIn(): Promise<CompletedSignIn>
  signOut(): Promise<void>
  getCurrentUser(): AuthUser | null
  isAuthenticated(): boolean
  onAuthStateChange(callback: (user: AuthUser | null) => void): () => void
  getSession(): Promise<AuthSession | null>
  initialize(): Promise<void>
  ensureInitialized(): Promise<void>
}

class SmzAuthService implements AuthServiceInterface {
  private currentUser: AuthUser | null = null
  private authStateListeners: Array<(user: AuthUser | null) => void> = []
  private initialized = false
  private initializationPromise: Promise<void> | null = null
  private callbackPromise: Promise<CompletedSignIn> | null = null

  async initialize(): Promise<void> {
    if (this.initializationPromise) return this.initializationPromise
    if (this.initialized) return

    this.initializationPromise = (async () => {
      if (window.location.pathname !== '/auth/callback') {
        const oidcUser = await smzAuth.getUser()
        if (oidcUser && !oidcUser.expired && oidcUser.access_token) {
          await this.establishLocalSession(oidcUser)
        } else {
          await this.clearLocalSession()
        }
      }

      smzAuth.events.addUserLoaded((user) => {
        if (this.callbackPromise) return
        void this.establishLocalSession(user).catch(() => this.clearLocalSession())
      })
      smzAuth.events.addUserUnloaded(() => {
        void this.clearLocalSession()
      })
      this.initialized = true
    })()

    return this.initializationPromise
  }

  async ensureInitialized(): Promise<void> {
    return this.initialize()
  }

  async signIn(_email: string, _password: string): Promise<AuthUser | null> {
    await this.startSignIn()
    return null
  }

  async signInWithGoogle(redirectTo?: string): Promise<AuthUser | null> {
    await this.startSignIn(redirectTo)
    return null
  }

  async sendMagicLink(_email: string, redirectTo?: string): Promise<boolean> {
    await this.startSignIn(redirectTo)
    return true
  }

  async verifyMagicLink(_token: string): Promise<AuthUser | null> {
    const result = await this.completeSignIn()
    return result.user
  }

  completeSignIn(): Promise<CompletedSignIn> {
    this.callbackPromise ??= this.finishSignIn()
    return this.callbackPromise
  }

  private async finishSignIn(): Promise<CompletedSignIn> {
    const oidcUser = await smzAuth.signinRedirectCallback()
    const user = await this.establishLocalSession(oidcUser)
    const redirectTo = redirectFromSmzUser(oidcUser)
    return {
      user,
      redirectTo: isSafeAppRedirectPath(redirectTo) ? redirectTo : undefined,
    }
  }

  async signOut(): Promise<void> {
    if (this.currentUser?.id) {
      await auditLogger.logAuthEvent({
        userId: this.currentUser.id,
        eventType: 'logout',
      }).catch(() => undefined)
    }
    await this.clearLocalSession()
    await smzAuth.signoutRedirect()
  }

  getCurrentUser(): AuthUser | null {
    return this.currentUser
  }

  isAuthenticated(): boolean {
    return this.currentUser !== null
  }

  onAuthStateChange(callback: (user: AuthUser | null) => void): () => void {
    this.authStateListeners.push(callback)
    return () => {
      this.authStateListeners = this.authStateListeners.filter((listener) => listener !== callback)
    }
  }

  async getSession(): Promise<AuthSession | null> {
    const oidcUser = await smzAuth.getUser()
    if (!oidcUser?.access_token || oidcUser.expired || !this.currentUser) return null
    return {
      access_token: oidcUser.access_token,
      refresh_token: oidcUser.refresh_token,
      expires_in: oidcUser.expires_in,
      user: {
        id: this.currentUser.id,
        email: this.currentUser.email,
      },
    }
  }

  private async startSignIn(redirectTo?: string): Promise<void> {
    const safeRedirectTo = isSafeAppRedirectPath(redirectTo) ? redirectTo : undefined
    await smzAuth.signinRedirect({
      state: safeRedirectTo ? { redirectTo: safeRedirectTo } : undefined,
      resource: 'smz-directory',
      extraTokenParams: { resource: 'smz-directory' },
    })
  }

  private async establishLocalSession(oidcUser: User): Promise<AuthUser> {
    if (!oidcUser.access_token || oidcUser.expired) {
      throw new Error('SMZ Identity did not return a usable access token')
    }
    tokenManager.setAccessToken(oidcUser.access_token, oidcUser.expires_in ?? 3600)
    const session = await requestBackend<SessionResponse>('/api/auth/session')
    const user: AuthUser = {
      id: session.user.id,
      email: session.user.email,
      role: session.user.role as AuthUser['role'],
      displayName: session.user.display_name || session.user.email.split('@')[0],
    }
    this.currentUser = user
    setStoredAuthUser({ id: user.id, email: user.email })
    this.notifyListeners(user)
    await auditLogger.logAuthEvent({
      userId: user.id,
      eventType: 'login_success',
      authMethod: 'smz_oidc',
    }).catch(() => undefined)
    return user
  }

  private async clearLocalSession(): Promise<void> {
    tokenManager.onLogout()
    setStoredAuthUser(null)
    this.currentUser = null
    this.notifyListeners(null)
  }

  private notifyListeners(user: AuthUser | null): void {
    for (const listener of this.authStateListeners) listener(user)
  }
}

const authService = new SmzAuthService()

void authService.initialize().catch((error) => {
  console.error('Failed to initialize SMZ Identity', error)
})

export { authService }
export default authService
