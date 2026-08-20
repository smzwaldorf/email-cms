import type { IncomingMessage } from 'node:http'
import { withClient } from '#/lib/db'

export type ViewerRole = 'admin' | 'teacher' | 'parent' | 'student'

export interface AuthenticatedAdmin {
  id: string
  email: string | null
}

export interface AuthenticatedViewer {
  id: string
  email: string
  role: ViewerRole
  displayName: string | null
}

interface SmzAccessContext {
  sub: string
  clientId: string
  access: 'active'
  roles: string[]
}

interface SmzUserInfo {
  sub: string
  email?: string
  email_verified?: boolean
}

interface SmzIdentity {
  issuer: string
  subject: string
  verifiedEmail: string
}

interface LocalViewerRow {
  id: string
  email: string
  role: string
  display_name: string | null
}

const EMAIL_CMS_CLIENT_ID = 'email-cms'

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message)
    this.name = 'HttpError'
  }
}

function authIssuer(): string {
  const configured = process.env.SMZ_AUTH_ISSUER ?? 'http://localhost:3000/api/auth'
  try {
    return new URL(configured).toString().replace(/\/$/, '')
  } catch {
    throw new Error('SMZ_AUTH_ISSUER must be an absolute URL')
  }
}

function readOptionalBearerToken(request: IncomingMessage): string | null {
  const authorization = request.headers.authorization
  if (!authorization) return null
  const match = authorization.match(/^Bearer\s+(.+)$/i)
  if (!match?.[1]) {
    throw new HttpError(401, 'Invalid authorization header')
  }
  return match[1]
}

function readBearerToken(request: IncomingMessage): string {
  const token = readOptionalBearerToken(request)
  if (!token) {
    throw new HttpError(401, 'Missing bearer token')
  }
  return token
}

function asViewerRole(role: unknown): ViewerRole {
  if (role === 'admin' || role === 'teacher' || role === 'parent' || role === 'student') {
    return role
  }
  return 'student'
}

async function identityRequest<T>(url: string, token: string): Promise<{ status: number; body: T | null }> {
  let response: Response
  try {
    response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(5_000),
    })
  } catch {
    throw new HttpError(503, 'SMZ Identity is unavailable')
  }

  let body: T | null = null
  try {
    body = await response.json() as T
  } catch {
    // Status handling below deliberately does not expose the identity service response.
  }
  return { status: response.status, body }
}

export async function verifySmzAccessToken(token: string): Promise<SmzIdentity> {
  const issuer = authIssuer()
  const directoryUrl = new URL('/api/directory/v1/me/access-context', issuer).toString()
  const userInfoUrl = `${issuer}/oauth2/userinfo`
  const [directoryResult, userInfoResult] = await Promise.all([
    identityRequest<SmzAccessContext>(directoryUrl, token),
    identityRequest<SmzUserInfo>(userInfoUrl, token),
  ])

  if (directoryResult.status === 403) {
    throw new HttpError(403, 'This identity does not have access to Email CMS')
  }
  if (directoryResult.status !== 200 || userInfoResult.status !== 200) {
    throw new HttpError(401, 'Invalid or expired SMZ Identity token')
  }

  const directory = directoryResult.body
  const userInfo = userInfoResult.body
  const email = userInfo?.email?.trim().toLowerCase()
  if (
    !directory ||
    directory.clientId !== EMAIL_CMS_CLIENT_ID ||
    directory.access !== 'active' ||
    !userInfo ||
    directory.sub !== userInfo.sub ||
    userInfo.email_verified !== true ||
    !email
  ) {
    throw new HttpError(401, 'SMZ Identity token has an invalid application or identity context')
  }

  return { issuer, subject: directory.sub, verifiedEmail: email }
}

async function resolveLocalViewer(identity: SmzIdentity): Promise<AuthenticatedViewer> {
  return withClient(async (client) => {
    await client.query('BEGIN')
    try {
      let result = await client.query<LocalViewerRow>(
        `SELECT ur.id, ur.email, ur.role, ur.display_name
         FROM user_auth_identities AS identity
         INNER JOIN user_roles AS ur ON ur.id = identity.user_id
         WHERE identity.issuer = $1 AND identity.subject = $2
         LIMIT 1`,
        [identity.issuer, identity.subject],
      )

      if (!result.rows[0]) {
        const matchingUsers = await client.query<LocalViewerRow>(
          `SELECT id, email, role, display_name
           FROM user_roles
           WHERE lower(email) = $1
           LIMIT 2`,
          [identity.verifiedEmail],
        )
        if (matchingUsers.rows.length !== 1) {
          throw new HttpError(403, 'No Email CMS user is linked to this SMZ identity')
        }

        await client.query(
          `INSERT INTO user_auth_identities (issuer, subject, user_id)
           VALUES ($1, $2, $3)
           ON CONFLICT DO NOTHING`,
          [identity.issuer, identity.subject, matchingUsers.rows[0].id],
        )
        result = await client.query<LocalViewerRow>(
          `SELECT ur.id, ur.email, ur.role, ur.display_name
           FROM user_auth_identities AS identity
           INNER JOIN user_roles AS ur ON ur.id = identity.user_id
           WHERE identity.issuer = $1 AND identity.subject = $2
           LIMIT 1`,
          [identity.issuer, identity.subject],
        )
      }

      const row = result.rows[0]
      if (!row) {
        throw new HttpError(403, 'This Email CMS user is already linked to another SMZ identity')
      }
      await client.query('COMMIT')
      return {
        id: row.id,
        email: row.email,
        role: asViewerRole(row.role),
        displayName: row.display_name,
      }
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    }
  })
}

async function viewerForToken(token: string): Promise<AuthenticatedViewer> {
  return resolveLocalViewer(await verifySmzAccessToken(token))
}

export async function requireViewer(request: IncomingMessage): Promise<AuthenticatedViewer> {
  return viewerForToken(readBearerToken(request))
}

export async function requireAdmin(request: IncomingMessage): Promise<AuthenticatedAdmin> {
  const viewer = await requireViewer(request)
  if (viewer.role !== 'admin') {
    throw new HttpError(403, 'Admin role required')
  }
  return { id: viewer.id, email: viewer.email }
}

export async function optionalViewer(request: IncomingMessage): Promise<AuthenticatedViewer | null> {
  const token = readOptionalBearerToken(request)
  return token ? viewerForToken(token) : null
}
