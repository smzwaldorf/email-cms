import { UserManager, WebStorageStateStore, type User } from 'oidc-client-ts'

export function smzDirectoryResource(): string {
  return new URL('/api/directory/v1', smzAuthIssuer()).toString()
}
const directoryResource = smzDirectoryResource()

export function smzAuthIssuer(): string {
  return (import.meta.env.VITE_SMZ_AUTH_ISSUER || 'http://localhost:3000/api/auth').replace(/\/+$/, '')
}

function appOrigin(): string {
  return (import.meta.env.VITE_APP_URL || window.location.origin).replace(/\/+$/, '')
}

export function redirectToGlobalSignOut(): void {
  window.location.assign(new URL('/logout-all/email-cms', smzAuthIssuer()).toString())
}

export const smzAuth = new UserManager({
  authority: smzAuthIssuer(),
  client_id: 'email-cms',
  redirect_uri: `${appOrigin()}/auth/callback`,
  post_logout_redirect_uri: `${appOrigin()}/login`,
  response_type: 'code',
  scope: 'openid profile email directory:access offline_access',
  resource: directoryResource,
  extraTokenParams: { resource: directoryResource },
  loadUserInfo: true,
  automaticSilentRenew: false,
  revokeTokensOnSignout: true,
  userStore: new WebStorageStateStore({ store: window.sessionStorage }),
  stateStore: new WebStorageStateStore({ store: window.sessionStorage }),
})

export interface SmzSignInState {
  redirectTo?: string
}

export function redirectFromSmzUser(user: User): string | undefined {
  const state = user.state as SmzSignInState | undefined
  return typeof state?.redirectTo === 'string' ? state.redirectTo : undefined
}

export async function refreshSmzUser(): Promise<User | null> {
  const current = await smzAuth.getUser()
  if (!current) return null
  if (!current.expired) return current
  return smzAuth.signinSilent({
    resource: directoryResource,
    extraTokenParams: { resource: directoryResource },
  })
}
