import { loadBackendConfig } from '#/config'
import { closePool } from '#/lib/db'
import { getSupabaseClient } from '#/lib/supabase'
import { NewsletterDeliveryWorker } from '#/worker/deliveryWorker'

const batchId = process.env.NEWSLETTER_DELIVERY_BATCH_ID

async function main(): Promise<void> {
  await import('#/env')
  if (!batchId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(batchId)) {
    throw new Error('NEWSLETTER_DELIVERY_BATCH_ID must be a UUID')
  }

  try {
    const worker = new NewsletterDeliveryWorker(loadBackendConfig(), getSupabaseClient())
    const processed = await worker.runBatchOnce(batchId)
    if (processed !== 1) {
      throw new Error(`No queued delivery job found for batch ${batchId}`)
    }
    console.info(`Processed newsletter delivery batch ${batchId}`)
  } finally {
    await closePool()
  }
}

void main().catch(error => {
  console.error('Batch delivery retry failed:', error)
  process.exitCode = 1
})
