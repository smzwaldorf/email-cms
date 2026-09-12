import { handleSessionRequest } from '#/session/http'
import { withTransaction } from '#/lib/db'
import { canPerformCmsAction } from '@email-cms/shared'
import { isAllowedRpc } from '#/services/rpcPolicy'
import { cmsArticleService } from '#/services/cmsArticleService'
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { SupabaseClient } from '#/lib/supabase'
import { HttpError, optionalViewer, requireAdmin, requireViewer } from '#/auth'
import { getSupabaseClient } from '#/lib/supabase'
import { adminService } from '#/services/adminService'
import {
  backendEmailPlatformService,
} from '#/services/emailPlatform/backendEmailPlatformService'
import { emailTrackingEndpointService } from '#/services/emailTrackingEndpointService'
import { emailTemplateService } from '#/services/emailTemplateService'
import {
  listFileEmailTemplateSources,
  previewFileEmailTemplateSource,
} from '#/services/fileEmailTemplateLoader'
import { createDefaultFileEmailTemplateRenderContext } from '#/services/fileEmailTemplatePreviewContext'
import { newsletterDeliveryService } from '#/services/newsletterDeliveryService'
import { readerService } from '#/services/readerService'
import { runSerializedQuery, type SerializedQuery } from '#/lib/query'
import type { DeliveryAudienceSelection } from '#/types/emailDelivery'

export interface RouteContext {
  supabase: SupabaseClient
  corsOrigin: string
}

type RpcServiceName = 'admin' | 'emailTemplate' | 'newsletterDelivery' | 'fileEmailTemplate'

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object'
}

async function readText(request: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = []
  for await (const chunk of request) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk)
  }
  return chunks.length === 0 ? '' : Buffer.concat(chunks).toString('utf8')
}

async function readJson(request: IncomingMessage): Promise<unknown> {
  const raw = await readText(request)
  return raw.trim() ? JSON.parse(raw) as unknown : {}
}

function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined
}

function audienceFromBody(body: unknown): DeliveryAudienceSelection | undefined {
  if (!isRecord(body)) throw new HttpError(400, 'Invalid delivery request')
  const audience = body.audience
  if (audience === undefined) return undefined
  if (!isRecord(audience) || typeof audience.mode !== 'string' || !['all', 'classes', 'families', 'family'].includes(audience.mode)) {
    throw new HttpError(400, 'Invalid delivery audience')
  }
  if ((audience.mode === 'classes' && (!Array.isArray(audience.classIds) || !audience.classIds.length || audience.classIds.some(id => typeof id !== 'string' || !id))) ||
      (audience.mode === 'families' && (!Array.isArray(audience.familyIds) || !audience.familyIds.length || audience.familyIds.some(id => typeof id !== 'string' || !id))) ||
      (audience.mode === 'family' && !stringValue(audience.familyId))) {
    throw new HttpError(400, 'Audience selection requires explicit target IDs')
  }
  return {
    mode: audience.mode as DeliveryAudienceSelection['mode'],
    classIds: Array.isArray(audience.classIds) ? audience.classIds.filter((entry): entry is string => typeof entry === 'string') : undefined,
    familyIds: Array.isArray(audience.familyIds) ? audience.familyIds.filter((entry): entry is string => typeof entry === 'string') : undefined,
    familyId: stringValue(audience.familyId),
  }
}

function sendJson(response: ServerResponse, status: number, body: unknown, corsOrigin: string): void {
  response.writeHead(status, {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': corsOrigin,
    'Access-Control-Allow-Headers': 'Authorization, Content-Type, X-Kit-Webhook-Secret, X-Kit-Event-Id',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  })
  response.end(status === 204 ? undefined : JSON.stringify(body))
}

function sendText(
  response: ServerResponse,
  status: number,
  body: string,
  corsOrigin: string,
  headers: Record<string, string> = {},
): void {
  response.writeHead(status, {
    'Content-Type': 'text/plain; charset=utf-8',
    'Access-Control-Allow-Origin': corsOrigin,
    ...headers,
  })
  response.end(body)
}

