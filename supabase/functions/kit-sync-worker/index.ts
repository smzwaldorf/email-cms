import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

import {
  corsHeaders,
  createAdminClient,
  getKitConfig,
  handleWorkerRequest,
  processPendingSyncJobs,
} from '../_shared/email-platform.ts'

serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  return handleWorkerRequest(async () => {
    const config = getKitConfig()
    const adminClient = createAdminClient()
    const body = request.method === 'POST' ? await request.json().catch(() => ({})) : {}

    return await processPendingSyncJobs(adminClient, config, {
      jobId: typeof body.jobId === 'string' ? body.jobId : undefined,
      limit: typeof body.limit === 'number' ? body.limit : undefined,
    })
  })
})
