import { randomUUID } from 'node:crypto'
import { canPerformCmsAction, cmsRoles, type CmsActor } from '@email-cms/shared'
import type { IncomingMessage } from 'node:http'
import { withClient } from '#/lib/db'

export type ViewerRole = 'admin' | 'teacher' | 'parent' | 'student'

export interface AuthenticatedAdmin {
  id: string
  email: string | null
}

export interface AuthenticatedViewer extends CmsActor {
  id: string
  email: string
  role: ViewerRole | null
  displayName: string | null
}

interface SmzAccessContext {
  sub: string
  clientId: string
  access: 'active'
  roles: string[]
  classScopes: { parent: string[]; teacher: string[]; effective: string[] }
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
  roles: ViewerRole[]
  classScopes: SmzAccessContext['classScopes']
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
    public readonly code?: string,
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

function stringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(item => typeof item === 'string' && item.length > 0)
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

  if (directoryResult.status >= 500 || userInfoResult.status >= 500) {
    throw new HttpError(503, 'SMZ Identity is unavailable')
  }
  if (directoryResult.status === 403 || userInfoResult.status === 403) {
    throw new HttpError(403, 'This identity does not have access to Email CMS', 'access_revoked')
  }
  if (directoryResult.status !== 200 || userInfoResult.status !== 200) {
    throw new HttpError(401, 'Invalid or expired SMZ Identity token')
  }

  const directory = directoryResult.body
  const userInfo = userInfoResult.body
  const email = typeof userInfo?.email === 'string' ? userInfo.email.trim().toLowerCase() : undefined
  if (
    !directory ||
    directory.clientId !== EMAIL_CMS_CLIENT_ID ||
    directory.access !== 'active' ||
    !userInfo ||
    typeof directory.sub !== 'string' || !directory.sub ||
    directory.sub !== userInfo.sub ||
    !stringArray(directory.roles) ||
    !directory.classScopes ||
    !stringArray(directory.classScopes.parent) ||
    !stringArray(directory.classScopes.teacher) ||
    !stringArray(directory.classScopes.effective) ||
    userInfo.email_verified !== true ||
    !email
  ) {
    throw new HttpError(401, 'SMZ Identity token has an invalid application or identity context')
  }

  return { issuer, subject: directory.sub, verifiedEmail: email, roles: cmsRoles(directory.roles), classScopes: directory.classScopes }
}

async function resolveLocalViewer(identity: SmzIdentity): Promise<AuthenticatedViewer> {
  return withClient(async (client) => {
    await client.query('BEGIN')
    try {
      // Serialize initial linking per verified email without changing existing issuer/subject links.
      await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [identity.verifiedEmail])
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
        if (matchingUsers.rows.length > 1) {
          throw new HttpError(409, 'Ambiguous Email CMS data association')
        }
        if (matchingUsers.rows.length === 0) {
          const created = await client.query<LocalViewerRow>(
            `INSERT INTO user_roles (id, email, role) VALUES ($1, $2, 'student')
             RETURNING id, email, role, display_name`,
            [randomUUID(), identity.verifiedEmail],
          )
          matchingUsers.rows.push(created.rows[0])
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
      const codes = [...new Set([...identity.classScopes.teacher, ...identity.classScopes.parent])]
      const classes = codes.length ? await client.query<{ id: string; class_code: string }>(
        'SELECT id, class_code FROM classes WHERE class_code = ANY($1::text[]) AND is_active = true', [codes],
      ) : { rows: [] }
      const mapCodes = (scope: string[]) => classes.rows.filter(row => scope.includes(row.class_code) && classes.rows.filter(candidate => candidate.class_code === row.class_code).length === 1).map(row => row.id)
      await client.query('COMMIT')
      return {
        id: row.id,
        email: row.email,
        role: identity.roles[0] ?? null,
        roles: identity.roles,
        teacherClassIds: mapCodes(identity.classScopes.teacher),
        parentClassIds: mapCodes(identity.classScopes.parent),
        displayName: row.display_name,
      }
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    }
  })
}

export async function viewerForToken(token: string): Promise<AuthenticatedViewer> {
  return resolveLocalViewer(await verifySmzAccessToken(token))
}

export async function requireViewer(request: IncomingMessage): Promise<AuthenticatedViewer> {
  return viewerForToken(readBearerToken(request))
}

export async function requireAdmin(request: IncomingMessage): Promise<AuthenticatedAdmin> {
  const viewer = await requireViewer(request)
  if (!canPerformCmsAction(viewer, 'cms:manage')) {
    throw new HttpError(403, 'Admin role required')
  }
  return { id: viewer.id, email: viewer.email }
}

export async function optionalViewer(request: IncomingMessage): Promise<AuthenticatedViewer | null> {
  const token = readOptionalBearerToken(request)
  return token ? viewerForToken(token) : null
}
