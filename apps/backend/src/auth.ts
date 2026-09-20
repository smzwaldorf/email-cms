import { cookieViewer, serverSessionsEnabled, sessionId } from '#/session/http'
import { identityFetch, runtimeEnvironment } from '#/runtime/environment'
import { classAliases } from '#/services/identityDirectory'
import { canPerformCmsAction, cmsRoles, type CmsActor } from '@email-cms/shared'
import type { IncomingMessage } from 'node:http'
import type { PoolClient, QueryResult } from 'pg'
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
  emailVerified?: boolean
}

export interface SmzDirectoryFamily {
  id: string
  code: string
  displayName: string
}

export interface SmzDirectoryPerson {
  id: string
  displayName: string
  kind: 'adult' | 'student'
}

export interface SmzDirectoryClass {
  id: string
  code: string
  displayName: string
}

export type SmzDirectoryFamilyRelationship = 'father' | 'mother' | 'guardian' | 'child'
export type SmzDirectoryClassRelationship = 'teacher' | 'student'

export interface SmzDirectoryFamilyMembership {
  familyId: string
  personId: string
  relationship: SmzDirectoryFamilyRelationship
}

export interface SmzDirectoryClassMembership {
  classId: string
  personId: string
  relationship: SmzDirectoryClassRelationship
}

export interface SmzDirectoryGraph {
  people: SmzDirectoryPerson[]
  families: SmzDirectoryFamily[]
  classes: SmzDirectoryClass[]
  familyMemberships: SmzDirectoryFamilyMembership[]
  classMemberships: SmzDirectoryClassMembership[]
}

interface SmzDirectoryContext {
  directory?: unknown
}

interface SmzIdentity {
  issuer: string
  subject: string
  verifiedEmail: string
  roles: ViewerRole[]
  classScopes: SmzAccessContext['classScopes']
}


const EMAIL_CMS_CLIENT_ID = 'email-cms'
const EMAIL_CMS_CLIENT_IDS = new Set(['email-cms', 'email-cms-server'])

function acceptsCmsClient(directoryClientId: string, requestedClientId: string): boolean {
  if (directoryClientId === requestedClientId) return true
  return EMAIL_CMS_CLIENT_IDS.has(directoryClientId) && EMAIL_CMS_CLIENT_IDS.has(requestedClientId)
}

function emailVerified(userInfo: SmzUserInfo): boolean {
  return userInfo.email_verified === true || userInfo.emailVerified === true
}

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
  const configured = runtimeEnvironment().SMZ_AUTH_ISSUER ?? 'http://localhost:3000/api/auth'
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

function invalidDirectoryResponse(): never {
  throw new HttpError(502, 'SMZ Identity returned an invalid directory response', 'identity_invalid_directory_response')
}

function directoryString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0
}