function sendBinary(
  response: ServerResponse,
  status: number,
  body: Buffer,
  corsOrigin: string,
  headers: Record<string, string>,
): void {
  response.writeHead(status, {
    'Access-Control-Allow-Origin': corsOrigin,
    ...headers,
  })
  response.end(body)
}

function sendRedirect(response: ServerResponse, status: number, location: string, corsOrigin: string): void {
  response.writeHead(status, {
    Location: location,
    'Access-Control-Allow-Origin': corsOrigin,
  })
  response.end()
}

function firstHeaderValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value
}

function headersFromRequest(request: IncomingMessage): Headers {
  const headers = new Headers()
  for (const [name, value] of Object.entries(request.headers)) {
    if (Array.isArray(value)) {
      for (const entry of value) headers.append(name, entry)
    } else if (value !== undefined) {
      headers.set(name, value)
    }
  }
  return headers
}

function absoluteRequestUrl(request: IncomingMessage): string {
  const protocol = firstHeaderValue(request.headers['x-forwarded-proto']) ?? 'http'
  const host = request.headers.host ?? 'localhost'
  return `${protocol}://${host}${request.url ?? '/'}`
}

function requestMetadata(request: IncomingMessage): { userAgent?: string; ip?: string } {
  return {
    userAgent: firstHeaderValue(request.headers['user-agent']),
    ip: firstHeaderValue(request.headers['x-forwarded-for']),
  }
}

function isTrackingPixelPath(pathname: string): boolean {
  return pathname === '/api/tracking/pixel' || pathname === '/functions/v1/tracking-pixel'
}

function isTrackingClickPath(pathname: string): boolean {
  return pathname === '/api/tracking/click' || pathname === '/functions/v1/tracking-click'
}

function isKitWebhookPath(pathname: string): boolean {
  return pathname === '/api/webhooks/kit' || pathname === '/functions/v1/kit-webhook'
}

function getRpcService(name: RpcServiceName): unknown {
  if (name === 'admin') return adminService
  if (name === 'emailTemplate') return emailTemplateService
  if (name === 'newsletterDelivery') return newsletterDeliveryService
  return {
    listSources: listFileEmailTemplateSources,
    previewSource: (sourceId: string) =>
      previewFileEmailTemplateSource(sourceId, createDefaultFileEmailTemplateRenderContext()),
  }
}

async function handleRpc(body: unknown): Promise<unknown> {
  if (!isRecord(body)) {
    throw new HttpError(400, 'Invalid RPC body')
  }
  const serviceName = stringValue(body.service) as RpcServiceName | undefined
  const methodName = stringValue(body.method)
  const args = Array.isArray(body.args) ? body.args : []
  if (!serviceName || !['admin', 'emailTemplate', 'newsletterDelivery', 'fileEmailTemplate'].includes(serviceName)) {
    throw new HttpError(400, 'Invalid RPC service')
  }
  if (!methodName || !/^[A-Za-z][A-Za-z0-9_]*$/.test(methodName) || methodName === 'constructor') {
    throw new HttpError(400, 'Invalid RPC method')
  }

  if (!isAllowedRpc(serviceName, methodName)) throw new HttpError(403, 'RPC action is not permitted')
  const service = getRpcService(serviceName) as Record<string, unknown>
  const method = service[methodName]
  if (typeof method !== 'function') {
    throw new HttpError(404, `RPC method not found: ${serviceName}.${methodName}`)
  }

  return method.apply(service, args)
}

async function publishAndEnqueueDelivery(newsletterId: string, audience?: DeliveryAudienceSelection): Promise<unknown> {
  return withTransaction(async client => {
    const { rows } = await client.query<{ status: string; is_template: boolean }>(
      'SELECT status, is_template FROM newsletters WHERE id = $1 FOR UPDATE', [newsletterId],
    )
    if (!rows[0]) throw new HttpError(404, 'Newsletter not found')
    if (rows[0].status !== 'draft' || rows[0].is_template) throw new HttpError(409, 'Only draft newsletters can be published')
    const readiness = await adminService.getNewsletterPublishReadiness(newsletterId, audience)
    if (!readiness.canPublish || !readiness.audienceSummary) throw new HttpError(422, 'Newsletter or delivery audience is not ready')
    const newsletter = await adminService.publishNewsletter(newsletterId)
    const batch = await newsletterDeliveryService.createPublishBatch({ newsletterId, audience: audience ?? { mode: 'all' } })
    return { newsletter, batch }
  })
}

