import { runtimeEnvironment } from '#/runtime/environment'
import { assertNewsletterDeliveryAllowed, DeliveryPolicyError } from '#/services/emailDeliveryPolicy'
import { getSupabaseClient } from '#/lib/supabase'
import { resolveEmailPlatformConfig } from '#/services/emailPlatform/config'
import {
  persistWebhookEvent,
  processPendingWebhookEvents,
} from '#/services/emailPlatform/runtime'


export interface SendNewsletterRecipientInput {
  recipientId: string
  familyId: string
  parentEmail?: string | null
  journeyCorrelationId?: string | null
  subject: string
  htmlContent: string
}

export interface SendNewsletterRequest {
  batchId: string
  newsletterId: string
  recipients: SendNewsletterRecipientInput[]
}

export interface SendNewsletterResult {
  sent: boolean
  provider: 'resend'
  providerMessageIds: Record<string, string>
  providerMessageId: string | null
  broadcastId: string | null
  sendAt: string | null
  publicUrl: string | null
  sentRecipientIds: string[]
  failedRecipients: Array<{ recipientId: string; error: string }>
}

export interface BackendServiceResponse {
  status: number
  body: Record<string, unknown>
}

function getKitConfig() {
  return resolveEmailPlatformConfig((key) => runtimeEnvironment()[key])
}

function assertSendNewsletterRequest(input: SendNewsletterRequest): void {
  if (!input.batchId || !input.newsletterId || !Array.isArray(input.recipients) || input.recipients.length === 0) {
    throw new Error('Missing required fields for Resend newsletter send.')
  }
}

async function responseToServiceResponse(response: Response): Promise<BackendServiceResponse> {
  const text = await response.text()
  if (!text.trim()) {
    return { status: response.status, body: {} }
  }

  try {
    return { status: response.status, body: JSON.parse(text) as Record<string, unknown> }
  } catch {
    return { status: response.status, body: { message: text } }
  }
}

async function handleWorker(handler: () => Promise<Record<string, unknown>>): Promise<BackendServiceResponse> {
  try {
    return { status: 200, body: await handler() }
  } catch (error) {
    console.error('Email platform backend service error:', error)
    return {
      status: 500,
      body: {
        error: error instanceof Error ? error.message : String(error),
      },
    }
  }
}

export const backendEmailPlatformService = {
  // Legacy endpoints remain explicit tombstones, never an alternate outbound path.
  async processSyncWorker(_body: Record<string, unknown>): Promise<Record<string, unknown>> {
    throw new Error('Kit sync is retired; newsletter sending uses Resend')
  },
  async reconcile(_body: Record<string, unknown>): Promise<Record<string, unknown>> {
    throw new Error('Kit reconciliation is retired; reconcile Resend email IDs')
  },
  async replay(_body: Record<string, unknown>): Promise<Record<string, unknown>> {
    throw new Error('Kit replay is retired; newsletter sending uses Resend')
  },

  async handleKitWebhook(input: {
    rawBody: string
    url: string
    headers: HeadersInit
  }): Promise<BackendServiceResponse> {
    const config = getKitConfig()
    const adminClient = getSupabaseClient()
    const request = new Request(input.url, {
      method: 'POST',
      headers: input.headers,
      body: input.rawBody,
    })

    try {
      const persistedEvent = await persistWebhookEvent(adminClient, request, input.rawBody, config)
      if (!persistedEvent.accepted) {
        return responseToServiceResponse(persistedEvent.response)
      }

      return handleWorker(async () => {
        if (persistedEvent.event) {
          await processPendingWebhookEvents(adminClient, config, {
            eventId: persistedEvent.event.id,
            includeUnresolved: true,
          })
        }

        return {
          accepted: true,
          duplicate: persistedEvent.duplicate ?? false,
          eventId: persistedEvent.event?.id ?? null,
        }
      })
    } catch (error) {
      console.error('Kit webhook backend service error:', error)
      return {
        status: 500,
        body: {
          error: error instanceof Error ? error.message : String(error),
        },
      }
    }
  },

  async sendNewsletter(input: SendNewsletterRequest): Promise<SendNewsletterResult> {
    assertSendNewsletterRequest(input)
    assertNewsletterDeliveryAllowed(input.recipients)

    const env = runtimeEnvironment()
    if (!env.RESEND_API_KEY || !env.RESEND_FROM_EMAIL) {
      throw new DeliveryPolicyError('Resend requires RESEND_API_KEY and RESEND_FROM_EMAIL')
    }
    const providerMessageIds: Record<string, string> = {}
    const failedRecipients: Array<{ recipientId: string; error: string }> = []
    for (const recipient of input.recipients) {
      if (!recipient.recipientId || !recipient.familyId || !recipient.parentEmail || !recipient.subject || !recipient.htmlContent) {
        failedRecipients.push({ recipientId: recipient.recipientId, error: 'missing_recipient_fields' })
        continue
      }
      // One immutable message per parent; never share provider merge fields.
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST', signal: AbortSignal.timeout(10_000),
        headers: {
          Authorization: `Bearer ${env.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
          'Idempotency-Key': `newsletter/${input.batchId}/${recipient.recipientId}`,
        },
        body: JSON.stringify({
          from: env.RESEND_FROM_EMAIL, to: [recipient.parentEmail.trim().toLowerCase()],
          subject: recipient.subject, html: recipient.htmlContent,
          tags: [{ name: 'batch_id', value: input.batchId }, { name: 'recipient_id', value: recipient.recipientId }],
        }),
      })
      // Do not expose provider response bodies, which can contain recipient data.
      if (!response.ok) {
        if (response.status >= 500 || response.status === 408 || response.status === 409) {
          throw new Error(`Resend outcome uncertain (HTTP ${response.status}); reconcile before retrying`)
        }
        failedRecipients.push({ recipientId: recipient.recipientId, error: `resend_http_${response.status}` })
        continue
      }
      const data = await response.json() as { id?: unknown }
      if (typeof data.id !== 'string' || !data.id) throw new Error('Resend outcome uncertain: missing email ID')
      // Persist each acceptance before sending the next message, so a later timeout
      // cannot erase successful recipients or cause them to be sent again.
      const { error } = await getSupabaseClient().from('newsletter_delivery_batch_recipients')
        .update({ send_status: 'sent', provider_message_id: data.id, provider_error: null,
          failure_reason: null, sent_at: new Date().toISOString(), campaign_ready: true })
        .eq('id', recipient.recipientId).eq('batch_id', input.batchId)
      if (error) throw new Error('Resend accepted email but outcome persistence failed; reconcile before retrying')
      providerMessageIds[recipient.recipientId] = data.id
    }
    const sentRecipientIds = Object.keys(providerMessageIds)
    return {
      sent: sentRecipientIds.length > 0, provider: 'resend', providerMessageIds,
      providerMessageId: null, broadcastId: null, sendAt: null, publicUrl: null,
      sentRecipientIds, failedRecipients,
    }
  },
}