function directoryGraph(value: unknown): SmzDirectoryGraph {
  if (!value || typeof value !== 'object') return invalidDirectoryResponse()
  const graph = value as Record<string, unknown>
  const people = graph.people
  const families = graph.families
  const classes = graph.classes
  const familyMemberships = graph.familyMemberships
  const classMemberships = graph.classMemberships
  if (!Array.isArray(people) || !Array.isArray(families) || !Array.isArray(classes) || !Array.isArray(familyMemberships) || !Array.isArray(classMemberships)) {
    return invalidDirectoryResponse()
  }

  if (people.some((person) => {
    if (!person || typeof person !== 'object') return true
    const row = person as Record<string, unknown>
    return !directoryString(row.id) || !directoryString(row.displayName) || (row.kind !== 'adult' && row.kind !== 'student')
  })) return invalidDirectoryResponse()
  if (families.some((family) => {
    if (!family || typeof family !== 'object') return true
    const row = family as Record<string, unknown>
    return !directoryString(row.id) || !directoryString(row.code) || !directoryString(row.displayName)
  })) return invalidDirectoryResponse()
  if (classes.some((schoolClass) => {
    if (!schoolClass || typeof schoolClass !== 'object') return true
    const row = schoolClass as Record<string, unknown>
    return !directoryString(row.id) || !directoryString(row.code) || !directoryString(row.displayName)
  })) return invalidDirectoryResponse()
  if (familyMemberships.some((membership) => {
    if (!membership || typeof membership !== 'object') return true
    const row = membership as Record<string, unknown>
    return !directoryString(row.familyId) || !directoryString(row.personId) ||
      !['father', 'mother', 'guardian', 'child'].includes(String(row.relationship))
  })) return invalidDirectoryResponse()
  if (classMemberships.some((membership) => {
    if (!membership || typeof membership !== 'object') return true
    const row = membership as Record<string, unknown>
    return !directoryString(row.classId) || !directoryString(row.personId) ||
      !['teacher', 'student'].includes(String(row.relationship))
  })) return invalidDirectoryResponse()

  return {
    people: people as SmzDirectoryPerson[],
    families: families as SmzDirectoryFamily[],
    classes: classes as SmzDirectoryClass[],
    familyMemberships: familyMemberships as SmzDirectoryFamilyMembership[],
    classMemberships: classMemberships as SmzDirectoryClassMembership[],
  }
}

async function identityAttempt<T>(url: string, token: string): Promise<{ status: number; body: T | null }> {
  const response = await identityFetch(url, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    signal: AbortSignal.timeout(10_000),
  })
  let body: T | null = null
  try {
    body = await response.json() as T
  } catch {
    // Status handling below deliberately does not expose the identity service response.
  }
  return { status: response.status, body }
}

async function identityRequest<T>(url: string, token: string): Promise<{ status: number; body: T | null }> {
  // One retry absorbs a transport blip or an upstream 5xx. Authorization
  // decisions (401/403) are returned unchanged and never retried.
  for (let attempt = 0; ; attempt++) {
    try {
      const result = await identityAttempt<T>(url, token)
      if (result.status < 500 || attempt === 1) return result
    } catch (error) {
      if (attempt === 1) {
        console.warn('SMZ identity transport failed', { url, message: error instanceof Error ? error.message : 'unknown' })
        throw new HttpError(503, 'SMZ Identity is unavailable')
      }
    }
    await new Promise(resolve => setTimeout(resolve, 250))
  }
}

export async function verifySmzAccessToken(token: string, clientId = EMAIL_CMS_CLIENT_ID, subject?: string): Promise<SmzIdentity> {
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
  if (directoryResult.status === 401 && (directoryResult.body as { error?: string } | null)?.error === 'session_expired') {
    throw new HttpError(401, 'Please verify your identity to resume', 'session_expired')
  }
  if (directoryResult.status === 403 && (directoryResult.body as { error?: string } | null)?.error === 'access_revoked') {
    throw new HttpError(403, 'This identity does not have access to Email CMS', 'access_revoked')
  }
  if (directoryResult.status === 403 || userInfoResult.status === 403) throw new HttpError(403, 'Identity permission denied')
  if (directoryResult.status !== 200 || userInfoResult.status !== 200) {
    console.warn('SMZ identity verification failed', {
      directoryStatus: directoryResult.status,
      userInfoStatus: userInfoResult.status,
      directoryError: (directoryResult.body as { error?: string } | null)?.error ?? null,
      userInfoError: (userInfoResult.body as { error?: string } | null)?.error ?? null,
    })
    throw new HttpError(401, 'Invalid or expired SMZ Identity token')
  }

  const directory = directoryResult.body
  const userInfo = userInfoResult.body
  const email = typeof userInfo?.email === 'string' ? userInfo.email.trim().toLowerCase() : undefined
  if (
    !directory ||
    !acceptsCmsClient(directory.clientId, clientId) ||
    directory.access !== 'active' ||
    !userInfo ||
    (subject !== undefined && directory.sub !== subject) ||
    typeof directory.sub !== 'string' || !directory.sub ||
    directory.sub !== userInfo.sub ||
    !stringArray(directory.roles) ||
    !directory.classScopes ||
    !stringArray(directory.classScopes.parent) ||
    !stringArray(directory.classScopes.teacher) ||
    !stringArray(directory.classScopes.effective) ||
    !emailVerified(userInfo) ||
    !email
  ) {
    console.warn('SMZ identity context rejected', {
      clientId: directory?.clientId ?? null,
      requestedClientId: clientId,
      access: directory?.access ?? null,
      sub: directory?.sub ?? null,
      userInfoSub: userInfo?.sub ?? null,
      emailVerified: userInfo ? emailVerified(userInfo) : false,
      hasEmail: Boolean(email),
      hasRoles: Boolean(directory && stringArray(directory.roles)),
      hasClassScopes: Boolean(directory?.classScopes),
    })
    throw new HttpError(401, 'SMZ Identity token has an invalid application or identity context')
  }

  return { issuer, subject: directory.sub, verifiedEmail: email, roles: cmsRoles(directory.roles), classScopes: directory.classScopes }
}

