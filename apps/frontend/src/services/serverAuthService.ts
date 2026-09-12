import type { AuthServiceInterface, CompletedSignIn } from './authService'
import type { AuthUser } from '@/types/auth'
import type { AuthSession } from '@/lib/supabase'
import { setStoredAuthUser } from './backendClient'

export type AuthorizationStatus = 'active' | 'reconnecting' | 'reauthentication_required' | 'revoked' | 'signed_out'
const CACHE = 'email-cms-remembered-identity-v1'
const PENDING_LOGOUT = 'email-cms-pending-server-logout'
const MARKER = 'email-cms-global-logout'
interface Snapshot { user: (Omit<AuthUser, 'role'> & { role: AuthUser['role'] | null }) | null; authorizationStatus: AuthorizationStatus }
class ServerAuthService implements AuthServiceInterface {
  private user: AuthUser | null = null
  private epoch = 0
  private pending: Promise<void> | null = null
  private listeners = new Set<(user: AuthUser | null) => void>()
  private status: AuthorizationStatus = 'reconnecting'
  private marker = localStorage.getItem(MARKER)
  private initialized = false
  private notify(): void {
    setStoredAuthUser(this.user ? { id: this.user.id, email: this.user.email } : null)
    this.listeners.forEach(listener => listener(this.user))
    window.dispatchEvent(new CustomEvent('cms-session-status', { detail: this.status }))
  }
  getAuthorizationStatus(): AuthorizationStatus { return this.status }
  private async fetchSession(path: string, init: RequestInit = {}): Promise<Response> {
    return fetch(path, { ...init, credentials: 'same-origin', cache: 'no-store', headers: { 'X-CMS-Request': '1', ...init.headers } })
  }
  private clear(): void {
    this.epoch++; this.user = null; this.status = 'signed_out'
    localStorage.removeItem(CACHE)
    for (const key of Object.keys(localStorage)) if (key.startsWith('email-cms-draft:')) localStorage.removeItem(key)
    // Retire legacy credentials; remembered identity never serves as a bearer.
    for (const key of Object.keys(sessionStorage)) if (key.startsWith('oidc.') || key === 'email-cms-access-token') sessionStorage.removeItem(key)
    localStorage.removeItem('email-cms-access-token')
    this.notify()
  }
  async initialize(): Promise<void> {
    if (!this.initialized) {
      this.initialized = true
      try {
        const cached = JSON.parse(localStorage.getItem(CACHE) ?? 'null') as AuthUser | null
        if (cached && typeof cached.id === 'string' && typeof cached.email === 'string') this.user = cached
      } catch { localStorage.removeItem(CACHE) }
      this.notify()
    }
    await this.revalidate()
  }
  ensureInitialized(): Promise<void> { return this.initialize() }
  private async revalidate(): Promise<void> {
    if (this.pending) return this.pending
    const epoch = this.epoch
    this.pending = (async () => {
      try {
        if (localStorage.getItem(PENDING_LOGOUT)) {
          this.clear()
          const response = await this.fetchSession('/api/session/logout', { method: 'POST' })
          if (response.ok) localStorage.removeItem(PENDING_LOGOUT)
          return
        }
        const response = await this.fetchSession('/api/session/current')
        if (!response.ok) throw new Error('Session service unavailable')
        const snapshot = await response.json() as Snapshot
        if (epoch !== this.epoch || this.marker !== localStorage.getItem(MARKER)) return
        const previousStatus = this.status
        this.status = snapshot.authorizationStatus
        if (this.status === 'signed_out' || this.status === 'revoked') {
          this.clear(); this.status = snapshot.authorizationStatus
        } else if (snapshot.user) {
          this.user = { ...snapshot.user, role: snapshot.user.role ?? 'student' }
          localStorage.setItem(CACHE, JSON.stringify(this.user))
        }
        // If the service is temporarily unavailable, a null snapshot does not erase remembered identity.
        this.notify()
        if (this.status === 'active' && previousStatus !== 'active') window.dispatchEvent(new Event('cms-auth-renewed'))
      } catch {
        if (epoch === this.epoch && !localStorage.getItem(PENDING_LOGOUT)) { this.status = 'reconnecting'; this.notify() }
      }
    })()
    try { await this.pending } finally { this.pending = null }
  }
  startSessionMonitoring(): () => void {
    const check = () => {
      if (this.marker !== localStorage.getItem(MARKER)) { this.marker = localStorage.getItem(MARKER); this.clear() }
      if (this.user || document.visibilityState !== 'hidden') void this.revalidate()
    }
    const invalid = () => { this.clear(); this.status = 'revoked'; this.notify() }
    const expired = () => { this.status = 'reauthentication_required'; this.notify(); void this.revalidate() }
    const unavailable = () => { this.status = 'reconnecting'; this.notify() }
    const events = ['focus', 'pageshow', 'online', 'storage']
    events.forEach(event => window.addEventListener(event, check))
    window.addEventListener('cms-auth-invalid', invalid)
    window.addEventListener('cms-auth-expired', expired)
    window.addEventListener('cms-auth-unavailable', unavailable)
    document.addEventListener('visibilitychange', check)
    const timer = window.setInterval(check, 30_000)
    return () => {
      events.forEach(event => window.removeEventListener(event, check))
      window.removeEventListener('cms-auth-invalid', invalid)
      window.removeEventListener('cms-auth-expired', expired)
      window.removeEventListener('cms-auth-unavailable', unavailable)
      document.removeEventListener('visibilitychange', check)
      clearInterval(timer)
    }
  }
  async signInWithGoogle(redirectTo?: string): Promise<null> {
    const response = await this.fetchSession(`/api/session/login?next=${encodeURIComponent(redirectTo ?? '')}`, { method: 'POST' })
    if (!response.ok) throw new Error('Identity is temporarily unavailable. Your work is preserved.')
    const body = await response.json() as { url: string }
    const target = new URL(body.url)
    const expected = new URL(import.meta.env.VITE_SMZ_AUTH_ISSUER || 'http://localhost:3000/api/auth')
    if (target.origin !== expected.origin) throw new Error('Unexpected sign-in destination')
    window.location.assign(target.toString()); return null
  }
  signIn(_email: string, _password: string): Promise<null> { return this.signInWithGoogle() }
  async sendMagicLink(_email: string, redirectTo?: string): Promise<boolean> { await this.signInWithGoogle(redirectTo); return true }
  async verifyMagicLink(_token: string): Promise<AuthUser | null> { return (await this.completeSignIn()).user }
  async completeSignIn(): Promise<CompletedSignIn> {
    await this.revalidate()
    if (!this.user || this.status !== 'active') throw new Error('Reconnecting to Identity. Retry to complete sign-in.')
    // Only now remove the old browser credentials, after the server cookie is verified.
    for (const key of Object.keys(sessionStorage)) if (key.startsWith('oidc.') || key === 'email-cms-access-token') sessionStorage.removeItem(key)
    const next = new URLSearchParams(location.search).get('next')
    return { user: this.user, redirectTo: next?.startsWith('/') && !next.startsWith('//') && !next.includes('\\') ? next : undefined }
  }
  async clearSessionForGlobalLogout(): Promise<void> {
    localStorage.setItem(PENDING_LOGOUT, '1')
    this.clear()
    this.marker = crypto.randomUUID(); localStorage.setItem(MARKER, this.marker)
    const response = await this.fetchSession('/api/session/logout', { method: 'POST' })
    if (!response.ok) throw new Error('Server logout pending; it will retry when connected')
    localStorage.removeItem(PENDING_LOGOUT)
  }
  async signOut(): Promise<void> {
    try { await this.clearSessionForGlobalLogout() } finally {
      window.location.assign(new URL('/logout-all/email-cms-server', import.meta.env.VITE_SMZ_AUTH_ISSUER || 'http://localhost:3000/api/auth').toString())
    }
  }
  getCurrentUser(): AuthUser | null { return this.user }
  isAuthenticated(): boolean { return this.user !== null }
  onAuthStateChange(callback: (user: AuthUser | null) => void): () => void { this.listeners.add(callback); return () => { this.listeners.delete(callback) } }
  async getSession(): Promise<AuthSession | null> {
    return this.user ? { access_token: '', user: { id: this.user.id, email: this.user.email } } : null
  }
}
export const serverAuthService = new ServerAuthService()
