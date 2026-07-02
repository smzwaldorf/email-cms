import '#/env'
import { loadBackendConfig } from '#/config'
import { getSupabaseClient } from '#/lib/supabase'
import { NewsletterDeliveryWorker } from '#/worker/deliveryWorker'

const config = loadBackendConfig()
const worker = new NewsletterDeliveryWorker(config, getSupabaseClient())

async function tick(): Promise<void> {
  try {
    const processed = await worker.runOnce()
    if (processed > 0) {
      console.info(`Processed ${processed} newsletter delivery job(s)`)
    }
  } catch (error) {
    console.error('Newsletter delivery worker tick failed:', error)
  }
}

void tick()
setInterval(() => {
  void tick()
}, config.workerPollIntervalMs)
