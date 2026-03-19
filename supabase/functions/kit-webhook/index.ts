import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

import {
  corsHeaders,
  createAdminClient,
  getKitConfig,
  handleWorkerRequest,
  persistWebhookEvent,
  processPendingWebhookEvents,
} from '../_shared/email-platform.ts'

serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const config = getKitConfig()
  const adminClient = createAdminClient()
  const rawBody = await request.text()
  const persistedEvent = await persistWebhookEvent(adminClient, request, rawBody, config)

  if (!persistedEvent.accepted) {
    return persistedEvent.response
  }

  return handleWorkerRequest(async () => {
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
})