/**
 * Returns only the scoped family catalogue needed by the CMS preview selector.
 * The caller keeps the Identity token server-side; no credential is returned
 * to the browser.
 */
export async function directoryFamiliesForToken(
  token: string,
  clientId = EMAIL_CMS_CLIENT_ID,
  subject?: string,
): Promise<SmzDirectoryFamily[]> {
  return (await directoryForToken(token, clientId, subject)).families
}

/**
 * Fetches the already-scoped Identity directory graph for internal preview
 * composition. The bearer credential is never returned to the browser.
 */
/** Reads the scoped graph for an already-verified token. */
async function fetchDirectoryGraph(token: string): Promise<SmzDirectoryGraph> {
  const result = await identityRequest<SmzDirectoryContext>(
    new URL('/api/directory/v1/me/directory', authIssuer()).toString(),
    token,
  )
  if (result.status >= 500) throw new HttpError(503, 'SMZ Identity is unavailable')
  if (result.status === 401) throw new HttpError(401, 'Please verify your identity to resume', 'session_expired')
  if (result.status === 403) throw new HttpError(403, 'This identity does not have access to Email CMS', 'access_revoked')
  if (result.status !== 200 || !result.body) throw new HttpError(401, 'Invalid or expired SMZ Identity token')
  return directoryGraph(result.body.directory)
}

export async function directoryForToken(
  token: string,
  clientId = EMAIL_CMS_CLIENT_ID,
  subject?: string,
): Promise<SmzDirectoryGraph> {
  await verifySmzAccessToken(token, clientId, subject)
  return fetchDirectoryGraph(token)
}

const LINK_LOCAL_ACTOR = `INSERT INTO user_auth_identities (issuer, subject, user_id) VALUES ($1,$2,$3) ON CONFLICT (issuer,subject) DO UPDATE SET subject=EXCLUDED.subject RETURNING user_id`

/**
 * Deployments that still carry the local actor table keep a foreign key on the
 * identity link. The anchor row holds no authority; Auth roles decide every
 * request. A verified email may adopt one historical actor, but a conflicting
 * link stops instead of rewriting an existing association.
 */
async function anchorLocalActor(client: PoolClient, identity: SmzIdentity): Promise<string> {
  const matches = await client.query<{ id: string }>('SELECT id FROM user_roles WHERE lower(email)=$1', [identity.verifiedEmail])
  if (matches.rows.length > 1) throw new HttpError(403, 'This Email CMS identity could not be associated')
  const actor = matches.rows[0]
  if (!actor) {
    await client.query(`INSERT INTO user_roles (id, email, role) VALUES ($1,$2,'student') ON CONFLICT (id) DO NOTHING`, [identity.subject, identity.verifiedEmail])
    return identity.subject
  }
  const linked = await client.query<{ subject: string }>('SELECT subject FROM user_auth_identities WHERE issuer=$1 AND user_id=$2', [identity.issuer, actor.id])
  if (linked.rows.some(row => row.subject !== identity.subject)) {
    throw new HttpError(403, 'This Email CMS actor is already linked to a different central identity', 'identity_link_conflict')
  }
  return actor.id
}

