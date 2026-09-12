import { runtimeEnvironment } from '#/runtime/environment'
import { createHmac, timingSafeEqual } from 'node:crypto'

import { getSupabaseClient } from '#/lib/supabase'

const TRANSPARENT_GIF = Buffer.from([
  0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x01, 0x00, 0x01, 0x00, 0x80, 0x00, 0x00, 0xff, 0xff, 0xff,
  0x00, 0x00, 0x00, 0x2c, 0x00, 0x00, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0x02, 0x02, 0x44,
  0x01, 0x00, 0x3b,
])

interface TrackingPayload {
  sub: string
  nwl: string
  jti: string
  exp?: number
}

export interface TrackingRequestMetadata {
  userAgent?: string | null
  ip?: string | null
}

export interface PixelResponse {
  status: number
  body: Buffer
  headers: Record<string, string>
}

export interface ClickResponse {
  status: number
  body?: string
  redirectUrl?: string
  headers?: Record<string, string>
}

function gifResponse(): PixelResponse {
  return {
    status: 200,
    body: TRANSPARENT_GIF,
    headers: {
      'Content-Type': 'image/gif',
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
    },
  }
}

function base64UrlDecode(value: string): Buffer {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/')
  const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), '=')
  return Buffer.from(padded, 'base64')
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object'
}

function isValidPayload(payload: unknown): payload is TrackingPayload {
  if (!isRecord(payload)) return false
  return (
    typeof payload.sub === 'string' &&
    payload.sub.length > 0 &&
    typeof payload.nwl === 'string' &&
    payload.nwl.length > 0 &&
    typeof payload.jti === 'string' &&
    payload.jti.length > 0 &&
    (payload.exp === undefined || typeof payload.exp === 'number')
  )
}

function isValidRedirectUrl(targetUrl: string): boolean {
  try {
    const parsed = new URL(targetUrl)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}

function getJwtSecret(): string {
  const secret = runtimeEnvironment().JWT_SECRET ?? runtimeEnvironment().VITE_JWT_SECRET
  if (!secret) {
    throw new Error('Missing JWT_SECRET configuration')
  }
  return secret
}

function verifyToken(token: string): TrackingPayload | null {
  const parts = token.split('.')
  if (parts.length !== 3) return null
  const [encodedHeader, encodedPayload, encodedSignature] = parts
  const header = JSON.parse(base64UrlDecode(encodedHeader).toString('utf8')) as Record<string, unknown>
  if (header.alg !== 'HS256') return null

  const expectedSignature = createHmac('sha256', getJwtSecret())
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest()
  const actualSignature = base64UrlDecode(encodedSignature)
  if (
    actualSignature.length !== expectedSignature.length ||
    !timingSafeEqual(actualSignature, expectedSignature)
  ) {
    return null
  }

  const payload = JSON.parse(base64UrlDecode(encodedPayload).toString('utf8')) as unknown
  if (!isValidPayload(payload)) return null
  if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null
  return payload
}

async function hasRecentEvent(input: {
  eventType: 'email_open' | 'link_click'
  userId: string
  newsletterId: string
  targetUrl?: string
}): Promise<boolean> {
  let query = getSupabaseClient()
    .from('analytics_events')
    .select('*', { count: 'exact', head: true })
    .eq('event_type', input.eventType)
    .eq('user_id', input.userId)
    .eq('newsletter_id', input.newsletterId)
    .gt('created_at', new Date(Date.now() - 10_000).toISOString())

  if (input.targetUrl) {
    query = query.eq('metadata->>target_url', input.targetUrl)
  }

  const { count } = await query
  return !!count && count > 0
}

async function insertTrackingEvent(input: {
  eventType: 'email_open' | 'link_click'
  payload: TrackingPayload
  metadata: TrackingRequestMetadata
  targetUrl?: string
}): Promise<void> {
  await getSupabaseClient()
    .from('analytics_events')
    .insert({
      event_type: input.eventType,
      user_id: input.payload.sub,
      newsletter_id: input.payload.nwl,
      metadata: {
        source: input.eventType === 'email_open' ? 'email_open' : 'email_click',
        correlation_id: input.payload.jti,
        target_url: input.targetUrl,
        user_agent: input.metadata.userAgent ?? null,
        ip: input.metadata.ip ?? null,
      },
    })
}

export const emailTrackingEndpointService = {
  transparentGif: TRANSPARENT_GIF,

  async handlePixel(token: string | null, metadata: TrackingRequestMetadata): Promise<PixelResponse> {
    if (!token) {
      return gifResponse()
    }

    try {
      const payload = verifyToken(token)
      if (!payload) {
        return gifResponse()
      }

      const duplicate = await hasRecentEvent({
        eventType: 'email_open',
        userId: payload.sub,
        newsletterId: payload.nwl,
      })
      if (!duplicate) {
        await insertTrackingEvent({ eventType: 'email_open', payload, metadata })
      }
    } catch (error) {
      console.error('Pixel tracking error:', error)
    }

    return gifResponse()
  },

  async handleClick(
    token: string | null,
    targetUrl: string | null,
    metadata: TrackingRequestMetadata,
  ): Promise<ClickResponse> {
    if (!targetUrl) {
      return { status: 400, body: 'Missing URL parameter' }
    }
    if (!isValidRedirectUrl(targetUrl)) {
      return { status: 400, body: 'Invalid redirect URL' }
    }
    if (!token) {
      return { status: 302, redirectUrl: targetUrl }
    }

    try {
      const payload = verifyToken(token)
      if (!payload) {
        return { status: 302, redirectUrl: targetUrl }
      }

      const duplicate = await hasRecentEvent({
        eventType: 'link_click',
        userId: payload.sub,
        newsletterId: payload.nwl,
        targetUrl,
      })
      if (!duplicate) {
        await insertTrackingEvent({ eventType: 'link_click', payload, metadata, targetUrl })
      }

      return { status: 302, redirectUrl: targetUrl }
    } catch (error) {
      console.error('Click tracking error:', error)
      return { status: 500, body: 'Internal Server Error' }
    }
  },
}
