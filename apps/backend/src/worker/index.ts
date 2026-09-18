import { loadBackendConfig } from '#/config'
import { closePool } from '#/lib/db'
import { getSupabaseClient } from '#/lib/supabase'
import { NewsletterDeliveryWorker } from '#/worker/deliveryWorker'
import { createPollingWorker } from '#/runtime/pollingWorker'
import { installShutdownSignals } from '#/runtime/signals'

export async function main(): Promise<void> {
  await import('#/env')
  const config = loadBackendConfig()
  const runtime = createPollingWorker({
    executor: new NewsletterDeliveryWorker(config, getSupabaseClient()),
    pollIntervalMs: config.workerPollIntervalMs,
    closeResources: closePool,
    onProcessed(count) {
      if (count > 0) console.info(`Processed ${count} newsletter delivery job(s)`)
    },
  })
  installShutdownSignals(runtime.stop)
  runtime.start()
}

const invokedDirectly = require.main === module || /(?:^|\/)src\/worker\/index\.ts$|(?:^|\/)dist\/worker\/index\.js$/.test(process.argv[1] ?? '')

if (invokedDirectly) {
  void main().catch(error => {
    console.error('CMS worker startup failed:', error)
    process.exitCode = 1
  })
}