async function resolveLocalViewer(identity: SmzIdentity, directory: SmzDirectoryGraph): Promise<AuthenticatedViewer> {
  return withClient(async client => {
    let result: QueryResult<{ user_id: string }>
    try {
      result = await client.query<{user_id:string}>(LINK_LOCAL_ACTOR, [identity.issuer, identity.subject, identity.subject])
    } catch (error) {
      if ((error as { code?: string }).code !== '23503') throw error
      result = await client.query<{user_id:string}>(LINK_LOCAL_ACTOR, [identity.issuer, identity.subject, await anchorLocalActor(client, identity)])
    }
    const row = result.rows[0]
    if (!row) throw new HttpError(403, 'This Email CMS identity could not be associated')
    const aliases = await classAliases(directory)
    const mapCodes = (codes:string[]) => aliases.filter(c => codes.includes(c.code)).map(c => c.id)
    return { id: row.user_id, email: identity.verifiedEmail, role: identity.roles[0] ?? null, roles:identity.roles,
      teacherClassIds:mapCodes(identity.classScopes.teacher), parentClassIds:mapCodes(identity.classScopes.parent), displayName:directory.people.find(p => p.id===identity.subject)?.displayName ?? null }
  })
}

/**
 * Verifies the token once and reuses that verification for the directory read.
 * Callers that need both must not pay for a second admission round trip.
 */
export async function viewerAndDirectoryForToken(
  token: string,
  clientId = EMAIL_CMS_CLIENT_ID,
  subject?: string,
): Promise<{ viewer: AuthenticatedViewer; directory: SmzDirectoryGraph }> {
  const identity = await verifySmzAccessToken(token, clientId, subject)
  const directory = await fetchDirectoryGraph(token)
  return { viewer: await resolveLocalViewer(identity, directory), directory }
}

export async function viewerForToken(token: string, clientId = EMAIL_CMS_CLIENT_ID, subject?: string): Promise<AuthenticatedViewer> {
  return (await viewerAndDirectoryForToken(token, clientId, subject)).viewer
}

export async function requireViewer(request: IncomingMessage): Promise<AuthenticatedViewer> {
  if (serverSessionsEnabled() && sessionId(request)) return cookieViewer(request)
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
  if (serverSessionsEnabled() && sessionId(request)) return cookieViewer(request)
  const token = readOptionalBearerToken(request)
  return token ? viewerForToken(token) : null
}

export async function deliveryContactsForToken(token:string, subject:string) {
 await verifySmzAccessToken(token, 'email-cms-server', subject)
 const result=await identityRequest<{contractVersion:number;contacts:import('#/services/identityDirectory').DeliveryContact[]}>(new URL('/api/directory/v1/me/delivery-contacts',authIssuer()).toString(),token)
 if(result.status===401 || result.status===403) throw new HttpError(result.status,'Delivery authorization expired or revoked')
 if(result.status!==200 || result.body?.contractVersion!==1 || !Array.isArray(result.body.contacts)) throw new HttpError(503,'Authorized delivery contacts unavailable')
 for(const c of result.body.contacts) {
  if(!c || typeof c !== 'object' || typeof c.personId!=='string' || typeof c.displayName!=='string' || typeof c.email!=='string' || !c.email.includes('@') || !Array.isArray(c.families) || c.families.some(f=>!f || typeof f !== 'object' || typeof f.familyId!=='string' || typeof f.familyCode!=='string' || !Array.isArray(f.classCodes) || f.classCodes.some(code=>typeof code!=='string') || !Array.isArray(f.classIds) || f.classIds.some(id=>typeof id!=='string'))) throw new HttpError(502,'Invalid delivery contact response')
 }
 return result.body.contacts
}
