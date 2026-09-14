import { serverSessionMode } from './serverSessionMode'
import { serverAuthService } from './serverAuthService'
import type { User } from 'oidc-client-ts'
import type { AuthSession } from '@/lib/supabase'
import type { AuthUser } from '@/types/auth'
import { requestBackend, setStoredAuthUser } from '@/services/backendClient'
import { redirectFromSmzUser, redirectToGlobalSignOut, smzAuth, smzDirectoryResource } from '@/services/smzAuth'
import { auditLogger } from './auditLogger'
import { tokenManager } from './tokenManager'
import { isSafeAppRedirectPath } from '@/utils/urlUtils'

export const CMS_LOGOUT_MARKER = 'email-cms-global-logout'
const SESSION_MARKER = 'email-cms-session-logout-marker'
const LOGOUT_CHANNEL = 'email-cms-global-logout'

interface SessionResponse {
  user: {
    id: string
    email: string
    role: string | null
    roles: string[]
    teacherClassIds: string[]
    parentClassIds: string[]
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
  clearSessionForGlobalLogout(): Promise<void>
  startSessionMonitoring(): () => void
  getCurrentUser(): AuthUser | null
  isAuthenticated(): boolean
  onAuthStateChange(callback: (user: AuthUser | null) => void): () => void
  getSession(): Promise<AuthSession | null>
  initialize(): Promise<void>
  ensureInitialized(): Promise<void>
}

class SmzAuthService implements AuthServiceInterface {
  private sessionEpoch = 0
  private revalidation: Promise<void> | null = null
  private currentUser: AuthUser | null = null
  private authStateListeners: Array<(user: AuthUser | null) => void> = []
  private initialized = false
  private initializationPromise: Promise<void> | null = null
  private callbackUserPromise: Promise<User> | null = null
  private callbackPromise: Promise<CompletedSignIn> | null = null

