import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

import { resolveEmailPlatformConfig } from '../../../src/services/emailPlatform/config.ts'
import { EmailPlatformConfig } from '../../../src/types/emailPlatform.ts'
export {
  buildJsonResponse,
  corsHeaders,
  enqueueSyncJob,
  fetchDueSyncJobs,
  fetchDueWebhookEvents,
  handleWorkerRequest,
  loadRecipientRecord,
  persistWebhookEvent,
  processPendingSyncJobs,
  processPendingWebhookEvents,
  processSyncJob,
  processWebhookEvent,
  replayFailedEmailPlatformWork,
} from '../../../src/services/emailPlatform/runtime.ts'

type AdminClient = ReturnType<typeof createClient>

function getRequiredEnvVar(key: string): string {
  const value = Deno.env.get(key)

  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`)
  }

  return value
}

export function getKitConfig(): EmailPlatformConfig {
  return resolveEmailPlatformConfig((key) => Deno.env.get(key))
}

export function createAdminClient(): AdminClient {
  return createClient(
    getRequiredEnvVar('SUPABASE_URL'),
    getRequiredEnvVar('SUPABASE_SERVICE_ROLE_KEY'),
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    },
  )
}
