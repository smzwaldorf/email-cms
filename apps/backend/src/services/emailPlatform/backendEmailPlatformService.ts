import { getSupabaseClient } from '#/lib/supabase'
import { resolveEmailPlatformConfig } from '#/services/emailPlatform/config'
import { KitAdapter } from '#/services/emailPlatform/kitAdapter'
import { mapRecipientToKitPayload } from '#/services/emailPlatform/kitMapping'
import {
  loadRecipientRecord,
  persistWebhookEvent,
  processPendingSyncJobs,
  processPendingWebhookEvents,
  replayFailedEmailPlatformWork,
} from '#/services/emailPlatform/runtime'

const CMS_NEWSLETTER_BODY_FIELD = 'cms_newsletter_body_html'

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
  provider: 'kit'
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
  return resolveEmailPlatformConfig((key) => process.env[key])
}

function stripHtml(input: string): string {
  return input.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
}

function toPreviewText(html: string): string {
  const plain = stripHtml(html)
  if (!plain) return 'Newsletter update'
  return plain.length > 120 ? `${plain.slice(0, 117)}...` : plain
}

function renderBroadcastMergeBody(): string {
  return `{{ subscriber.${CMS_NEWSLETTER_BODY_FIELD} }}`
}

function assertSendNewsletterRequest(input: SendNewsletterRequest): void {
  if (!input.batchId || !input.newsletterId || !Array.isArray(input.recipients) || input.recipients.length === 0) {
    throw new Error('Missing required fields for Kit newsletter send.')
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
  async processSyncWorker(body: Record<string, unknown>): Promise<Record<string, unknown>> {
    const config = getKitConfig()
    return processPendingSyncJobs(getSupabaseClient(), config, {
      jobId: typeof body.jobId === 'string' ? body.jobId : undefined,
      limit: typeof body.limit === 'number' ? body.limit : undefined,
    })
  },

  async reconcile(body: Record<string, unknown>): Promise<Record<string, unknown>> {
    const config = getKitConfig()
    const webhookResult = await processPendingWebhookEvents(getSupabaseClient(), config, {
      eventId: typeof body.eventId === 'string' ? body.eventId : undefined,
      includeUnresolved: true,
    })
    const syncResult = await processPendingSyncJobs(getSupabaseClient(), config, {
      jobId: typeof body.jobId === 'string' ? body.jobId : undefined,
      limit: typeof body.limit === 'number' ? body.limit : config.reconciliationBatchSize,
    })

    return { webhookResult, syncResult }
  },

  async replay(body: Record<string, unknown>): Promise<Record<string, unknown>> {
    return replayFailedEmailPlatformWork(getSupabaseClient(), {
      jobIds: Array.isArray(body.jobIds) ? body.jobIds.filter((value): value is string => typeof value === 'string') : undefined,
      webhookEventIds: Array.isArray(body.webhookEventIds)
        ? body.webhookEventIds.filter((value): value is string => typeof value === 'string')
        : undefined,
      replayAllFailed: body.replayAllFailed === true,
    })
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

    const config = getKitConfig()
    const adminClient = getSupabaseClient()
    const adapter = new KitAdapter(config)
    const batchTag = `delivery-batch:${input.batchId}`
    const sentRecipientIds: string[] = []
    const failedRecipients: Array<{ recipientId: string; error: string }> = []

    for (const recipientInput of input.recipients) {
      if (
        !recipientInput?.recipientId ||
        !recipientInput?.familyId ||
        !recipientInput?.parentEmail ||
        !recipientInput?.subject ||
        !recipientInput?.htmlContent
      ) {
        failedRecipients.push({
          recipientId: recipientInput?.recipientId ?? 'unknown',
          error: 'missing_recipient_fields',
        })
        continue
      }

      const recipient = await loadRecipientRecord(adminClient, recipientInput.familyId)
      if (!recipient) {
        failedRecipients.push({
          recipientId: recipientInput.recipientId,
          error: `family_not_found:${recipientInput.familyId}`,
        })
        continue
      }

      try {
        const mapped = mapRecipientToKitPayload(recipient, { classTagPrefix: config.classTagPrefix })
        const payload = {
          ...mapped,
          externalIdentityKey: `newsletter-recipient:${recipientInput.recipientId}`,
          emailAddress: recipientInput.parentEmail.trim().toLowerCase(),
          customFields: {
            ...mapped.customFields,
            cms_newsletter_subject: recipientInput.subject,
            [CMS_NEWSLETTER_BODY_FIELD]: recipientInput.htmlContent,
            cms_newsletter_id: input.newsletterId,
            cms_delivery_batch_id: input.batchId,
            cms_recipient_id: recipientInput.recipientId,
            cms_journey_correlation_id: recipientInput.journeyCorrelationId ?? '',
          },
          tagNames: Array.from(new Set([...mapped.tagNames, batchTag])),
        }
        const syncOutcome = await adapter.upsertSubscriber({ payload })
        if ((syncOutcome.providerState ?? '').toLowerCase() !== 'active') {
          failedRecipients.push({
            recipientId: recipientInput.recipientId,
            error: `inactive_or_unconfirmed:${syncOutcome.providerState ?? 'unknown'}`,
          })
          continue
        }
        sentRecipientIds.push(recipientInput.recipientId)
      } catch (upsertError) {
        failedRecipients.push({
          recipientId: recipientInput.recipientId,
          error: upsertError instanceof Error ? upsertError.message : String(upsertError),
        })
      }
    }

    if (sentRecipientIds.length === 0) {
      return {
        sent: false,
        provider: 'kit',
        providerMessageId: null,
        broadcastId: null,
        sendAt: null,
        publicUrl: null,
        sentRecipientIds,
        failedRecipients,
      }
    }

    const sampleRecipient = input.recipients.find((recipient) => sentRecipientIds.includes(recipient.recipientId))
    const sendAt = new Date().toISOString()
    const broadcast = await adapter.createBroadcast({
      subject: sampleRecipient?.subject?.trim() || 'Newsletter update',
      content: renderBroadcastMergeBody(),
      description: `newsletter:${input.newsletterId} batch:${input.batchId}`,
      previewText: toPreviewText(sampleRecipient?.htmlContent ?? ''),
      sendAt,
      emailAddress: null,
      tagNames: [batchTag],
    })

    return {
      sent: true,
      provider: 'kit',
      providerMessageId: `kit-broadcast-${broadcast.broadcastId}`,
      broadcastId: broadcast.broadcastId,
      sendAt: broadcast.sendAt,
      publicUrl: broadcast.publicUrl,
      sentRecipientIds,
      failedRecipients,
    }
  },
}