export async function handleApiRequest(
  request: IncomingMessage,
  response: ServerResponse,
  context: RouteContext,
): Promise<void> {
  if (request.method === 'OPTIONS') {
    sendJson(response, 204, null, context.corsOrigin)
    return
  }

  try {
    if (await handleSessionRequest(request, response)) return
    const url = new URL(request.url ?? '/', 'http://localhost')
    const method = request.method ?? 'GET'

    if (method === 'GET' && isTrackingPixelPath(url.pathname)) {
      const result = await emailTrackingEndpointService.handlePixel(
        url.searchParams.get('t'),
        requestMetadata(request),
      )
      sendBinary(response, result.status, result.body, context.corsOrigin, result.headers)
      return
    }

    if (method === 'GET' && isTrackingClickPath(url.pathname)) {
      const result = await emailTrackingEndpointService.handleClick(
        url.searchParams.get('t'),
        url.searchParams.get('url'),
        requestMetadata(request),
      )
      if (result.redirectUrl) {
        sendRedirect(response, result.status, result.redirectUrl, context.corsOrigin)
      } else {
        sendText(response, result.status, result.body ?? '', context.corsOrigin, result.headers)
      }
      return
    }

    if (method === 'POST' && isKitWebhookPath(url.pathname)) {
      const result = await backendEmailPlatformService.handleKitWebhook({
        rawBody: await readText(request),
        url: absoluteRequestUrl(request),
        headers: headersFromRequest(request),
      })
      sendJson(response, result.status, result.body, context.corsOrigin)
      return
    }

    if (method === 'GET' && url.pathname === '/api/auth/session') {
      const viewer = await requireViewer(request)
      sendJson(response, 200, {
        user: {
          id: viewer.id,
          email: viewer.email,
          role: viewer.role,
          roles: viewer.roles,
          teacherClassIds: viewer.teacherClassIds,
          parentClassIds: viewer.parentClassIds,
          display_name: viewer.displayName,
        },
      }, context.corsOrigin)
      return
    }

    const cmsArticleMatch = url.pathname.match(/^\/api\/cms\/articles\/([^/]+)$/)
    if (cmsArticleMatch && (method === 'GET' || method === 'PATCH')) {
      const viewer = await requireViewer(request)
      const id = decodeURIComponent(cmsArticleMatch[1])
      const result = method === 'GET'
        ? await cmsArticleService.read(id, viewer)
        : await cmsArticleService.update(id, await readJson(request), viewer)
      sendJson(response, 200, result, context.corsOrigin)
      return
    }

    if (method === 'POST' && url.pathname === '/api/data/query') {
      await requireAdmin(request)
      const body = await readJson(request)
      if (!isRecord(body) || typeof body.table !== 'string') {
        throw new HttpError(400, 'Invalid query body')
      }
      if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(body.table)) {
        throw new HttpError(400, 'Invalid table name')
      }
      const operators = ['eq', 'neq', 'in', 'is', 'gt', 'gte', 'lt', 'lte', 'ilike', 'like', 'not.is', 'not.in', 'or']
      if (body.filters !== undefined && (!Array.isArray(body.filters) || body.filters.some(filter =>
        !isRecord(filter) || typeof filter.op !== 'string' || !operators.includes(filter.op) || typeof filter.column !== 'string'))) {
        throw new HttpError(400, 'Invalid query filters')
      }
      // The compatibility gateway is CMS-admin-only and cannot alter identity or delivery state.
      const readTables = new Set(['articles', 'newsletters', 'newsletter_articles', 'classes', 'families',
        'students', 'user_roles', 'family_enrollment', 'student_class_enrollment', 'teacher_class_assignment',
        'article_categories', 'article_tags', 'article_category_assignments', 'article_tag_assignments',
        'media_files', 'media_usage', 'analytics_events', 'email_opens', 'email_clicks', 'auth_events'])
      const writeTables = new Set(['media_files', 'media_usage'])
      if (!readTables.has(body.table) || (body.mutation && !writeTables.has(body.table))) {
        throw new HttpError(403, 'Use an authorized CMS action for this table')
      }
      sendJson(response, 200, await runSerializedQuery(body as unknown as SerializedQuery), context.corsOrigin)
      return
    }

    if (method === 'GET' && url.pathname.startsWith('/api/reader/')) {
      const viewer = await optionalViewer(request)

      if (url.pathname === '/api/reader/weeks') {
        const { data, error } = await getSupabaseClient().from('newsletters').select('*')
          .eq('status', 'published').order('release_date', { ascending: false })
        if (error) throw new HttpError(500, 'Could not load published newsletters')
        sendJson(response, 200, data ?? [], context.corsOrigin)
        return
      }
      const weekMatch = url.pathname.match(/^\/api\/reader\/weeks\/([^/]+)$/)
      if (weekMatch?.[1]) {
        sendJson(
          response,
          200,
          await readerService.getWeekBundle(decodeURIComponent(weekMatch[1]), viewer),
          context.corsOrigin,
        )
        return
      }

      const articleMatch = url.pathname.match(/^\/api\/reader\/articles\/([^/]+)$/)
      if (articleMatch?.[1]) {
        sendJson(
          response,
          200,
          await readerService.getReaderArticle(
            decodeURIComponent(articleMatch[1]),
            url.searchParams.get('newsletterId') ?? undefined,
            viewer,
          ),
          context.corsOrigin,
        )
        return
      }

      throw new HttpError(404, 'Route not found')
    }

    if (!url.pathname.startsWith('/api/admin/')) {
      throw new HttpError(404, 'Route not found')
    }

    const admin = await requireViewer(request)
    if (!canPerformCmsAction(admin, 'cms:manage')) throw new HttpError(403, 'CMS management permission required')

    if (method === 'POST' && url.pathname === '/api/admin/batch-import-users') {
      const body = await readJson(request)
      if (!isRecord(body)) throw new HttpError(400, 'Invalid JSON body')
      throw new HttpError(403, 'Login identities and roles are managed in SMZ Auth')
      return
    }

    if (method === 'POST' && url.pathname === '/api/admin/permission-check') {
      throw new HttpError(410, 'Local role previews are retired; use live CMS session permissions')
    }

    if ((method === 'GET' || method === 'POST') && url.pathname === '/api/admin/email-platform/kit-sync-worker') {
      const body = method === 'POST' ? await readJson(request) : {}
      if (!isRecord(body)) throw new HttpError(400, 'Invalid JSON body')
      sendJson(response, 200, await backendEmailPlatformService.processSyncWorker(body), context.corsOrigin)
      return
    }

    if ((method === 'GET' || method === 'POST') && url.pathname === '/api/admin/email-platform/kit-reconcile') {
      const body = method === 'POST' ? await readJson(request) : {}
      if (!isRecord(body)) throw new HttpError(400, 'Invalid JSON body')
      sendJson(response, 200, await backendEmailPlatformService.reconcile(body), context.corsOrigin)
      return
    }

    if (method === 'POST' && url.pathname === '/api/admin/email-platform/kit-replay') {
      const body = await readJson(request)
      if (!isRecord(body)) throw new HttpError(400, 'Invalid JSON body')
      sendJson(response, 200, await backendEmailPlatformService.replay(body), context.corsOrigin)
      return
    }

    if (method === 'POST' && url.pathname === '/api/admin/rpc') {
      sendJson(response, 200, await handleRpc(await readJson(request)), context.corsOrigin)
      return
    }

    if (method === 'GET' && url.pathname === '/api/admin/email/file-template-sources') {
      sendJson(response, 200, listFileEmailTemplateSources(), context.corsOrigin)
      return
    }

    if (method === 'GET' && url.pathname === '/api/admin/access-control/auth-events') {
      const days = Number.parseInt(url.searchParams.get('days') ?? '7', 10)
      const since = new Date(Date.now() - (Number.isFinite(days) ? days : 7) * 24 * 60 * 60 * 1000).toISOString()
      let query = getSupabaseClient()
        .from('auth_events')
        .select('*')
        .gte('created_at', since)
        .order('created_at', { ascending: false })
        .limit(500)

      const authMethod = url.searchParams.get('authMethod')
      if (authMethod && authMethod !== 'all') {
        query = query.eq('auth_method', authMethod)
      }

      const eventType = url.searchParams.get('eventType')
      if (eventType && eventType !== 'all') {
        query = query.eq('event_type', eventType)
      }

      const { data, error } = await query
      if (error) {
        throw new HttpError(500, `Failed to fetch auth events: ${error.message}`)
      }
      sendJson(response, 200, data ?? [], context.corsOrigin)
      return
    }

    const filePreviewMatch = url.pathname.match(/^\/api\/admin\/email\/file-template-sources\/([^/]+)\/preview$/)
    if (method === 'GET' && filePreviewMatch?.[1]) {
      const preview = previewFileEmailTemplateSource(
        decodeURIComponent(filePreviewMatch[1]),
        createDefaultFileEmailTemplateRenderContext(),
      )
      if (!preview) throw new HttpError(404, 'File template source not found')
      sendJson(response, 200, preview, context.corsOrigin)
      return
    }

    const previewMatch = url.pathname.match(/^\/api\/admin\/newsletters\/([^/]+)\/preview-email$/)
    if (method === 'POST' && previewMatch?.[1]) {
      const body = await readJson(request)
      if (!isRecord(body)) throw new HttpError(400, 'Invalid JSON body')
      const familyId = stringValue(body.familyId)
      if (!familyId) throw new HttpError(400, 'familyId is required')
      const preview = await newsletterDeliveryService.previewPersonalizationForFamily({
        newsletterId: previewMatch[1],
        familyId,
        templateId: stringValue(body.templateId),
      })
      sendJson(response, 200, preview, context.corsOrigin)
      return
    }

    const publishMatch = url.pathname.match(/^\/api\/admin\/newsletters\/([^/]+)\/publish-and-deliver$/)
    if (method === 'POST' && publishMatch?.[1]) {
      const body = await readJson(request)
      const result = await publishAndEnqueueDelivery(publishMatch[1], audienceFromBody(body))
      sendJson(response, 202, result, context.corsOrigin)
      return
    }

    const readinessMatch = url.pathname.match(/^\/api\/admin\/newsletters\/([^/]+)\/publish-readiness$/)
    if (method === 'POST' && readinessMatch?.[1]) {
      const body = await readJson(request)
      const readiness = await adminService.getNewsletterPublishReadiness(readinessMatch[1], audienceFromBody(body))
      sendJson(response, 200, readiness, context.corsOrigin)
      return
    }

    const batchesMatch = url.pathname.match(/^\/api\/admin\/newsletters\/([^/]+)\/delivery-batches$/)
    if (method === 'GET' && batchesMatch?.[1]) {
      sendJson(response, 200, await adminService.fetchNewsletterDeliveryBatches(batchesMatch[1]), context.corsOrigin)
      return
    }

    const resendMatch = url.pathname.match(/^\/api\/admin\/delivery-batches\/([^/]+)\/resend$/)
    if (method === 'POST' && resendMatch?.[1]) {
      const body = await readJson(request)
      const batch = await newsletterDeliveryService.createResendBatch({
        parentBatchId: resendMatch[1],
        audience: audienceFromBody(body),
      })
      sendJson(response, 202, batch, context.corsOrigin)
      return
    }

    const recipientsMatch = url.pathname.match(/^\/api\/admin\/delivery-batches\/([^/]+)\/recipients$/)
    if (method === 'GET' && recipientsMatch?.[1]) {
      sendJson(response, 200, await adminService.fetchNewsletterDeliveryRecipients(recipientsMatch[1]), context.corsOrigin)
      return
    }

    throw new HttpError(404, 'Route not found')
  } catch (error) {
    const status = error instanceof HttpError ? error.status : 500
    const message = error instanceof Error ? error.message : String(error)
    sendJson(response, status, { error: message, code: error instanceof HttpError ? error.code : undefined }, context.corsOrigin)
  }
}
