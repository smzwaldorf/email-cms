import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

import {
  corsHeaders,
  createAdminClient,
  handleWorkerRequest,
  replayFailedEmailPlatformWork,
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

  return handleWorkerRequest(async () => {
    const adminClient = createAdminClient()
    const body = await request.json().catch(() => ({}))

    return await replayFailedEmailPlatformWork(adminClient, {
      jobIds: Array.isArray(body.jobIds) ? body.jobIds : undefined,
      webhookEventIds: Array.isArray(body.webhookEventIds) ? body.webhookEventIds : undefined,
      replayAllFailed: body.replayAllFailed === true,
    })
  })
})
