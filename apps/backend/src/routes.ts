import type { IncomingMessage, ServerResponse } from 'node:http'
import type { SupabaseClient } from '@supabase/supabase-js'
import { HttpError, requireAdmin } from '#/auth'
import { getSupabaseClient } from '#/lib/supabase'
import { adminService } from '#/services/adminService'
import { batchUserImportService } from '#/services/batchUserImportService'
import {
  backendEmailPlatformService,
  type SendNewsletterRecipientInput,
} from '#/services/emailPlatform/backendEmailPlatformService'
import { emailTrackingEndpointService } from '#/services/emailTrackingEndpointService'
import { emailTemplateService } from '#/services/emailTemplateService'
import {
  listFileEmailTemplateSources,
  previewFileEmailTemplateSource,
} from '#/services/fileEmailTemplateLoader'
import { createDefaultFileEmailTemplateRenderContext } from '#/services/fileEmailTemplatePreviewContext'
import { newsletterDeliveryService } from '#/services/newsletterDeliveryService'
import { permissionCheckService, type PermissionAction } from '#/services/permissionCheckService'
import type { DeliveryAudienceSelection } from '#/types/emailDelivery'

interface RouteContext {
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
  const audience = isRecord(body) ? body.audience : undefined
  if (!isRecord(audience) || typeof audience.mode !== 'string') return undefined
  if (!['all', 'classes', 'families', 'family'].includes(audience.mode)) return undefined
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

  const service = getRpcService(serviceName) as Record<string, unknown>
  const method = service[methodName]
  if (typeof method !== 'function') {
    throw new HttpError(404, `RPC method not found: ${serviceName}.${methodName}`)
  }

  return method.apply(service, args)
}

async function publishAndEnqueueDelivery(newsletterId: string, audience?: DeliveryAudienceSelection): Promise<unknown> {
  const newsletter = await adminService.publishNewsletter(newsletterId)
  try {
    const batch = await newsletterDeliveryService.createPublishBatch({
      newsletterId,
      audience: audience ?? { mode: 'all' },
    })
    return { newsletter, batch }
  } catch (error) {
    const { error: rollbackError } = await getSupabaseClient()
      .from('newsletters')
      .update({ status: 'draft', published_at: null })
      .eq('id', newsletterId)
    if (rollbackError) {
      throw new HttpError(
        500,
        `Delivery batch creation failed and rollback failed: ${rollbackError.message}`,
      )
    }
    throw error
  }
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

    if (!url.pathname.startsWith('/api/admin/')) {
      throw new HttpError(404, 'Route not found')
    }

    await requireAdmin(request, context.supabase)

    if (method === 'POST' && url.pathname === '/api/admin/batch-import-users') {
      const body = await readJson(request)
      if (!isRecord(body)) throw new HttpError(400, 'Invalid JSON body')
      sendJson(response, 200, await batchUserImportService.importUsers(body.rows), context.corsOrigin)
      return
    }

    if (method === 'POST' && url.pathname === '/api/admin/permission-check') {
      const body = await readJson(request)
      if (!isRecord(body)) throw new HttpError(400, 'Invalid JSON body')
      const userId = stringValue(body.userId)
      const action = stringValue(body.action)
      const resource = stringValue(body.resource)
      if (!userId || !action || !resource) {
        throw new HttpError(400, 'Missing required fields: userId, action, resource')
      }
      if (!['view', 'edit', 'delete', 'admin'].includes(action)) {
        throw new HttpError(400, 'Invalid permission action')
      }
      sendJson(
        response,
        200,
        await permissionCheckService.checkPermission(userId, action as PermissionAction, resource),
        context.corsOrigin,
      )
      return
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

    if (method === 'POST' && url.pathname === '/api/admin/email-platform/kit-send-newsletter') {
      const body = await readJson(request)
      if (!isRecord(body)) throw new HttpError(400, 'Invalid JSON body')
      sendJson(
        response,
        200,
        await backendEmailPlatformService.sendNewsletter({
          batchId: stringValue(body.batchId) ?? '',
          newsletterId: stringValue(body.newsletterId) ?? '',
          recipients: Array.isArray(body.recipients) ? body.recipients as SendNewsletterRecipientInput[] : [],
        }),
        context.corsOrigin,
      )
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
    sendJson(response, status, { error: message }, context.corsOrigin)
  }
}
