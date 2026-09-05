export class BackendApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public details?: unknown,
  ) {
    super(message)
    this.name = 'BackendApiError'
  }
}

export function backendBaseUrl(): string {
  const configured = import.meta.env.VITE_BACKEND_URL
  return (configured && configured.replace(/\/+$/, '')) || 'http://localhost:8787'
}

export function getAccessTokenOrNull(): string | null {
  if (typeof window === 'undefined') return null
  return window.localStorage.getItem('email-cms-access-token')
}

export function setAccessToken(token: string | null): void {
  if (typeof window === 'undefined') return
  if (token) window.localStorage.setItem('email-cms-access-token', token)
  else window.localStorage.removeItem('email-cms-access-token')
}

export interface StoredAuthUser {
  id: string
  email: string
}

export function getStoredAuthUser(): StoredAuthUser | null {
  if (typeof window === 'undefined') return null
  const value = window.sessionStorage.getItem('email-cms-auth-user')
  if (!value) return null
  try {
    const parsed = JSON.parse(value) as Partial<StoredAuthUser>
    return typeof parsed.id === 'string' && typeof parsed.email === 'string'
      ? { id: parsed.id, email: parsed.email }
      : null
  } catch {
    return null
  }
}

export function setStoredAuthUser(user: StoredAuthUser | null): void {
  if (typeof window === 'undefined') return
  if (user) window.sessionStorage.setItem('email-cms-auth-user', JSON.stringify(user))
  else window.sessionStorage.removeItem('email-cms-auth-user')
}

async function parseResponseBody(response: Response): Promise<unknown> {
  const text = await response.text()
  if (!text.trim()) return null
  try {
    return JSON.parse(text) as unknown
  } catch {
    return text
  }
}

export async function requestBackend<T>(
  path: string,
  init: RequestInit = {},
  token: string | null = getAccessTokenOrNull(),
): Promise<T> {
  const response = await fetch(`${backendBaseUrl()}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
  })
  const body = await parseResponseBody(response)
  if (!response.ok) {
    const code = body && typeof body === 'object' && 'code' in body ? body.code : undefined
    if (response.status === 401 || (response.status === 403 && code === 'access_revoked')) {
      setAccessToken(null)
      setStoredAuthUser(null)
      window.dispatchEvent(new Event('cms-auth-invalid'))
    }
    const message = body && typeof body === 'object' && 'error' in body
      ? String((body as { error: unknown }).error)
      : `Backend API request failed with status ${response.status}`
    throw new BackendApiError(message, response.status, body)
  }
  return body as T
}