  async initialize(): Promise<void> {
    if (this.initializationPromise) return this.initializationPromise
    if (this.initialized) return

    this.initializationPromise = (async () => {
      if (!['/auth/callback', '/logout/local'].includes(window.location.pathname)) {
        let oidcUser = await smzAuth.getUser()
        if (oidcUser?.expired && !this.logoutMarkerChanged() && await tokenManager.forceRefresh()) {
          oidcUser = await smzAuth.getUser()
        }
        if (oidcUser && !oidcUser.expired && oidcUser.access_token && !this.logoutMarkerChanged()) {
          await this.establishLocalSession(oidcUser)
        } else {
          await this.invalidateLocalSession()
        }
      }

      smzAuth.events.addUserLoaded((user) => {
        if (this.callbackPromise) return
        if (!this.currentUser) { void smzAuth.removeUser(); return }
        // `signinSilent` emits user-loaded after a token refresh. The token
        // manager has already updated the bearer token; rebuilding the local
        // session here causes the auth tree (and the page beneath it) to
        // repaint on every renewal. Only an explicit callback establishes a
        // local session, so keep the current page mounted during refresh.
        void user
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
    this.callbackPromise ??= this.finishSignIn().catch(error => {
      this.callbackPromise = null
      throw error
    })
    return this.callbackPromise
  }

  private async finishSignIn(): Promise<CompletedSignIn> {
    const epoch = this.sessionEpoch
    const marker = window.localStorage.getItem(CMS_LOGOUT_MARKER)
    // A new explicit login may follow an earlier logout. A later marker change
    // still cancels this in-flight callback through the epoch/marker checks.
    if (marker === null) window.sessionStorage.removeItem(SESSION_MARKER)
    else window.sessionStorage.setItem(SESSION_MARKER, marker)
    const oidcUser = await (this.callbackUserPromise ??= smzAuth.signinRedirectCallback())
    if (epoch !== this.sessionEpoch || marker !== window.localStorage.getItem(CMS_LOGOUT_MARKER)) throw new Error('Sign-in was cancelled by logout')
    const user = await this.establishLocalSession(oidcUser)
    const redirectTo = redirectFromSmzUser(oidcUser)
    return {
      user,
      redirectTo: isSafeAppRedirectPath(redirectTo) ? redirectTo : undefined,
    }
  }

  async signOut(): Promise<void> {
    try {
      await this.clearSessionForGlobalLogout()
    } finally {
      // Always revoke centrally, even if local browser storage cleanup fails.
      redirectToGlobalSignOut()
    }
  }

  async clearSessionForGlobalLogout(): Promise<void> {
    this.clearLocalSession()
    const marker = `${Date.now()}:${crypto.randomUUID()}`
    window.localStorage.setItem(CMS_LOGOUT_MARKER, marker)
    window.sessionStorage.setItem(SESSION_MARKER, marker)
    if (typeof BroadcastChannel !== 'undefined') {
      const channel = new BroadcastChannel(LOGOUT_CHANNEL)
      channel.postMessage({ type: 'logout' })
      channel.close()
    }
    await smzAuth.removeUser()
  }

  private logoutMarkerChanged(): boolean {
    return window.localStorage.getItem(CMS_LOGOUT_MARKER) !== window.sessionStorage.getItem(SESSION_MARKER)
  }

  private async invalidateLocalSession(): Promise<void> {
    this.clearLocalSession()
    await smzAuth.removeUser()
    const marker = window.localStorage.getItem(CMS_LOGOUT_MARKER)
    if (marker === null) window.sessionStorage.removeItem(SESSION_MARKER)
    else window.sessionStorage.setItem(SESSION_MARKER, marker)
  }

  startSessionMonitoring(): () => void {
    const expired = () => { void this.revalidateSession(true) }
    const invalid = () => { void this.invalidateLocalSession() }
    const check = () => {
      if (this.logoutMarkerChanged()) {
        void this.invalidateLocalSession()
      } else if (document.visibilityState !== 'hidden') {
        void this.revalidateSession()
      }
    }
    const storage = (event: StorageEvent) => {
      if (event.key === CMS_LOGOUT_MARKER || event.key === null) check()
    }
    const channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel(LOGOUT_CHANNEL) : null
    const broadcast = (event: MessageEvent) => {
      if (event.data?.type === 'logout') void this.invalidateLocalSession()
    }
    channel?.addEventListener('message', broadcast)
    window.addEventListener('storage', storage)
    window.addEventListener('cms-auth-invalid', invalid)
    window.addEventListener('cms-auth-expired', expired)
    window.addEventListener('focus', check)
    window.addEventListener('pageshow', check)
    document.addEventListener('visibilitychange', check)
    const timer = window.setInterval(check, 15_000)
    return () => {
      window.clearInterval(timer)
      channel?.close()
      window.removeEventListener('storage', storage)
      window.removeEventListener('cms-auth-invalid', invalid)
      window.removeEventListener('cms-auth-expired', expired)
      window.removeEventListener('focus', check)
      window.removeEventListener('pageshow', check)
      document.removeEventListener('visibilitychange', check)
    }
  }

  private async revalidateSession(forceRefresh = false): Promise<void> {
    if (!this.currentUser || this.revalidation) return
    const epoch = this.sessionEpoch
    this.revalidation = (async () => {
      try {
        let oidcUser = await smzAuth.getUser()
        if (epoch !== this.sessionEpoch) return
        if (forceRefresh || !oidcUser?.access_token || oidcUser.expired || (typeof oidcUser.expires_in === 'number' && oidcUser.expires_in < 60)) {
          if (!(await tokenManager.forceRefresh())) {
            if (epoch === this.sessionEpoch) window.dispatchEvent(new Event('cms-auth-renewal-required'))
            return
          }
          oidcUser = await smzAuth.getUser()
          if (epoch !== this.sessionEpoch) return
          if (!oidcUser?.access_token || oidcUser.expired) {
            window.dispatchEvent(new Event('cms-auth-renewal-required'))
            return
          }
        }
        const session = await requestBackend<SessionResponse>('/api/auth/session', {}, oidcUser.access_token)
        if (epoch !== this.sessionEpoch || this.logoutMarkerChanged()) return
        this.currentUser = this.userFromSession(session)
        this.notifyListeners(this.currentUser)
      } catch {
        // The HTTP client preserves expired sessions but clears confirmed revocation. A temporary
        // outage is not a new authorization grant; every protected API fails closed.
      }
    })()
    try { await this.revalidation } finally { this.revalidation = null }
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
    if (this.logoutMarkerChanged()) { await this.invalidateLocalSession(); return null }
    const epoch = this.sessionEpoch
    const oidcUser = await smzAuth.getUser()
    if (epoch !== this.sessionEpoch || !oidcUser?.access_token || oidcUser.expired || !this.currentUser) return null
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
    this.callbackUserPromise = null
    this.callbackPromise = null
    const safeRedirectTo = isSafeAppRedirectPath(redirectTo) ? redirectTo : undefined
    await smzAuth.signinRedirect({
      state: safeRedirectTo ? { redirectTo: safeRedirectTo } : undefined,
      resource: smzDirectoryResource(),
      extraTokenParams: { resource: smzDirectoryResource() },
    })
  }

  private async establishLocalSession(oidcUser: User): Promise<AuthUser> {
    if (!oidcUser.access_token || oidcUser.expired) {
      throw new Error('SMZ Identity did not return a usable access token')
    }
    const epoch = this.sessionEpoch
    const marker = window.localStorage.getItem(CMS_LOGOUT_MARKER)
    tokenManager.setAccessToken(oidcUser.access_token, oidcUser.expires_in ?? 3600)
    const session = await requestBackend<SessionResponse>('/api/auth/session')
    if (epoch !== this.sessionEpoch || marker !== window.localStorage.getItem(CMS_LOGOUT_MARKER)) {
      throw new Error('Session was cancelled by logout')
    }
    if (marker === null) window.sessionStorage.removeItem(SESSION_MARKER)
    else window.sessionStorage.setItem(SESSION_MARKER, marker)
    const user = this.userFromSession(session)
    this.currentUser = user
    setStoredAuthUser({ id: user.id, email: user.email })
    this.notifyListeners(user)
    window.dispatchEvent(new Event('cms-auth-renewed'))
    await auditLogger.logAuthEvent({
      userId: user.id,
      eventType: 'oauth_google_success',
      authMethod: 'google_oauth',
    }).catch(() => undefined)
    return user
  }

  private userFromSession(session: SessionResponse): AuthUser {
    return {
      id: session.user.id,
      email: session.user.email,
      role: (session.user.role ?? 'student') as AuthUser['role'],
      roles: session.user.roles,
      teacherClassIds: session.user.teacherClassIds,
      parentClassIds: session.user.parentClassIds,
      displayName: session.user.display_name || session.user.email.split('@')[0],
    }
  }

  private clearLocalSession(): void {
    this.sessionEpoch += 1
    this.callbackPromise = null
    this.callbackUserPromise = null
    tokenManager.onLogout()
    setStoredAuthUser(null)
    for (const key of Object.keys(window.sessionStorage)) {
      if (key.startsWith('oidc.')) window.sessionStorage.removeItem(key)
    }
    this.currentUser = null
    this.notifyListeners(null)
  }

  private notifyListeners(user: AuthUser | null): void {
    for (const listener of this.authStateListeners) listener(user)
  }
}

const authService = serverSessionMode ? serverAuthService : new SmzAuthService()

void authService.initialize().catch((error) => {
  console.error('Failed to initialize SMZ Identity', error)
})

export { authService }
export default authService
