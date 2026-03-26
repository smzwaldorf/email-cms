import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

import {
  buildJsonResponse,
  corsHeaders,
  createAdminClient,
  getKitConfig,
  loadRecipientRecord,
} from '../_shared/email-platform.ts'
import { KitAdapter } from '../../../src/services/emailPlatform/kitAdapter.ts'
import { mapRecipientToKitPayload } from '../../../src/services/emailPlatform/kitMapping.ts'

interface SendNewsletterRequest {
  batchId: string
  newsletterId: string
  recipients: Array<{
    recipientId: string
    familyId: string
    parentEmail?: string | null
    journeyCorrelationId?: string | null
    subject: string
    htmlContent: string
  }>
}

function stripHtml(input: string): string {
  return input.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
}

function toPreviewText(html: string): string {
  const plain = stripHtml(html)
  if (!plain) return 'Newsletter update'
  return plain.length > 120 ? `${plain.slice(0, 117)}...` : plain
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function renderBroadcastArticleListBody(articleTitles: string[]): string {
  if (articleTitles.length === 0) {
    return '<section><h2>Articles in this newsletter</h2><ul><li>Newsletter update</li></ul></section>'
  }

  const items = articleTitles
    .map((title, index) => {
      const normalized = title.trim()
      const safeTitle = normalized.length > 0 ? normalized : `Article ${index + 1}`
      return `<li>${escapeHtml(safeTitle)}</li>`
    })
    .join('')

  return `<section><h2>Articles in this newsletter</h2><ul>${items}</ul></section>`
}

serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    if (request.method !== 'POST') {
      return buildJsonResponse({ error: 'Method not allowed' }, 405)
    }

    const body = (await request.json()) as Partial<SendNewsletterRequest>
    if (!body.batchId || !body.newsletterId || !Array.isArray(body.recipients) || body.recipients.length === 0) {
      return buildJsonResponse({ error: 'Missing required fields for kit-send-newsletter.' }, 400)
    }

    const config = getKitConfig()
    const adminClient = createAdminClient()
    const adapter = new KitAdapter(config)
    const batchTag = `delivery-batch:${body.batchId}`
    const sentRecipientIds: string[] = []
    const failedRecipients: Array<{ recipientId: string; error: string }> = []

    for (const recipientInput of body.recipients) {
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
          // Parent-level recipient targeting (not family-level email fanout)
          externalIdentityKey: `newsletter-recipient:${recipientInput.recipientId}`,
          emailAddress: recipientInput.parentEmail.trim().toLowerCase(),
          customFields: {
            ...mapped.customFields,
            cms_newsletter_subject: recipientInput.subject,
            cms_newsletter_body_html: recipientInput.htmlContent,
            cms_newsletter_id: body.newsletterId,
            cms_delivery_batch_id: body.batchId,
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
      return buildJsonResponse({
        sent: false,
        provider: 'kit',
        providerMessageId: null,
        broadcastId: null,
        sendAt: null,
        publicUrl: null,
        sentRecipientIds,
        failedRecipients,
      })
    }

    const sampleRecipient = body.recipients.find((recipient) => sentRecipientIds.includes(recipient.recipientId))
    const sendAt = new Date().toISOString()
    const description = `newsletter:${body.newsletterId} batch:${body.batchId}`
    const { data: newsletterArticles, error: newsletterArticlesError } = await adminClient
      .from('newsletter_articles')
      .select('article_order, articles!inner(title)')
      .eq('newsletter_id', body.newsletterId)
      .order('article_order', { ascending: true })
    if (newsletterArticlesError) {
      throw new Error(`Failed to load newsletter articles for broadcast body: ${newsletterArticlesError.message}`)
    }
    const articleTitles = (newsletterArticles ?? []).map((row) => {
      const joined = row.articles as { title?: string | null } | Array<{ title?: string | null }> | null
      const article = Array.isArray(joined) ? joined[0] : joined
      return article?.title ?? ''
    })
    const broadcastBody = renderBroadcastArticleListBody(articleTitles)
    const previewText = toPreviewText(broadcastBody)
    // Newsletter title should be rendered directly in broadcast metadata (not merged at send time).
    const broadcastSubject =
      sampleRecipient?.subject && sampleRecipient.subject.trim().length > 0
        ? sampleRecipient.subject.trim()
        : 'Newsletter update'
    const broadcast = await adapter.createBroadcast({
      subject: broadcastSubject,
      // Broadcast body intentionally ignores template/recipient-specific content.
      content: broadcastBody,
      description,
      previewText,
      sendAt,
      emailAddress: null,
      tagNames: [batchTag],
    })

    return buildJsonResponse({
      sent: true,
      provider: 'kit',
      providerMessageId: `kit-broadcast-${broadcast.broadcastId}`,
      broadcastId: broadcast.broadcastId,
      sendAt: broadcast.sendAt,
      publicUrl: broadcast.publicUrl,
      sentRecipientIds,
      failedRecipients,
    })
  } catch (error) {
    console.error('kit-send-newsletter error:', error)
    return buildJsonResponse(
      {
        error: error instanceof Error ? error.message : String(error),
      },
      500,
    )
  }
})
